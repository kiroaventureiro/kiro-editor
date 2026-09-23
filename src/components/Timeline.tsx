import { Scissors, Trash2 } from 'lucide-react';
import type { Clip, Track } from '../editor/types';

interface Props {
  tracks: Track[];
  selectedClipId?: string;
  onSelectClip: (clip: Clip) => void;
  onDelete: () => void;
}

export default function Timeline({ tracks, selectedClipId, onSelectClip, onDelete }: Props) {
  const total = Math.max(10, ...tracks.flatMap(t => t.clips.map(c => c.start + c.duration)));
  const ticks = Array.from({ length: 6 }, (_, i) => Math.round((total / 5) * i));

  return (
    <section className="timeline-shell">
      <div className="timeline-toolbar">
        <button disabled title="Dividir chega no próximo passo"><Scissors size={16}/> Dividir</button>
        <button onClick={onDelete} disabled={!selectedClipId}><Trash2 size={16}/> Excluir</button>
        <span className="timeline-hint">Selecione um clipe · zoom automático</span>
      </div>
      <div className="ruler">{ticks.map(t => <span key={t}>{t}s</span>)}</div>
      <div className="tracks">
        {tracks.map(track => (
          <div className="track-row" key={track.id}>
            <div className="track-name"><strong>{track.name}</strong><small>{track.type}</small></div>
            <div className="track-lane">
              {track.clips.map(clip => (
                <button
                  className={`clip clip-${track.type} ${selectedClipId === clip.id ? 'selected' : ''}`}
                  key={clip.id}
                  style={{ left: `${(clip.start / total) * 100}%`, width: `${Math.max((clip.duration / total) * 100, 4)}%` }}
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
    </section>
  );
}
