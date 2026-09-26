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
