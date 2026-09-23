import { Scissors, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import type { Clip, Track } from '../editor/types';

interface Props {
  tracks: Track[];
  selectedClipId?: string;
  playhead: number;
  onSeek: (time: number) => void;
  onSplit: () => void;
  onSelectClip: (clip: Clip) => void;
  onMoveClip: (clipId: string, start: number) => void;
  onTrimClip: (clipId: string, edge: 'start' | 'end', time: number) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onDelete: () => void;
}

type DragState = {
  mode: 'move' | 'trim-start' | 'trim-end';
  clipId: string;
  pointerId: number;
  originX: number;
  originStart: number;
  originDuration: number;
  laneWidth: number;
  total: number;
};

export default function Timeline({ tracks, selectedClipId, playhead, onSeek, onSplit, onSelectClip, onMoveClip, onTrimClip, onEditStart, onEditEnd, onDelete }: Props) {
  const total = Math.max(10, ...tracks.flatMap(t => t.clips.map(c => c.start + c.duration)));
  const ticks = Array.from({ length: 6 }, (_, i) => (total / 5) * i);
  const playheadPercent = Math.min(100, Math.max(0, (playhead / total) * 100));
  const dragRef = useRef<DragState | null>(null);

  const seekFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * total);
  };

  const beginDrag = (event: React.PointerEvent<HTMLElement>, clip: Clip, mode: DragState['mode']) => {
    event.preventDefault();
    event.stopPropagation();
    const lane = event.currentTarget.closest('.track-lane') as HTMLElement | null;
    if (!lane) return;
    const rect = lane.getBoundingClientRect();
    dragRef.current = {
      mode,
      clipId: clip.id,
      pointerId: event.pointerId,
      originX: event.clientX,
      originStart: clip.start,
      originDuration: clip.duration,
      laneWidth: rect.width,
      total,
    };
    onEditStart();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelectClip(clip);
  };

  const updateDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const deltaSeconds = ((event.clientX - drag.originX) / Math.max(1, drag.laneWidth)) * drag.total;

    if (drag.mode === 'move') {
      onMoveClip(drag.clipId, Math.max(0, drag.originStart + deltaSeconds));
      return;
    }

    if (drag.mode === 'trim-start') {
      const maxStart = drag.originStart + drag.originDuration - 0.1;
      onTrimClip(drag.clipId, 'start', Math.min(maxStart, Math.max(0, drag.originStart + deltaSeconds)));
      return;
    }

    const minEnd = drag.originStart + 0.1;
    onTrimClip(drag.clipId, 'end', Math.max(minEnd, drag.originStart + drag.originDuration + deltaSeconds));
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    onEditEnd();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <section className="timeline-shell">
      <div className="timeline-toolbar">
        <button onClick={onSplit} disabled={!selectedClipId}><Scissors size={16}/> Dividir</button>
        <button onClick={onDelete} disabled={!selectedClipId}><Trash2 size={16}/> Excluir</button>
        <span className="timeline-time">{formatTime(playhead)} / {formatTime(total)}</span>
        <span className="timeline-hint">Arraste o clipe · puxe as bordas para cortar</span>
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
                <div className="playhead" style={{ left: `${playheadPercent}%` }} aria-hidden="true"><span /></div>
                {track.clips.map(clip => (
                  <div
                    className={`clip clip-${track.type} ${selectedClipId === clip.id ? 'selected' : ''}`}
                    key={clip.id}
                    style={{ left: `${(clip.start / total) * 100}%`, width: `${Math.max((clip.duration / total) * 100, 4)}%` }}
                    onPointerDown={(event) => beginDrag(event, clip, 'move')}
                    onPointerMove={updateDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onClick={() => onSelectClip(clip)}
                    title={`${clip.name} · ${clip.duration.toFixed(1)}s`}
                  >
                    <button
                      className="trim-handle trim-handle-start"
                      aria-label="Cortar início"
                      onPointerDown={(event) => beginDrag(event, clip, 'trim-start')}
                      onPointerMove={updateDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    />
                    <strong>{clip.name}</strong><small>{clip.duration.toFixed(1)}s</small>
                    <button
                      className="trim-handle trim-handle-end"
                      aria-label="Cortar final"
                      onPointerDown={(event) => beginDrag(event, clip, 'trim-end')}
                      onPointerMove={updateDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    />
                  </div>
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
