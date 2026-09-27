import { AudioLines, Volume2, VolumeX } from "lucide-react";
import type { Track } from "../editor/types";

interface Props {
  tracks: Track[];
  onTrack: (id: string, patch: Partial<Track>) => void;
  onBegin: () => void;
  onEnd: () => void;
}

/** Compact track mixer. Faders are persistent project data and affect preview and export. */
export default function AudioMixer({ tracks, onTrack, onBegin, onEnd }: Props) {
  const channels = tracks.filter(
    (track) => track.type === "audio" || track.clips.some((clip) => clip.type === "video"),
  );

  return (
    <section className="audio-mixer" aria-label="Ajustes de áudio">
      <header className="dock-panel-heading">
        <div>
          <span className="dock-eyebrow">MONITORAMENTO</span>
          <strong><AudioLines size={15} aria-hidden="true" /> Ajustes de áudio</strong>
        </div>
        <span className="mixer-channel-count">{channels.length} CH</span>
      </header>
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
      <footer className="mixer-master">
        <span>SAÍDA DO PROJETO</span>
        <span>Faders afetam reprodução e exportação</span>
      </footer>
    </section>
  );
}
