import { Scissors, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  const [pixelsPerSecond, setPixelsPerSecond] = useState(10);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const labelWidth = 140;
  const laneWidth = Math.max(760, total * pixelsPerSecond);
  const timelineWidth = labelWidth + laneWidth;
  const playheadLeft = Math.max(0, Math.min(laneWidth, playhead * pixelsPerSecond));
  const tickStep = chooseTickStep(pixelsPerSecond);
  const ticks = Array.from({ length: Math.floor(total / tickStep) + 1 }, (_, i) => i * tickStep);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const x = labelWidth + playheadLeft;
    const leftGuard = scroller.scrollLeft + 120;
    const rightGuard = scroller.scrollLeft + scroller.clientWidth - 120;

    if (x > rightGuard) {
      scroller.scrollLeft = Math.max(0, x - scroller.clientWidth * 0.65);
    } else if (x < leftGuard && scroller.scrollLeft > 0) {
      scroller.scrollLeft = Math.max(0, x - scroller.clientWidth * 0.25);
    }
  }, [playheadLeft, labelWidth]);

  const seekFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = Math.max(0, event.clientX - rect.left);
    onSeek(Math.min(total, localX / pixelsPerSecond));
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
    const deltaSeconds = (event.clientX - drag.originX) / pixelsPerSecond;

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
        <label className="timeline-zoom">
          Zoom
          <input
            aria-label="Zoom da timeline"
            type="range"
            min="2"
            max="30"
            step="1"
            value={pixelsPerSecond}
            onChange={(event) => setPixelsPerSecond(Number(event.target.value))}
          />
        </label>
        <span className="timeline-hint">A agulha acompanha o vídeo · arraste para navegar</span>
      </div>

      <div className="timeline-scroll" ref={scrollRef}>
        <div className="timeline-content" style={{ width: `${timelineWidth}px` }}>
          <div className="ruler-row">
            <div className="ruler-label" />
            <div className="ruler" onPointerDown={seekFromPointer} style={{ width: `${laneWidth}px` }}>
              {ticks.map((t) => (
                <span className="ruler-tick" key={t} style={{ left: `${t * pixelsPerSecond}px` }}>
                  {formatTime(t)}
                </span>
              ))}
              <div className="ruler-playhead" style={{ left: `${playheadLeft}px` }} aria-hidden="true" />
            </div>
          </div>

          <div className="tracks">
            {tracks.map(track => (
              <div className="track-row" key={track.id} style={{ gridTemplateColumns: `${labelWidth}px ${laneWidth}px` }}>
                <div className="track-name"><strong>{track.name}</strong><small>{track.type}</small></div>
                <div className="track-lane" onPointerDown={seekFromPointer} style={{ width: `${laneWidth}px` }}>
                  <div className="playhead" style={{ left: `${playheadLeft}px` }} aria-hidden="true"><span /></div>
                  {track.clips.map(clip => (
                    <div
                      className={`clip clip-${track.type} ${selectedClipId === clip.id ? 'selected' : ''}`}
                      key={clip.id}
                      style={{ left: `${clip.start * pixelsPerSecond}px`, width: `${Math.max(clip.duration * pixelsPerSecond, 24)}px` }}
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
      </div>
    </section>
  );
}

function chooseTickStep(pixelsPerSecond: number) {
  if (pixelsPerSecond >= 20) return 5;
  if (pixelsPerSecond >= 10) return 10;
  if (pixelsPerSecond >= 5) return 30;
  return 60;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe - minutes * 60;
  return `${minutes}:${secs.toFixed(1).padStart(4, '0')}`;
}
