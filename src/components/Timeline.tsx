import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  Magnet,
  Plus,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  Unlock,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRef, useState } from "react";
import type { Clip, KiroProject, Track } from "../editor/types";
import { projectDuration, snap } from "../editor/operations";
interface Props {
  project: KiroProject;
  selected: string[];
  time: number;
  onSeek: (n: number) => void;
  onSelect: (c: Clip, multiple: boolean) => void;
  onMove: (id: string, n: number, edge?: "start" | "end") => void;
  onBegin: () => void;
  onEnd: () => void;
  onSplit: () => void;
  onDelete: (ripple: boolean) => void;
  onDuplicate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onTrack: (id: string, patch: Partial<Track>) => void;
  onAddTrack: (type: "video" | "audio") => void;
}
export default function Timeline(p: Props) {
  const [zoom, setZoom] = useState(55),
    [snapping, setSnapping] = useState(true),
    [ripple, setRipple] = useState(false);
  const scroll = useRef<HTMLDivElement>(null),
    scrub = useRef<number | null>(null);
  const drag = useRef<{
    id: string;
    x: number;
    start: number;
    duration: number;
    edge?: "start" | "end";
  } | null>(null);
  const total = projectDuration(p.project),
    width = Math.max(800, (total + 5) * zoom),
    label = 128;
  const tick = zoom >= 100 ? 1 : zoom >= 40 ? 2 : zoom >= 15 ? 5 : 10;
  const candidates = [
    0,
    p.time,
    ...p.project.tracks.flatMap((t) =>
      t.clips
        .filter((c) => !p.selected.includes(c.id))
        .flatMap((c) => [c.start, c.start + c.duration]),
    ),
  ];
  const seek = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    p.onSeek(Math.max(0, Math.min(total, (event.clientX - rect.left) / zoom)));
  };
  const scrubProps = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      scrub.current = e.pointerId;
      seek(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (scrub.current === e.pointerId) seek(e);
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      if (scrub.current === e.pointerId) {
        seek(e);
        scrub.current = null;
      }
    },
    onPointerCancel: () => {
      scrub.current = null;
    },
  };
  const start = (
    e: React.PointerEvent<HTMLElement>,
    c: Clip,
    locked: boolean,
    edge?: "start" | "end",
  ) => {
    e.stopPropagation();
    if (locked) return;
    e.preventDefault();
    p.onSelect(c, e.shiftKey || e.metaKey || e.ctrlKey);
    p.onBegin();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: c.id,
      x: e.clientX,
      start: c.start,
      duration: c.duration,
      edge,
    };
  };
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const target =
      d.start + (d.edge === "end" ? d.duration : 0) + (e.clientX - d.x) / zoom;
    let next =
      snapping && !e.altKey
        ? snap(target, candidates, 8 / zoom, p.project.settings.fps)
        : snap(target, [], 0, p.project.settings.fps);
    if (!d.edge && snapping && !e.altKey) {
      const snappedEnd =
        snap(
          target + d.duration,
          candidates,
          8 / zoom,
          p.project.settings.fps,
        ) - d.duration;
      if (Math.abs(snappedEnd - target) < Math.abs(next - target))
        next = Math.max(0, snappedEnd);
    }
    p.onMove(d.id, next, d.edge);
  };
  const end = () => {
    if (drag.current) {
      drag.current = null;
      p.onEnd();
    }
  };
  return (
    <section className="timeline-shell" aria-label="Timeline">
      <div className="timeline-toolbar">
        <div className="tool-group">
          <button
            aria-label="Desfazer"
            title="Desfazer (Ctrl+Z)"
            onClick={p.onUndo}
            disabled={!p.canUndo}
          >
            <Undo2 size={17} />
          </button>
          <button aria-label="Refazer" onClick={p.onRedo} disabled={!p.canRedo}>
            <Redo2 size={17} />
          </button>
          <span className="separator" />
          <button onClick={p.onSplit} disabled={!p.selected.length}>
            <Scissors size={16} />
            Dividir
          </button>
          <button onClick={p.onDuplicate} disabled={!p.selected.length}>
            <Copy size={16} />
            Duplicar
          </button>
          <button
            aria-label="Excluir seleção"
            onClick={() => p.onDelete(ripple)}
            disabled={!p.selected.length}
          >
            <Trash2 size={17} />
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={ripple}
              onChange={(e) => setRipple(e.target.checked)}
            />
            Fechar espaço na trilha
          </label>
        </div>
        <div className="tool-group">
          <button
            className={snapping ? "active" : ""}
            aria-label="Encaixe automático"
            aria-pressed={snapping}
            onClick={() => setSnapping(!snapping)}
          >
            <Magnet size={17} />
          </button>
          <label className="zoom">
            Zoom
            <input
              aria-label="Zoom da timeline"
              type="range"
              min={5}
              max={240}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <button
            onClick={() =>
              setZoom(
                Math.max(
                  5,
                  Math.min(
                    240,
                    ((scroll.current?.clientWidth ?? 800) - label - 40) /
                      Math.max(5, total),
                  ),
                ),
              )
            }
          >
            Ajustar
          </button>
          <button onClick={() => p.onAddTrack("video")}>
            <Plus size={16} />
            Vídeo
          </button>
          <button onClick={() => p.onAddTrack("audio")}>
            <Plus size={16} />
            Áudio
          </button>
        </div>
      </div>
      <div className="timeline-scroll" ref={scroll}>
        <div style={{ width: width + label }}>
          <div
            className="ruler-row"
            style={{ gridTemplateColumns: `${label}px ${width}px` }}
          >
            <div className="ruler-label">
              TEMPO · {p.project.settings.fps} FPS
            </div>
            <div className="ruler" {...scrubProps}>
              {Array.from(
                { length: Math.min(2000, Math.ceil(width / zoom / tick)) },
                (_, i) => (
                  <span
                    className="ruler-tick"
                    key={i}
                    style={{ left: i * tick * zoom }}
                  >
                    {format(i * tick)}
                  </span>
                ),
              )}
              <div className="ruler-playhead" style={{ left: p.time * zoom }}>
                <span />
              </div>
            </div>
          </div>
          {p.project.tracks.map((t) => (
            <div
              className={`track-row ${t.locked ? "locked" : ""}`}
              key={t.id}
              style={{ gridTemplateColumns: `${label}px ${width}px` }}
            >
              <div className="track-name">
                <strong title={t.name}>{t.name}</strong>
                <div>
                  <button
                    aria-label={`${t.type === "text" ? (t.muted ? "Mostrar" : "Ocultar") : (t.muted ? "Ativar" : "Silenciar")} ${t.name}`}
                    onClick={() => p.onTrack(t.id, { muted: !t.muted })}
                  >
                    {t.type === "text" ? (t.muted ? <EyeOff size={13}/> : <Eye size={13}/>) : t.muted ? <VolumeX size={13}/> : <Volume2 size={13}/>}
                  </button>
                  <button
                    aria-label={`${t.locked ? "Desbloquear" : "Bloquear"} ${t.name}`}
                    onClick={() => p.onTrack(t.id, { locked: !t.locked })}
                  >
                    {t.locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>
                </div>
              </div>
              <div className="track-lane" {...scrubProps}>
                {t.clips.map((c) => {
                  const asset = p.project.assets.find(
                    (a) => a.id === c.assetId,
                  );
                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Clipe ${c.name}`}
                      aria-pressed={p.selected.includes(c.id)}
                      key={c.id}
                      className={`clip clip-${t.type} ${p.selected.includes(c.id) ? "selected" : ""}`}
                      style={{
                        left: c.start * zoom,
                        width: Math.max(4, c.duration * zoom),
                      }}
                      onPointerDown={(e) => start(e, c, !!t.locked)}
                      onPointerMove={move}
                      onPointerUp={end}
                      onPointerCancel={end}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          p.onSelect(c, e.shiftKey);
                        }
                      }}
                    >
                      {asset?.thumbnail && (
                        <div
                          className="clip-film"
                          style={{ backgroundImage: `url(${asset.thumbnail})` }}
                        />
                      )}
                      {asset?.peaks && (
                        <svg
                          className="clip-wave"
                          viewBox="0 0 160 40"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          {asset.peaks.map((peak, i) => (
                            <line
                              key={i}
                              x1={i}
                              x2={i}
                              y1={20 - peak * 20}
                              y2={20 + peak * 20}
                            />
                          ))}
                        </svg>
                      )}
                      <strong>{c.name}</strong>
                      <small>{c.duration.toFixed(2)} s</small>
                      <button
                        className="trim-handle start"
                        aria-label={`Cortar início de ${c.name}`}
                        disabled={t.locked}
                        onPointerDown={(e) => start(e, c, !!t.locked, "start")}
                        onPointerMove={move}
                        onPointerUp={end}
                        onPointerCancel={end}
                      />
                      <button
                        className="trim-handle end"
                        aria-label={`Cortar final de ${c.name}`}
                        disabled={t.locked}
                        onPointerDown={(e) => start(e, c, !!t.locked, "end")}
                        onPointerMove={move}
                        onPointerUp={end}
                        onPointerCancel={end}
                      />
                    </div>
                  );
                })}
                <div className="playhead" style={{ left: p.time * zoom }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="timeline-footer">
        <span>
          {p.selected.length
            ? `${p.selected.length} clipe(s) selecionado(s)`
            : "Selecione um clipe para editar"}
        </span>
        <span>
          Shift: seleção múltipla · Alt: ignorar encaixe · Espaço: reproduzir
        </span>
      </div>
    </section>
  );
}
function format(n: number) {
  return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
}
