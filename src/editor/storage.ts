import type { KiroProject, MediaAsset } from "./types";
const LAST = "kiro-editor-last-project";
const urls = new Map<string, string>();
let connection: Promise<IDBDatabase> | undefined;
function db() {
  return (connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("kiro-editor", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("projects", { keyPath: "id" });
      request.result.createObjectStore("media");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  task: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(store, mode);
    const request = task(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? request.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Gravação interrompida."));
  });
}
export function cleanProject(p: KiroProject): KiroProject {
  return { ...p, assets: p.assets.map((a) => ({ ...a, path: "" })) };
}
export async function saveProject(p: KiroProject) {
  await run("projects", "readwrite", (s) => s.put(cleanProject(p)));
  localStorage.setItem(LAST, p.id);
}
export async function putMedia(id: string, file: Blob) {
  await run("media", "readwrite", (s) => s.put(file, id));
  if (urls.has(id)) URL.revokeObjectURL(urls.get(id)!);
  const url = URL.createObjectURL(file);
  urls.set(id, url);
  return url;
}
export async function hydrate(p: KiroProject): Promise<KiroProject> {
  const assets = await Promise.all(
    p.assets.map(async (a) => {
      if (urls.has(a.id)) return { ...a, path: urls.get(a.id)! };
      const blob = await run<Blob | undefined>("media", "readonly", (s) =>
        s.get(a.id),
      );
      if (!blob) return { ...a, path: "" };
      const url = URL.createObjectURL(blob);
      urls.set(a.id, url);
      return { ...a, path: url };
    }),
  );
  return { ...p, assets };
}
export async function loadLast(): Promise<KiroProject | undefined> {
  const id = localStorage.getItem(LAST);
  if (id) {
    const project = await run<KiroProject | undefined>(
      "projects",
      "readonly",
      (s) => s.get(id),
    );
    if (project) return hydrate(validateProject(project));
  }
  const legacy = localStorage.getItem("kiro-editor-project-v01");
  if (legacy) return hydrate(validateProject(JSON.parse(legacy)));
}
export async function listProjects(): Promise<KiroProject[]> {
  const projects = await run<KiroProject[]>("projects", "readonly", (s) =>
    s.getAll(),
  );
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function getProject(id: string) {
  const p = await run<KiroProject>("projects", "readonly", (s) => s.get(id));
  return hydrate(validateProject(p));
}
export function validateProject(value: unknown): KiroProject {
  if (!value || typeof value !== "object")
    throw new Error("Arquivo de projeto inválido.");
  const p = value as KiroProject;
  const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  if (
    p.version !== 1 ||
    typeof p.id !== "string" ||
    typeof p.name !== "string" ||
    !p.settings ||
    !["16:9", "9:16", "1:1", "4:5"].includes(p.settings.aspectRatio) ||
    ![p.settings.width, p.settings.height, p.settings.fps].every(
      (n) => finite(n) && n > 0,
    ) ||
    p.settings.width > 7680 ||
    p.settings.height > 7680 ||
    p.settings.fps > 120 ||
    !Array.isArray(p.assets) ||
    !Array.isArray(p.tracks)
  )
    throw new Error("Formato de projeto inválido ou incompatível.");
  const ids = new Set<string>();
  for (const a of p.assets) {
    if (
      !a ||
      typeof a.id !== "string" ||
      ids.has(a.id) ||
      typeof a.name !== "string" ||
      !["video", "audio", "image"].includes(a.type) ||
      (a.duration !== undefined && (!finite(a.duration) || a.duration <= 0))
    )
      throw new Error("Mídia inválida no projeto.");
    ids.add(a.id);
  }
  const clips = new Set<string>(),
    tracks = new Set<string>();
  for (const t of p.tracks) {
    if (
      !t ||
      typeof t.id !== "string" ||
      tracks.has(t.id) ||
      typeof t.name !== "string" ||
      !["video", "audio", "text", "overlay"].includes(t.type) ||
      !Array.isArray(t.clips)
    )
      throw new Error("Trilha inválida.");
    tracks.add(t.id);
    for (const c of t.clips) {
      if (
        !c ||
        typeof c.id !== "string" ||
        clips.has(c.id) ||
        typeof c.name !== "string" ||
        !["video", "audio", "text", "overlay"].includes(c.type) ||
        !finite(c.start) ||
        c.start < 0 ||
        !finite(c.duration) ||
        c.duration <= 0 ||
        (c.assetId !== undefined && !ids.has(c.assetId))
      )
        throw new Error("Clipe inválido.");
      for (const key of [
        "sourceIn",
        "sourceOut",
        "speed",
        "volume",
        "x",
        "y",
        "endX",
        "endY",
        "scale",
        "endScale",
        "rotation",
        "opacity",
        "fadeIn",
        "fadeOut",
        "fontSize",
      ] as const) {
        if (c[key] !== undefined && !finite(c[key]))
          throw new Error("Ajuste de clipe inválido.");
      }
      if (
        (c.speed !== undefined && (c.speed < 0.25 || c.speed > 4)) ||
        (c.sourceIn ?? 0) < 0 ||
        (c.volume ?? 1) < 0 ||
        (c.volume ?? 1) > 1
      )
        throw new Error("Ajuste fora dos limites.");
      for (const key of ["text", "notes", "color"] as const)
        if (c[key] !== undefined && typeof c[key] !== "string")
          throw new Error("Texto inválido.");
      clips.add(c.id);
    }
  }
  return {
    ...p,
    updatedAt:
      typeof p.updatedAt === "string" ? p.updatedAt : new Date().toISOString(),
    assets: p.assets.map((a) => ({
      ...a,
      path: "",
      thumbnail: a.thumbnail?.startsWith("data:image/")
        ? a.thumbnail
        : undefined,
    })),
  };
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function inspectFile(
  file: File,
): Promise<Omit<MediaAsset, "id" | "path">> {
  const type = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("audio/")
        ? "audio"
        : undefined;
  if (!type) throw new Error(`${file.name}: formato não reconhecido.`);
  const url = URL.createObjectURL(file);
  try {
    if (type === "image") {
      const img = new Image();
      img.src = url;
      await img.decode();
      return {
        name: file.name,
        type,
        size: file.size,
        thumbnail: thumbnail(img, img.naturalWidth, img.naturalHeight),
      };
    }
    const el = document.createElement(type);
    el.preload = "auto";
    el.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`${file.name}: leitura demorou demais.`)),
          15000,
        );
        el.onloadeddata = () => {
          clearTimeout(timer);
          resolve();
        };
        el.onerror = () => {
          clearTimeout(timer);
          reject(
            new Error(`${file.name}: codec não suportado neste navegador.`),
          );
        };
      });
      if (!Number.isFinite(el.duration) || el.duration <= 0)
        throw new Error(`${file.name}: duração inválida.`);
      const result: Omit<MediaAsset, "id" | "path"> = {
        name: file.name,
        type,
        size: file.size,
        duration: el.duration,
      };
      if (el instanceof HTMLVideoElement)
        result.thumbnail = thumbnail(el, el.videoWidth, el.videoHeight);
      // Decode bounded audio files only: large media must not freeze import or exhaust memory.
      if (type === "audio" && file.size < 24 * 1024 * 1024) {
        const context = new AudioContext();
        try {
          const audio = await context.decodeAudioData(await file.arrayBuffer());
          const data = audio.getChannelData(0),
            stride = Math.max(1, Math.floor(data.length / 160));
          result.peaks = Array.from({ length: 160 }, (_, i) => {
            let peak = 0;
            for (
              let j = i * stride;
              j < Math.min(data.length, (i + 1) * stride);
              j += 16
            )
              peak = Math.max(peak, Math.abs(data[j]));
            return peak;
          });
        } catch {
          /* Waveform is optional; original audio is still imported. */
        } finally {
          await context.close();
        }
      }
      return result;
    } finally {
      el.removeAttribute("src");
      el.load();
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
function thumbnail(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = Math.max(1, Math.round((192 * height) / width));
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}
