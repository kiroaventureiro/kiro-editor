import type { Clip } from "./types";

export async function analyzeAudioPeaks(blob: Blob, maxPoints = 5000) {
  if (blob.size > 80 * 1024 * 1024)
    throw new Error(
      "A análise automática desta mídia está limitada a 80 MB nesta etapa.",
    );

  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    const points = Math.max(
      240,
      Math.min(maxPoints, Math.ceil(audio.duration * 20)),
    );
    const channels = Array.from(
      { length: Math.min(2, audio.numberOfChannels) },
      (_, channel) => audio.getChannelData(channel),
    );
    const stride = Math.max(1, Math.floor(audio.length / points));
    const sampleStep = Math.max(1, Math.floor(stride / 48));
    const peaks = Array.from({ length: points }, (_, i) => {
      let peak = 0;
      const from = i * stride;
      const to = Math.min(audio.length, (i + 1) * stride);
      for (const data of channels)
        for (let j = from; j < to; j += sampleStep)
          peak = Math.max(peak, Math.abs(data[j]));
      return Math.min(1, peak);
    });
    return { peaks, duration: audio.duration };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Não foi possível analisar a faixa de áudio: ${error.message}`
        : "Não foi possível analisar a faixa de áudio desta mídia.",
    );
  } finally {
    await context.close();
  }
}

export function detectBeatTimes(
  clip: Clip,
  peaks: number[],
  assetDuration: number,
  sensitivity = 1.55,
) {
  if (!peaks.length || !assetDuration || clip.type === "text") return [];

  const speed = clip.speed ?? 1;
  const sourceIn = Math.max(0, clip.sourceIn ?? 0);
  const sourceOut = Math.min(
    assetDuration,
    clip.sourceOut ?? sourceIn + clip.duration * speed,
  );
  const bucket = assetDuration / peaks.length;
  const first = Math.max(1, Math.floor(sourceIn / bucket));
  const last = Math.min(peaks.length - 1, Math.ceil(sourceOut / bucket));
  if (last <= first) return [];

  const values = peaks.slice(first, last);
  const average =
    values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const floor = Math.max(0.075, average * sensitivity);
  const times: number[] = [];
  let lastTimelineTime = -Infinity;

  for (let i = first; i < last; i += 1) {
    const value = peaks[i] ?? 0;
    const previous = peaks[i - 1] ?? 0;
    const next = peaks[i + 1] ?? 0;
    const localStart = Math.max(first, i - 5);
    const local = peaks.slice(localStart, i);
    const localAverage =
      local.reduce((sum, item) => sum + item, 0) / Math.max(1, local.length);
    const onset = value - Math.max(previous, localAverage);
    if (
      value < floor ||
      value < previous ||
      value < next ||
      onset < Math.max(0.018, localAverage * 0.22)
    )
      continue;

    const sourceTime = Math.min(sourceOut, (i + 0.5) * bucket);
    if (sourceTime < sourceIn || sourceTime > sourceOut) continue;
    const timelineTime = clip.start + (sourceTime - sourceIn) / speed;
    if (timelineTime - lastTimelineTime < 0.24) continue;
    times.push(timelineTime);
    lastTimelineTime = timelineTime;
    if (times.length >= 2000) break;
  }

  return times;
}
