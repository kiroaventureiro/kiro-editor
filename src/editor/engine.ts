import type { Clip, KiroProject } from "./types";
import { activeAt, clamp, envelope, projectDuration } from "./operations";

type Resource = HTMLVideoElement | HTMLAudioElement | HTMLImageElement;
/** One composition path shared by preview and recorded output. Track order is bottom to top. */
export class Composition {
  private resources = new Map<string, Resource>();
  private gains = new Map<string, GainNode>();
  private pending = new Set<string>();
  private context?: AudioContext;
  private destination?: MediaStreamAudioDestinationNode;
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
          if (element instanceof HTMLImageElement) await element.decode();
          else {
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
                reject(new Error(`Não foi possível ler ${asset.name}.`));
              };
              if (element.readyState >= 2) {
                cleanup();
                resolve();
              }
            });
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
  async enableAudio(monitor: boolean) {
    if (!this.context) {
      this.context = new AudioContext();
      this.destination = this.context.createMediaStreamDestination();
      for (const [id, resource] of this.resources)
        if (resource instanceof HTMLMediaElement) {
          resource.volume = 1;
          const source = this.context.createMediaElementSource(resource),
            gain = this.context.createGain();
          gain.gain.value = 0;
          source.connect(gain);
          gain.connect(this.destination);
          if (monitor) gain.connect(this.context.destination);
          this.gains.set(id, gain);
        }
    }
    await this.context.resume();
    return this.destination!.stream.getAudioTracks();
  }
  update(project: KiroProject) {
    this.project = project;
  }
  sync(time: number, playing: boolean) {
    if (this.failure) throw this.failure;
    for (const track of this.project.tracks)
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
        if (!active || !playing) media.pause();
        if (!active) continue;
        const target = clamp(
          (c.sourceIn ?? 0) + (time - c.start) * (c.speed ?? 1),
          0,
          Math.max(0, media.duration - 0.001),
        );
        media.playbackRate = c.speed ?? 1;
        if (Math.abs(media.currentTime - target) > (playing ? 0.15 : 0.001))
          media.currentTime = target;
        if (playing && media.paused && !this.pending.has(c.id)) {
          this.pending.add(c.id);
          void media
            .play()
            .catch((e: Error) => {
              if (e.name !== "AbortError" && !this.disposed)
                this.failure = new Error(
                  `Reprodução interrompida: ${e.message}`,
                );
            })
            .finally(() => this.pending.delete(c.id));
        }
      }
  }
  async seek(time: number) {
    this.sync(time, false);
    await Promise.all(
      [...this.resources.values()].map((resource) => {
        if (!(resource instanceof HTMLMediaElement) || !resource.seeking)
          return;
        return new Promise<void>((resolve, reject) => {
          const done = () => {
            clearTimeout(timer);
            resource.removeEventListener("seeked", done);
            resolve();
          };
          const timer = setTimeout(() => {
            resource.removeEventListener("seeked", done);
            reject(new Error("A mídia não respondeu ao posicionamento."));
          }, 5000);
          resource.addEventListener("seeked", done, { once: true });
        });
      }),
    );
    this.draw(time);
  }
  draw(time: number) {
    const ctx = this.canvas.getContext("2d")!,
      w = this.canvas.width,
      h = this.canvas.height;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    for (const track of this.project.tracks) {
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
              const fit = Math.min(w / sw, h / sh);
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
  let stream: MediaStream | undefined, recorder: MediaRecorder | undefined;
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
      audioBitsPerSecond: 192000,
    });
    const chunks: Blob[] = [];
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        cancelAnimationFrame(frame);
        signal.removeEventListener("abort", abort);
        document.removeEventListener("visibilitychange", visibility);
      };
      const fail = (error: Error) => {
        cleanup();
        recorder!.onstop = null;
        if (recorder!.state !== "inactive") recorder!.stop();
        reject(error);
      };
      const abort = () => fail(abortError());
      const visibility = () => {
        if (document.hidden)
          fail(
            new Error(
              "Exportação interrompida: mantenha esta aba visível para preservar o ritmo do vídeo.",
            ),
          );
      };
      signal.addEventListener("abort", abort, { once: true });
      document.addEventListener("visibilitychange", visibility);
      recorder!.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder!.onerror = () =>
        fail(new Error("O navegador não conseguiu codificar o vídeo."));
      recorder!.onstop = () => {
        cleanup();
        resolve();
      };
      let start = 0;
      const tick = (now: number) => {
        if (!start) start = now;
        const time = Math.min(duration, (now - start) / 1000);
        try {
          engine.sync(time, true);
          engine.draw(
            Math.min(time, Math.max(0, duration - 1 / project.settings.fps)),
          );
        } catch (e) {
          fail(e instanceof Error ? e : new Error("Falha na renderização."));
          return;
        }
        onProgress(Math.min(99, (time / duration) * 100));
        if (time >= duration) {
          engine.pause();
          recorder!.stop();
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      recorder!.start(250);
      frame = requestAnimationFrame(tick);
    });
    if (signal.aborted) throw abortError();
    let blob = new Blob(chunks, { type: format.mime });
    if (format.extension === "webm") {
      const { default: fixDuration } = await import("fix-webm-duration");
      blob = await fixDuration(blob, duration * 1000, { logger: false });
    }
    if (signal.aborted) throw abortError();
    onProgress(100);
    return { blob, extension: format.extension };
  } finally {
    cancelAnimationFrame(frame);
    if (recorder?.state === "recording") recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    engine.dispose();
  }
}
