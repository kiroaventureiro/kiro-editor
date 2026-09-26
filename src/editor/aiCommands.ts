import type { Clip, KiroProject } from "./types";
import { changeSpeed, removeClips, split } from "./operations";

export type KiroAiCommand =
  | { type: "split_clip"; clipId: string; time: number }
  | { type: "delete_clips"; clipIds: string[]; ripple?: boolean }
  | { type: "move_clip"; clipId: string; start: number }
  | {
      type: "update_clip";
      clipId: string;
      patch: Pick<
        Partial<Clip>,
        | "text"
        | "volume"
        | "speed"
        | "x"
        | "y"
        | "scale"
        | "rotation"
        | "opacity"
        | "fadeIn"
        | "fadeOut"
        | "fontSize"
        | "fontWeight"
        | "color"
        | "backgroundColor"
        | "backgroundOpacity"
        | "brightness"
        | "contrast"
        | "saturation"
        | "blur"
      >;
    }
  | { type: "set_track"; trackId: string; muted?: boolean; locked?: boolean }
  | { type: "add_text"; text: string; start: number; duration: number };

export interface KiroAiExecutionResult {
  project: KiroProject;
  applied: number;
  rejected: { index: number; reason: string }[];
}

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function editableClip(project: KiroProject, clipId: string) {
  for (const track of project.tracks) {
    const clip = track.clips.find((item) => item.id === clipId);
    if (clip) return track.locked ? undefined : { track, clip };
  }
  return undefined;
}

function sanitizePatch(patch: KiroAiCommand & { type: "update_clip" }) {
  const source = patch.patch;
  const next: Partial<Clip> = {};
  if (typeof source.text === "string") next.text = source.text.slice(0, 10_000);
  if (finite(source.volume)) next.volume = Math.max(0, Math.min(2, source.volume));
  if (finite(source.speed)) next.speed = Math.max(0.1, Math.min(8, source.speed));
  if (finite(source.x)) next.x = Math.max(-200, Math.min(200, source.x));
  if (finite(source.y)) next.y = Math.max(-200, Math.min(200, source.y));
  if (finite(source.scale)) next.scale = Math.max(0.02, Math.min(20, source.scale));
  if (finite(source.rotation)) next.rotation = Math.max(-3600, Math.min(3600, source.rotation));
  if (finite(source.opacity)) next.opacity = Math.max(0, Math.min(1, source.opacity));
  if (finite(source.fadeIn)) next.fadeIn = Math.max(0, source.fadeIn);
  if (finite(source.fadeOut)) next.fadeOut = Math.max(0, source.fadeOut);
  if (finite(source.fontSize)) next.fontSize = Math.max(0.5, Math.min(40, source.fontSize));
  if (finite(source.fontWeight)) next.fontWeight = Math.max(100, Math.min(900, source.fontWeight));
  if (typeof source.color === "string") next.color = source.color.slice(0, 32);
  if (typeof source.backgroundColor === "string") next.backgroundColor = source.backgroundColor.slice(0, 32);
  if (finite(source.backgroundOpacity))
    next.backgroundOpacity = Math.max(0, Math.min(1, source.backgroundOpacity));
  if (finite(source.brightness)) next.brightness = Math.max(0, Math.min(3, source.brightness));
  if (finite(source.contrast)) next.contrast = Math.max(0, Math.min(3, source.contrast));
  if (finite(source.saturation)) next.saturation = Math.max(0, Math.min(3, source.saturation));
  if (finite(source.blur)) next.blur = Math.max(0, Math.min(100, source.blur));
  return next;
}

export function applyKiroAiCommands(
  initial: KiroProject,
  commands: KiroAiCommand[],
): KiroAiExecutionResult {
  let project = initial;
  let applied = 0;
  const rejected: { index: number; reason: string }[] = [];

  commands.slice(0, 40).forEach((command, index) => {
    try {
      if (command.type === "delete_clips") {
        const ids = command.clipIds.filter((id) => editableClip(project, id));
        if (!ids.length) throw new Error("Nenhum clipe editável encontrado.");
        project = removeClips(project, ids, Boolean(command.ripple));
      } else if (command.type === "split_clip") {
        const found = editableClip(project, command.clipId);
        if (!found || !finite(command.time)) throw new Error("Clipe ou tempo inválido.");
        const pieces = split(found.clip, command.time);
        if (pieces.length < 2) throw new Error("O corte precisa ficar dentro do clipe.");
        project = {
          ...project,
          tracks: project.tracks.map((track) =>
            track.id !== found.track.id
              ? track
              : {
                  ...track,
                  clips: track.clips.flatMap((clip) =>
                    clip.id === found.clip.id ? pieces : [clip],
                  ),
                },
          ),
        };
      } else if (command.type === "move_clip") {
        const found = editableClip(project, command.clipId);
        if (!found || !finite(command.start)) throw new Error("Clipe ou posição inválida.");
        project = {
          ...project,
          tracks: project.tracks.map((track) =>
            track.id !== found.track.id
              ? track
              : {
                  ...track,
                  clips: track.clips.map((clip) =>
                    clip.id === found.clip.id
                      ? { ...clip, start: Math.max(0, command.start) }
                      : clip,
                  ),
                },
          ),
        };
      } else if (command.type === "update_clip") {
        const found = editableClip(project, command.clipId);
        if (!found) throw new Error("Clipe inexistente ou trilha bloqueada.");
        const patch = sanitizePatch(command);
        const updated =
          patch.speed !== undefined
            ? { ...changeSpeed(found.clip, patch.speed), ...patch }
            : { ...found.clip, ...patch };
        project = {
          ...project,
          tracks: project.tracks.map((track) =>
            track.id !== found.track.id
              ? track
              : {
                  ...track,
                  clips: track.clips.map((clip) =>
                    clip.id === found.clip.id ? updated : clip,
                  ),
                },
          ),
        };
      } else if (command.type === "set_track") {
        const track = project.tracks.find((item) => item.id === command.trackId);
        if (!track) throw new Error("Trilha não encontrada.");
        project = {
          ...project,
          tracks: project.tracks.map((item) =>
            item.id === track.id
              ? {
                  ...item,
                  ...(typeof command.muted === "boolean" ? { muted: command.muted } : {}),
                  ...(typeof command.locked === "boolean" ? { locked: command.locked } : {}),
                }
              : item,
          ),
        };
      } else if (command.type === "add_text") {
        if (!command.text.trim() || !finite(command.start) || !finite(command.duration))
          throw new Error("Texto, início ou duração inválidos.");
        const track = project.tracks.find((item) => item.type === "text" && !item.locked);
        if (!track) throw new Error("Não existe trilha de texto desbloqueada.");
        const clip: Clip = {
          id: crypto.randomUUID(),
          name: command.text.trim().slice(0, 40),
          type: "text",
          text: command.text.trim().slice(0, 10_000),
          start: Math.max(0, command.start),
          duration: Math.max(1 / project.settings.fps, command.duration),
          x: 50,
          y: 50,
          scale: 1,
          opacity: 1,
          fontSize: 6,
          fontWeight: 700,
          color: "#ffffff",
        };
        project = {
          ...project,
          tracks: project.tracks.map((item) =>
            item.id === track.id ? { ...item, clips: [...item.clips, clip] } : item,
          ),
        };
      } else {
        throw new Error("Comando não permitido.");
      }
      applied += 1;
    } catch (error) {
      rejected.push({
        index,
        reason: error instanceof Error ? error.message : "Comando rejeitado.",
      });
    }
  });

  return { project, applied, rejected };
}
