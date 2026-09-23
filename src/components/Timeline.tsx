import { Scissors, Trash2 } from 'lucide-react';
import type { Clip, Track } from '../editor/types';

interface Props {
  tracks: Track[];
  selectedClipId?: string;
  playhead: number;
  onSeek: (time: number) => void;
  onSplit: () => void;
  onSelectClip: (clip: Clip) => void;
  onDelete: () => void;
}

export default function Timeline({ tracks, selectedClipId, playhead, onSeek, onSplit, onSelectClip, onDelete }: Props) {
  const total = Math.max(10, ...tracks.flatMap(t => t.clips.map(c => c.start + c.duration)));
  const ticks = Array.from({ length: 6 }, (_, i) => (total / 5) * i);
  const playheadPercent = Math.min(100, Math.max(0, (playhead / total) * 100));

  const seekFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * total);
  };

  return (
    <section className="timeline-shell">
      <div className="timeline-toolbar">
        <button onClick={onSplit} disabled={!selectedClipId}><Scissors size={16}/> Dividir</button>
        <button onClick={onDelete} disabled={!selectedClipId}><Trash2 size={16}/> Excluir</button>
        <span className="timeline-time">{formatTime(playhead)} / {formatTime(total)}</span>
        <span className="timeline-hint">Toque ou clique na timeline para mover o cursor</span>
      </div>

      <div className="timeline-scroll">
        <div className="ruler" onPointerDown={seekFromPointer}>
          {ticks.map((t, index) => <span key={index}>{formatTime(t)}</span>)}
        </div>

        <div className="tracks">
          {tracks.map(track => (
            <div className="track-row" key={track.id}>
              <div className="track-name"><strong>{track.name}</strong><small>{track.type}</small></div>
              <div className="track-lane" onPointerDown={seekFromPointer}>
                <div className="playhead" style={{ left: `${playheadPercent}%` }} aria-hidden="true">
                  <span />
                </div>
                {track.clips.map(clip => (
                  <button
                    className={`clip clip-${track.type} ${selectedClipId === clip.id ? 'selected' : ''}`}
                    key={clip.id}
                    style={{ left: `${(clip.start / total) * 100}%`, width: `${Math.max((clip.duration / total) * 100, 4)}%` }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => onSelectClip(clip)}
                    title={`${clip.name} · ${clip.duration.toFixed(1)}s`}
                  >
                    <strong>{clip.name}</strong><small>{clip.duration.toFixed(1)}s</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe - minutes * 60;
  return `${minutes}:${secs.toFixed(1).padStart(4, '0')}`;
}
