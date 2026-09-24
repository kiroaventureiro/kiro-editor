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
          const source = this.context.createMediaElementSource(resource),
            gain = this.context.createGain();
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

export async function renderProject(project: KiroProject, onProgress?: (value: number) => void) {
  const format = recordingFormat();
  if (!format) throw new Error("Este navegador não oferece exportação local compatível.");
  const canvas = document.createElement("canvas");
  canvas.width = project.settings.width;
  canvas.height = project.settings.height;
  const composition = new Composition(project, canvas);
  await composition.prepare();
  const stream = canvas.captureStream(project.settings.fps);
  const audio = await composition.enableAudio(false);
  audio.forEach((track) => stream.addTrack(track));
  const recorder = new MediaRecorder(stream, { mimeType: format.mime });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("A exportação foi interrompida."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: format.mime }));
  });
  recorder.start(250);
  const fps = Math.max(1, project.settings.fps),
    duration = projectDuration(project),
    frame = 1 / fps;
  let last = performance.now();
  try {
    for (let t = 0; t < duration; t += frame) {
      composition.sync(t, true);
      composition.draw(t);
      onProgress?.(duration ? Math.min(1, t / duration) : 1);
      const wait = Math.max(0, frame * 1000 - (performance.now() - last));
      await new Promise((resolve) => setTimeout(resolve, wait));
      last = performance.now();
    }
  } finally {
    composition.pause();
    recorder.stop();
  }
  const blob = await done;
  composition.dispose();
  onProgress?.(1);
  return { blob, extension: format.extension };
}
