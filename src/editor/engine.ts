import type { Clip, KiroProject, Track } from "./types";
import { activeAt, clamp, envelope, projectDuration } from "./operations";

type Resource = HTMLVideoElement | HTMLAudioElement | HTMLImageElement;

function visualPriority(track: Track) {
  if (track.type === "text") return 30;
  if (track.type === "overlay") return 20;
  if (track.type === "video") return 10;
  return 0;
}

export function visualTrackStack(tracks: Track[]) {
  return tracks
    .map((track, index) => ({ track, index }))
    .sort(
      (a, b) =>
        visualPriority(a.track) - visualPriority(b.track) || a.index - b.index,
    )
    .map(({ track }) => track);
}

export class Composition {
  private resources = new Map<string, Resource>();
  private gains = new Map<string, GainNode>();
  private pending = new Set<string>();
  private context?: AudioContext;
  private destination?: MediaStreamAudioDestinationNode;
  private monitorGain?: GainNode;
  private monitorEnabled = true;
  private monitorVolume = 1;
  private disposed = false;
  private failure?: Error;

  constructor(
    public project: KiroProject,
    public canvas: HTMLCanvasElement,
  ) {}

  async prepare() {
    const assets = new Map(this.project.assets.map((a) => [a.id, a]));
    await Promise.all(
      this.project.tracks
        .flatMap((t) => t.clips)
        .map(async (c) => {
          if (!c.assetId) return;
          const asset = assets.get(c.assetId);
          if (!asset?.path)
            throw new Error(`Reconecte a mídia: ${asset?.name ?? c.name}`);

          const element =
            asset.type === "image"
              ? new Image()
              : document.createElement(asset.type);
          this.resources.set(c.id, element);
          element.src = asset.path;

          if (element instanceof HTMLImageElement) {
            await element.decode();
          } else {
            element.preload = "auto";
            if (element instanceof HTMLVideoElement) element.playsInline = true;
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => {
                cleanup();
                reject(new Error(`Não foi possível carregar ${asset.name}.`));
              }, 15000);
              const cleanup = () => {
                clearTimeout(timer);
                element.onloadeddata = null;
                element.onerror = null;
              };
              element.onloadeddata = () => {
                cleanup();
                resolve();
              };
              element.onerror = () => {
                cleanup();
                reject(
                  new Error(
                    `Não foi possível ler ${asset.name}. Verifique o codec do arquivo.`,
                  ),
                );
              };
              if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                cleanup();
                resolve();
              }
            });
            if (
              element instanceof HTMLVideoElement &&
              (!element.videoWidth || !element.videoHeight)
            )
              throw new Error(
                `${asset.name}: o navegador abriu o arquivo, mas não conseguiu decodificar a imagem do vídeo.`,
              );
          }

          if (
            !this.disposed &&
            element instanceof HTMLMediaElement &&
            c.sourceIn
          )
            element.currentTime = c.sourceIn;

