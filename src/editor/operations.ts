import type { Clip, KiroProject } from "./types";

export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export const frameTime = (time: number, fps: number) =>
  Math.round(time * fps) / fps;
export const projectDuration = (p: KiroProject) =>
  p.tracks.reduce(
    (end, t) =>
      t.clips.reduce((e, c) => Math.max(e, c.start + c.duration), end),
    0,
  );
export const activeAt = (c: Clip, time: number) =>
  time >= c.start && time < c.start + c.duration;
export function envelope(c: Clip, time: number) {
  const local = time - c.start;
  return Math.min(
    c.fadeIn ? clamp(local / c.fadeIn, 0, 1) : 1,
    c.fadeOut ? clamp((c.duration - local) / c.fadeOut, 0, 1) : 1,
  );
}
export function changeSpeed(c: Clip, speed: number): Clip {
  const sourceIn = c.sourceIn ?? 0;
  const sourceOut = c.sourceOut ?? sourceIn + c.duration * (c.speed ?? 1);
  return {
    ...c,
    speed,
    sourceIn,
    sourceOut,
    duration: (sourceOut - sourceIn) / speed,
  };
}
export function trim(
  c: Clip,
  edge: "start" | "end",
  time: number,
  p: KiroProject,
): Clip {
  const fps = p.settings.fps;
  const speed = c.speed ?? 1;
  const sourceIn = c.sourceIn ?? 0;
  const end = c.start + c.duration;
  const asset = p.assets.find((a) => a.id === c.assetId);
  const bounded = asset && asset.type !== "image";
  if (edge === "start") {
    const start = clamp(
      frameTime(time, fps),
      bounded ? Math.max(0, c.start - sourceIn / speed) : 0,
      end - 1 / fps,
    );
    return {
      ...c,
      start,
      duration: end - start,
      sourceIn: bounded ? sourceIn + (start - c.start) * speed : 0,
    };
  }
  const maxEnd = bounded
    ? c.start +
      ((asset.duration ?? sourceIn + c.duration * speed) - sourceIn) / speed
    : Infinity;
  const newEnd = clamp(frameTime(time, fps), c.start + 1 / fps, maxEnd);
  return {
    ...c,
    duration: newEnd - c.start,
    sourceOut: sourceIn + (newEnd - c.start) * speed,
  };
}
export function split(c: Clip, time: number): Clip[] {
  if (time <= c.start + 0.001 || time >= c.start + c.duration - 0.001)
    return [c];
  const first = time - c.start;
  const sourceIn = c.sourceIn ?? 0;
  const at = sourceIn + first * (c.speed ?? 1);
  return [
    {
      ...c,
      id: crypto.randomUUID(),
      duration: first,
      sourceOut: at,
      fadeOut: 0,
    },
    {
      ...c,
      id: crypto.randomUUID(),
      start: time,
      duration: c.duration - first,
      sourceIn: at,
      fadeIn: 0,
    },
  ];
}
export function removeClips(
  p: KiroProject,
  ids: string[],
  ripple: boolean,
): KiroProject {
  const wanted = new Set(ids);
  return {
    ...p,
    tracks: p.tracks.map((t) => {
      if (t.locked) return t;
      const removed = t.clips.filter((c) => wanted.has(c.id));
      const intervals: [number, number][] = [];
      for (const c of [...removed].sort((a, b) => a.start - b.start)) {
        const last = intervals[intervals.length - 1];
        if (last && c.start <= last[1])
          last[1] = Math.max(last[1], c.start + c.duration);
        else intervals.push([c.start, c.start + c.duration]);
      }
      return {
        ...t,
        clips: t.clips
          .filter((c) => !wanted.has(c.id))
          .map((c) => ({
            ...c,
            start: ripple
              ? Math.max(
                  0,
                  c.start -
                    intervals.reduce(
                      (n, [a, b]) => n + Math.max(0, Math.min(c.start, b) - a),
                      0,
                    ),
                )
              : c.start,
          })),
      };
    }),
  };
}
export function snap(
  time: number,
  candidates: number[],
  threshold: number,
  fps: number,
) {
  let result = time,
    distance = threshold;
  for (const candidate of candidates)
    if (Math.abs(time - candidate) < distance) {
      distance = Math.abs(time - candidate);
      result = candidate;
    }
  return Math.max(0, frameTime(result, fps));
}
export function parseSrt(text: string): Clip[] {
  const seconds = (s: string) => {
    const [h, m, sec] = s.replace(",", ".").split(":").map(Number);
    return h * 3600 + m * 60 + sec;
  };
  const clips: Clip[] = [];
  for (const block of text
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const index = lines.findIndex((l) => l.includes("-->"));
    if (index < 0) continue;
    const match = lines[index].match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/,
    );
    if (!match) continue;
    const start = seconds(match[1]),
      end = seconds(match[2]);
    const content = lines
      .slice(index + 1)
      .join("\n")
      .replace(/<[^>]*>/g, "");
    if (end > start && content)
      clips.push({
        id: crypto.randomUUID(),
        name: content.slice(0, 40),
        type: "text",
        start,
        duration: end - start,
        text: content,
        caption: true,
        captionStyle: "yellow-bar",
        y: 34,
        fontSize: 5.5,
        fontWeight: 800,
        color: "#111111",
        strokeWidth: 0,
        backgroundColor: "#ffd84d",
        backgroundOpacity: 0.96,
        backgroundPadding: 0.34,
      });
  }
  return clips;
}
