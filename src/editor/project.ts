import type { KiroProject, ProjectSettings } from "./types";

export const projectPresets: Record<
  ProjectSettings["aspectRatio"],
  Pick<ProjectSettings, "width" | "height">
> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export function createEmptyProject(): KiroProject {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: "Meu primeiro projeto KIRO",
    createdAt: now,
    updatedAt: now,
    settings: { width: 1920, height: 1080, fps: 30, aspectRatio: "16:9" },
    assets: [],
    tracks: [
      { id: "video-1", name: "Vídeo principal", type: "video", clips: [] },
      { id: "audio-1", name: "Áudio", type: "audio", clips: [] },
      { id: "text-1", name: "Textos", type: "text", clips: [] },
    ],
  };
}

export const demoProject = createEmptyProject();