          if (this.disposed && element instanceof HTMLMediaElement) {
            element.removeAttribute("src");
            element.load();
          }
        }),
    );
  }

  async enableAudio(monitor = true) {
    this.monitorEnabled = monitor;
    if (!this.context) {
      this.context = new AudioContext();
      this.destination = this.context.createMediaStreamDestination();
      this.monitorGain = this.context.createGain();
      this.monitorGain.connect(this.context.destination);

      for (const [id, resource] of this.resources)
        if (resource instanceof HTMLMediaElement) {
          resource.volume = 1;
          const source = this.context.createMediaElementSource(resource);
          const gain = this.context.createGain();
          gain.gain.value = 0;
          source.connect(gain);
          gain.connect(this.destination);
          gain.connect(this.monitorGain);
          this.gains.set(id, gain);
        }
    }

    if (this.monitorGain)
      this.monitorGain.gain.value = this.monitorEnabled
        ? clamp(this.monitorVolume, 0, 1)
        : 0;

    await this.context.resume();
    return this.destination!.stream.getAudioTracks();
  }

  setMonitorVolume(volume: number) {
    this.monitorVolume = clamp(volume, 0, 1);
    if (this.monitorGain)
      this.monitorGain.gain.value = this.monitorEnabled ? this.monitorVolume : 0;
  }

  setMonitorEnabled(enabled: boolean) {
    this.monitorEnabled = enabled;
    if (this.monitorGain)
      this.monitorGain.gain.value = enabled ? this.monitorVolume : 0;
  }

  update(project: KiroProject) {
    this.project = project;
  }

  private mediaTime(c: Clip, media: HTMLMediaElement, time: number) {
    return clamp(
      (c.sourceIn ?? 0) + (time - c.start) * (c.speed ?? 1),
      0,
      Math.max(0, media.duration - 0.001),
    );
  }

  async startPlayback(time: number) {
    const primaryVideo = this.project.tracks.find(
      (track) => track.type === "video",
    )?.id;
    const starts: Promise<void>[] = [];

    for (const track of this.project.tracks) {
      for (const c of track.clips) {
        if (!activeAt(c, time)) continue;
        const media = this.resources.get(c.id);
        if (!(media instanceof HTMLMediaElement)) continue;

        const target = this.mediaTime(c, media, time);
        media.playbackRate = c.speed ?? 1;

        if (!media.seeking && Math.abs(media.currentTime - target) > 0.12)
          media.currentTime = target;

        if (media instanceof HTMLVideoElement) {
          const secondaryVisual =
            (track.type === "video" || track.type === "overlay") &&
            track.id !== primaryVideo;
          media.muted = secondaryVisual;
          media.playsInline = true;
        }

        if (media.paused) {
          starts.push(
            media.play().catch((e: Error) => {
              if (
                e.name !== "AbortError" &&
                e.name !== "NotAllowedError" &&
                !this.disposed
              )
                this.failure = new Error(
                  `Reprodução interrompida: ${e.message}`,
                );
            }),
          );
        }
      }
    }

    await Promise.allSettled(starts);
  }

  sync(time: number, playing: boolean) {
    if (this.failure) throw this.failure;

    const primaryVideo = this.project.tracks.find(
      (track) => track.type === "video",
    )?.id;

    for (const track of this.project.tracks) {
      for (const c of track.clips) {
        const media = this.resources.get(c.id);
        if (!(media instanceof HTMLMediaElement)) continue;

        const active = activeAt(c, time);
        const audible = active && !track.muted;
        const gain = this.gains.get(c.id);

        if (gain)
          gain.gain.value = audible
            ? clamp(c.volume ?? 1, 0, 1) * envelope(c, time)
            : 0;
        else
          media.volume = audible
            ? clamp(c.volume ?? 1, 0, 1) * envelope(c, time)
            : 0;

        if (media instanceof HTMLVideoElement) {
          const secondaryVisual =
            (track.type === "video" || track.type === "overlay") &&
            track.id !== primaryVideo;
          media.muted = secondaryVisual;
          media.playsInline = true;
        }

        if (!active || !playing) media.pause();
        if (!active) continue;

        const target = this.mediaTime(c, media, time);
        media.playbackRate = c.speed ?? 1;

        // Durante a reprodução os elementos de vídeo devem correr naturalmente.
        // Corrigir o currentTime a cada poucos frames faz o navegador entrar em
        // seek contínuo e pode congelar uma das camadas. Só corrigimos desvios
        // realmente perceptíveis e nunca enquanto o elemento já está buscando.
        const tolerance = playing
          ? media instanceof HTMLVideoElement
            ? 0.35
            : 0.18
          : 0.001;
        if (
          !media.seeking &&
          Math.abs(media.currentTime - target) > tolerance
        )
          media.currentTime = target;

        if (playing && media.paused && !this.pending.has(c.id)) {
          this.pending.add(c.id);
          void media
            .play()
            .catch((e: Error) => {
              if (
                e.name !== "AbortError" &&
                e.name !== "NotAllowedError" &&
                !this.disposed
              )
                this.failure = new Error(
                  `Reprodução interrompida: ${e.message}`,
                );
            })
            .finally(() => this.pending.delete(c.id));
        }
      }
    }
  }

  async seek(time: number) {
    this.sync(time, false);
    await Promise.all(
      [...this.resources.values()].map(async (resource) => {
        if (!(resource instanceof HTMLMediaElement)) return;
        if (
          resource.seeking ||
          resource.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          await new Promise<void>((resolve, reject) => {
            const done = () => {
              cleanup();
              resolve();
            };
            const failed = () => {
              cleanup();
              reject(new Error("A mídia não respondeu ao posicionamento."));
            };
            const cleanup = () => {
              clearTimeout(timer);
              resource.removeEventListener("seeked", done);
              resource.removeEventListener("loadeddata", done);
              resource.removeEventListener("error", failed);
            };
            const timer = setTimeout(done, 3500);
            resource.addEventListener("seeked", done, { once: true });
            resource.addEventListener("loadeddata", done, { once: true });
            resource.addEventListener("error", failed, { once: true });
          });
        }

        if (
          resource instanceof HTMLVideoElement &&
          "requestVideoFrameCallback" in resource
        ) {
          await new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              resolve();
            };
            const timer = setTimeout(finish, 180);
            resource.requestVideoFrameCallback(() => {
              clearTimeout(timer);
              finish();
            });
          });
        }
      }),
    );
    this.draw(time);
  }

  draw(time: number) {
    const ctx = this.canvas.getContext("2d")!;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    for (const track of visualTrackStack(this.project.tracks)) {
      if (track.muted && track.type === "text") continue;
      for (const c of track.clips) {
        if (!activeAt(c, time) || c.type === "audio") continue;

        const progress = clamp((time - c.start) / c.duration, 0, 1);
        const smooth = progress * progress * (3 - 2 * progress);
        const lerp = (a: number, b: number | undefined) =>
          a + ((b ?? a) - a) * smooth;

        ctx.save();
        ctx.globalAlpha = clamp(c.opacity ?? 1, 0, 1) * envelope(c, time);
        ctx.translate(
          w / 2 + (lerp(c.x ?? 0, c.endX) * w) / 100,
          h / 2 + (lerp(c.y ?? 0, c.endY) * h) / 100,
        );
        ctx.rotate(((c.rotation ?? 0) * Math.PI) / 180);
        const scale = lerp(c.scale ?? 1, c.endScale);
        ctx.scale(scale, scale);

        if (c.type === "text") {
          const size = ((c.fontSize ?? 6) * Math.min(w, h)) / 100;
          ctx.font = `600 ${size}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = c.color ?? "#ffffff";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = size * 0.12;
          ctx.lineJoin = "round";
          const lines = (c.text ?? c.name).split("\n");
          lines.forEach((line, i) => {
            const y = (i - (lines.length - 1) / 2) * size * 1.25;
            ctx.strokeText(line, 0, y, w * 0.9);
            ctx.fillText(line, 0, y, w * 0.9);
          });
        } else {
          const source = this.resources.get(c.id);
          if (
            source instanceof HTMLImageElement ||
            source instanceof HTMLVideoElement
          ) {
            const sw =
              source instanceof HTMLVideoElement
                ? source.videoWidth
                : source.naturalWidth;
            const sh =
              source instanceof HTMLVideoElement
                ? source.videoHeight
                : source.naturalHeight;

            if (sw && sh) {
              const fit = Math.max(w / sw, h / sh);
              ctx.drawImage(
                source,
                (-sw * fit) / 2,
                (-sh * fit) / 2,
                sw * fit,
                sh * fit,
              );
            }
          }
        }
        ctx.restore();
      }
    }
  }

  pause() {
    for (const r of this.resources.values())
      if (r instanceof HTMLMediaElement) r.pause();
  }

  dispose() {
    this.disposed = true;
    this.pause();
    for (const r of this.resources.values())
      if (r instanceof HTMLMediaElement) {
        r.removeAttribute("src");
        r.load();
      }
    this.resources.clear();
    this.gains.clear();
    this.monitorGain?.disconnect();
    this.monitorGain = undefined;
    void this.context?.close();
  }
}

export function recordingFormat():
  { mime: string; extension: string } | undefined {
  if (
    typeof MediaRecorder === "undefined" ||
    !HTMLCanvasElement.prototype.captureStream
  )
    return;

  for (const mime of [
    "video/mp4;codecs=avc1.424028,mp4a.40.2",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/mp4",
    "video/webm",
  ]) {
    if (MediaRecorder.isTypeSupported(mime))
      return { mime, extension: mime.includes("mp4") ? "mp4" : "webm" };
  }
}

export async function renderVideo(
  project: KiroProject,
  resolution: number,
  signal: AbortSignal,
  onProgress: (p: number) => void,
) {
  const format = recordingFormat();
  if (!format)
    throw new Error(
      "Este navegador não suporta exportação local. Tente uma versão atual do Chrome ou Edge no computador.",
    );

  const duration = projectDuration(project);
  if (!duration) throw new Error("Adicione uma cena à timeline.");

  const canvas = document.createElement("canvas");
  const factor =
    resolution / Math.min(project.settings.width, project.settings.height);
  canvas.width = Math.round((project.settings.width * factor) / 2) * 2;
  canvas.height = Math.round((project.settings.height * factor) / 2) * 2;

  const engine = new Composition(project, canvas);
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let frame = 0;
  const abortError = () =>
    new DOMException("Exportação cancelada.", "AbortError");

  try {
    await engine.prepare();
    if (signal.aborted) throw abortError();

    const audio = await engine.enableAudio(false);
    await engine.seek(0);
    if (signal.aborted) throw abortError();

    stream = canvas.captureStream(project.settings.fps);
    audio.forEach((track) => stream!.addTrack(track));
    recorder = new MediaRecorder(stream, {
      mimeType: format.mime,
      videoBitsPerSecond: resolution === 1080 ? 8_000_000 : 4_000_000,
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const stopped = new Promise<void>((resolve, reject) => {
      recorder!.onstop = () => resolve();
      recorder!.onerror = () => reject(new Error("Falha ao gravar a exportação."));
    });

    recorder.start(1000);
    const start = performance.now();

    await new Promise<void>((resolve, reject) => {
      const tick = (now: number) => {
        if (signal.aborted) return reject(abortError());
        const t = Math.min(duration, (now - start) / 1000);
        try {
          engine.sync(t, true);
          engine.draw(t);
        } catch (e) {
          reject(e);
          return;
        }
        onProgress((t / duration) * 100);
        if (t >= duration) resolve();
        else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });

    engine.pause();
    await new Promise((r) => setTimeout(r, 120));
    recorder.stop();
    await stopped;

    return {
      blob: new Blob(chunks, { type: format.mime }),
      extension: format.extension,
    };
  } finally {
    cancelAnimationFrame(frame);
    engine.dispose();
    stream?.getTracks().forEach((t) => t.stop());
    if (recorder?.state === "recording") recorder.stop();
  }
}
