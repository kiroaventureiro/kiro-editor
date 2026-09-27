import { AudioLines, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import type { Clip, Track } from "../editor/types";

interface Props {
  tracks: Track[];
  clip?: Clip;
  onTrack: (id: string, patch: Partial<Track>) => void;
  onClipChange: (patch: Partial<Clip>) => void;
  onBegin: () => void;
  onEnd: () => void;
}

type AudioTool = "mixer" | "clip" | "fades";

const tabs: Array<[AudioTool, string]> = [
  ["mixer", "Mixagem"],
  ["clip", "Clipe"],
  ["fades", "Suavização"],
];

/** Organized audio workspace for project mix, clip level, and fades. */
export default function AudioMixer({
  tracks,
  clip,
  onTrack,
  onClipChange,
  onBegin,
  onEnd,
}: Props) {
  const [tool, setTool] = useState<AudioTool>("mixer");
  const channels = tracks.filter(
    (track) =>
      track.type === "audio" ||
      track.clips.some((item) => item.type === "video"),
  );
  const audioClip = clip && (clip.type === "audio" || clip.type === "video")
    ? clip
    : undefined;

  const clipRange = (
    label: string,
    key: "volume" | "fadeIn" | "fadeOut",
    min: number,
    max: number,
    step: number,
    fallback: number,
    format: (value: number) => string,
  ) => {
    const value = Number(audioClip?.[key] ?? fallback);
    return (
      <label className="audio-clip-control" key={key}>
        <span>
          <strong>{label}</strong>
          <output>{format(value)}</output>
        </span>
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={!audioClip}
          onPointerDown={onBegin}
          onPointerUp={onEnd}
          onPointerCancel={onEnd}
          onKeyDown={onBegin}
          onKeyUp={onEnd}
          onBlur={onEnd}
          onChange={(event) =>
            onClipChange({ [key]: Number(event.target.value) })
          }
        />
      </label>
    );
  };

  return (
    <section className="audio-mixer" aria-label="Ajustes de áudio">
      <header className="dock-panel-heading">
        <div>
          <span className="dock-eyebrow">MONITORAMENTO</span>
          <strong><AudioLines size={15} aria-hidden="true" /> Ajustes de áudio</strong>
        </div>
        <span className="mixer-channel-count">{channels.length} canais</span>
      </header>

      <nav className="dock-tool-tabs" role="tablist" aria-label="Ferramentas de áudio">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tool === value}
            disabled={(value === "clip" || value === "fades") && !audioClip}
            onClick={() => setTool(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="audio-tool-content" role="tabpanel">
        {tool === "mixer" && (
          <div className="mixer-channels">
            {channels.length ? channels.map((track) => {
              const level = Math.round((track.volume ?? 1) * 100);
              return (
                <article className={`mixer-channel ${track.muted ? "muted" : ""}`} key={track.id}>
                  <strong title={track.name}>{track.name}</strong>
                  <div className="mixer-fader-wrap">
                    <span className="mixer-db">{level === 0 ? "−∞" : `${(20 * Math.log10(level / 100)).toFixed(0)} dB`}</span>
                    <input
                      aria-label={`Volume da trilha ${track.name}`}
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={track.volume ?? 1}
                      style={{ writingMode: "vertical-rl", direction: "rtl" }}
                      onPointerDown={onBegin}
                      onPointerUp={onEnd}
                      onPointerCancel={onEnd}
                      onKeyDown={onBegin}
                      onKeyUp={onEnd}
                      onBlur={onEnd}
                      onChange={(event) => onTrack(track.id, { volume: Number(event.target.value) })}
                    />
                    <span className="mixer-percent">{level}%</span>
                  </div>
                  <button
                    className="mixer-mute"
                    aria-label={track.muted ? `Ativar áudio de ${track.name}` : `Silenciar ${track.name}`}
                    aria-pressed={!!track.muted}
                    onClick={() => {
                      onBegin();
                      onTrack(track.id, { muted: !track.muted });
                      onEnd();
                    }}
                  >
                    {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    <span>{track.muted ? "MUDO" : "ATIVO"}</span>
                  </button>
                </article>
              );
            }) : (
              <div className="mixer-empty">
                <AudioLines size={22} aria-hidden="true" />
                <span>Adicione uma trilha de áudio ou vídeo para mixar.</span>
              </div>
            )}
          </div>
        )}

        {tool === "clip" && audioClip && (
          <div className="audio-clip-controls">
            <span className="dock-tool-kicker">VOLUME DO CLIPE · {audioClip.name}</span>
            {clipRange("Volume do clipe", "volume", 0, 1, 0.01, 1, (v) => `${Math.round(v * 100)}%`)}
            <p>Controla o volume somente deste clipe, sem alterar o volume da trilha.</p>
          </div>
        )}

        {tool === "fades" && audioClip && (
          <div className="audio-clip-controls">
            <span className="dock-tool-kicker">ENTRADAS E SAÍDAS SUAVES · {audioClip.name}</span>
            {clipRange("Fade de entrada", "fadeIn", 0, Math.min(5, audioClip.duration / 2), 0.05, 0, (v) => `${v.toFixed(2)} s`)}
            {clipRange("Fade de saída", "fadeOut", 0, Math.min(5, audioClip.duration / 2), 0.05, 0, (v) => `${v.toFixed(2)} s`)}
            <p>Os fades são aplicados na prévia e também na exportação.</p>
          </div>
        )}
      </div>

      <footer className="mixer-master">
        <span>SAÍDA DO PROJETO</span>
        <span>Controles afetam a reprodução e a exportação</span>
      </footer>
    </section>
  );
}
