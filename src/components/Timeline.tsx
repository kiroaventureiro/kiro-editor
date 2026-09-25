import {
  Copy,
  Eye,
  EyeOff,
  Link2,
  Lock,
  Magnet,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  Unlock,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
    [ripple, setRipple] = useState(false),
    [viewport, setViewport] = useState(900);
  const scroll = useRef<HTMLDivElement>(null),
    scrub = useRef<number | null>(null),
    fittedForDuration = useRef(-1);
  const drag = useRef<{
    id: string;
    x: number;
    start: number;
    duration: number;
    edge?: "start" | "end";
  } | null>(null);
  const total = projectDuration(p.project),
    label = 132,
    available = Math.max(260, viewport - label - 18),
    width = Math.max(available, Math.max(1, total) * zoom),
    fitZoom = Math.max(0.25, Math.min(240, available / Math.max(1, total)));
  const tick =
    zoom >= 100 ? 1 : zoom >= 40 ? 2 : zoom >= 15 ? 5 : zoom >= 5 ? 10 : zoom >= 2 ? 30 : 60;
  const selectedClip = p.project.tracks
    .flatMap((t) => t.clips)
    .find((c) => p.selected.includes(c.id));
  const sourceTrack = selectedClip
    ? p.project.tracks.find((t) => t.clips.some((c) => c.id === selectedClip.id))
    : undefined;
  const compatibleTracks = selectedClip
    ? p.project.tracks.filter((t) => t.type === selectedClip.type && !t.locked)
    : [];

  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const measure = () => setViewport(element.clientWidth || 900);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!total || fittedForDuration.current === total) return;
    fittedForDuration.current = total;
    const id = requestAnimationFrame(() => {
      setZoom(fitZoom);
      if (scroll.current) scroll.current.scrollLeft = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [total, fitZoom]);

  const fitAll = () => {
    setZoom(fitZoom);
    if (scroll.current) scroll.current.scrollLeft = 0;
  };
  const changeZoom = (delta: number) =>
    setZoom((value) => Math.max(0.25, Math.min(240, value + delta)));
  const moveToLayer = (targetId: string) => {
    if (!selectedClip || !sourceTrack || targetId === sourceTrack.id) return;
    const target = compatibleTracks.find((t) => t.id === targetId);
    if (!target) return;
    p.onBegin();
    p.onTrack(sourceTrack.id, {
      clips: sourceTrack.clips.filter((c) => c.id !== selectedClip.id),
    });
    p.onTrack(target.id, {
      clips: [...target.clips, selectedClip].sort((a, b) => a.start - b.start),
    });
    p.onEnd();
  };
  const toggleSelectedTrackLock = () => {
    if (!sourceTrack) return;
    p.onTrack(sourceTrack.id, { locked: !sourceTrack.locked });
  };
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
    <section className="timeline-shell timeline-premium" aria-label="Timeline">
      <div className="timeline-toolbar">
        <div className="tool-group timeline-edit-tools">
          <button aria-label="Desfazer" title="Desfazer (Ctrl+Z)" onClick={p.onUndo} disabled={!p.canUndo}>
            <Undo2 size={17} />
          </button>
          <button aria-label="Refazer" title="Refazer (Ctrl+Y)" onClick={p.onRedo} disabled={!p.canRedo}>
            <Redo2 size={17} />
          </button>
          <span className="separator" />
          <button onClick={p.onSplit} disabled={!p.selected.length} title="Dividir clipe no cursor">
            <Scissors size={16} /><span>Dividir</span>
          </button>
          <button onClick={p.onDuplicate} disabled={!p.selected.length} title="Duplicar seleção">
            <Copy size={16} /><span>Duplicar</span>
          </button>
          <button aria-label="Excluir seleção" title="Excluir seleção" onClick={() => p.onDelete(ripple)} disabled={!p.selected.length}>
            <Trash2 size={17} />
          </button>
          <span className="separator" />
          <button className="active" aria-label="Ferramenta de seleção" title="Selecionar e mover clipes">
            <MousePointer2 size={16} />
          </button>
          <button
            className={ripple ? "active" : ""}
            aria-label="Fechar espaço ao excluir"
            aria-pressed={ripple}
            title={ripple ? "Fechar espaço: ligado" : "Fechar espaço: desligado"}
            onClick={() => setRipple(!ripple)}
          >
            <Link2 size={16} />
          </button>
          <button
            className={sourceTrack?.locked ? "active" : ""}
            aria-label="Bloquear trilha selecionada"
            title={sourceTrack?.locked ? "Desbloquear trilha" : "Bloquear trilha selecionada"}
            disabled={!sourceTrack}
            onClick={toggleSelectedTrackLock}
          >
            {sourceTrack?.locked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
          {selectedClip && sourceTrack && compatibleTracks.length > 1 && (
            <label className="layer-picker">
              Camada
              <select aria-label="Mover para camada" value={sourceTrack.id} onChange={(e) => moveToLayer(e.target.value)}>
                {compatibleTracks.map((t) => (
                  <option value={t.id} key={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="tool-group timeline-view-tools">
          <button
            className={snapping ? "active" : ""}
            aria-label="Encaixe automático"
            aria-pressed={snapping}
            title={snapping ? "Encaixe automático ligado" : "Encaixe automático desligado"}
            onClick={() => setSnapping(!snapping)}
          >
            <Magnet size={17} />
          </button>
          <button className="zoom-step" aria-label="Diminuir zoom" title="Diminuir zoom" onClick={() => changeZoom(-Math.max(1, zoom * 0.18))}>
            <Minus size={15} />
          </button>
          <label className="zoom">
            <span>Zoom</span>
            <input
              aria-label="Zoom da timeline"
              type="range"
              min={0.25}
              max={240}
              step={0.25}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <button className="zoom-step" aria-label="Aumentar zoom" title="Aumentar zoom" onClick={() => changeZoom(Math.max(1, zoom * 0.18))}>
            <Plus size={15} />
          </button>
          <button className="fit-timeline" onClick={fitAll} title="Mostrar o projeto inteiro na timeline">Ver tudo</button>
          <button onClick={() => p.onAddTrack("video")} title="Nova camada de vídeo">
            <Plus size={16} /><span>Camada</span>
          </button>
          <button onClick={() => p.onAddTrack("audio")} title="Nova camada de áudio">
            <Plus size={16} /><span>Áudio</span>
          </button>
        </div>
      </div>
      <div className="timeline-scroll" ref={scroll}>
        <div className="timeline-content" style={{ width: width + label }}>
          <div className="ruler-row" style={{ gridTemplateColumns: `${label}px ${width}px` }}>
            <div className="ruler-label">{p.project.settings.fps} FPS</div>
            <div className="ruler" {...scrubProps}>
              {Array.from(
                { length: Math.min(2000, Math.ceil(width / zoom / tick) + 1) },
                (_, i) => (
                  <span className="ruler-tick" key={i} style={{ left: i * tick * zoom }}>
                    {format(i * tick)}
                  </span>
                ),
              )}
              <div className="ruler-playhead" style={{ left: p.time * zoom }}><span /></div>
            </div>
          </div>
          {p.project.tracks.map((t, index) => (
            <div className={`track-row ${t.locked ? "locked" : ""}`} key={t.id} style={{ gridTemplateColumns: `${label}px ${width}px` }}>
              <div className="track-name">
                <small className="layer-number">{t.type === "video" ? `V${index + 1}` : t.type === "audio" ? "A" : "T"}</small>
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
                  const asset = p.project.assets.find((a) => a.id === c.assetId);
                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Clipe ${c.name}`}
                      aria-pressed={p.selected.includes(c.id)}
                      key={c.id}
                      className={`clip clip-${t.type} ${p.selected.includes(c.id) ? "selected" : ""}`}
                      style={{ left: c.start * zoom, width: Math.max(4, c.duration * zoom) }}
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
                      {asset?.thumbnail && <div className="clip-film" style={{ backgroundImage: `url(${asset.thumbnail})` }} />}
                      {asset?.peaks && (
                        <svg className="clip-wave" viewBox="0 0 160 40" preserveAspectRatio="none" aria-hidden="true">
                          {asset.peaks.map((peak, i) => (
                            <line key={i} x1={i} x2={i} y1={20 - peak * 20} y2={20 + peak * 20} />
                          ))}
                        </svg>
                      )}
                      <strong>{c.name}</strong>
                      <small>{formatDuration(c.duration)}</small>
                      <button className="trim-handle start" aria-label={`Cortar início de ${c.name}`} disabled={t.locked} onPointerDown={(e) => start(e, c, !!t.locked, "start")} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
                      <button className="trim-handle end" aria-label={`Cortar final de ${c.name}`} disabled={t.locked} onPointerDown={(e) => start(e, c, !!t.locked, "end")} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
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
        <span>{p.selected.length ? `${p.selected.length} selecionado(s)` : "Selecione um clipe"}</span>
        <span>Arraste para mover · bordas para aparar · Shift: múltipla · Alt: ignora encaixe · Espaço: reproduzir</span>
      </div>
    </section>
  );
}
function format(n: number) {
  return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
}
function formatDuration(n: number) {
  if (n < 60) return `${n.toFixed(1)} s`;
  return format(n);
}
