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

type DragState = {
  id: string;
  x: number;
  start: number;
  duration: number;
  edge?: "start" | "end";
};

type DragVisual = {
  id: string;
  trackId: string;
  start: number;
  duration: number;
  snapped: boolean;
  mode: "move" | "trim-start" | "trim-end";
};

const EPS = 1 / 1000;

export default function Timeline(p: Props) {
  const [zoom, setZoom] = useState(55);
  const [snapping, setSnapping] = useState(true);
  const [ripple, setRipple] = useState(false);
  const [viewport, setViewport] = useState(900);
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null);

  const scroll = useRef<HTMLDivElement>(null);
  const scrub = useRef<number | null>(null);
  const drag = useRef<DragState | null>(null);
  const autoFitDone = useRef(false);
  const projectId = useRef(p.project.id);

  const total = projectDuration(p.project);
  const label = 150;
  const available = Math.max(260, viewport - label - 18);
  const width = Math.max(available, Math.max(1, total) * zoom);
  const fitZoom = Math.max(0.25, Math.min(240, available / Math.max(1, total)));
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
    if (projectId.current !== p.project.id) {
      projectId.current = p.project.id;
      autoFitDone.current = false;
    }
  }, [p.project.id]);

  // Enquadra automaticamente apenas na primeira vez em que o projeto ganha conteúdo.
  // Depois disso o zoom é totalmente manual: mover/dividir clipes nunca altera o zoom.
  useEffect(() => {
    if (!total || autoFitDone.current) return;
    autoFitDone.current = true;
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
    const track = p.project.tracks.find((t) => t.clips.some((clip) => clip.id === c.id));
    if (track) {
      setDragVisual({
        id: c.id,
        trackId: track.id,
        start: c.start,
        duration: c.duration,
        snapped: false,
        mode: edge === "start" ? "trim-start" : edge === "end" ? "trim-end" : "move",
      });
    }
  };

  const isContiguousTrack = (track: Track) => {
    if (track.clips.length < 2) return false;
    const ordered = [...track.clips].sort((a, b) => a.start - b.start);
    const tolerance = Math.max(EPS, 1 / p.project.settings.fps + EPS);
    return ordered.every((clip, index) => {
      if (!index) return true;
      const previous = ordered[index - 1];
      return Math.abs(clip.start - (previous.start + previous.duration)) <= tolerance;
    });
  };

  // Para blocos originados de cortes sequenciais, arrastar significa REORDENAR.
  // O clipe pode ir antes/depois de qualquer outro, e toda a sequência permanece sem sobreposição.
  const reorderContiguousTrack = (
    track: Track,
    id: string,
    proposedStart: number,
    duration: number,
  ) => {
    const moved = track.clips.find((c) => c.id === id);
    if (!moved) return null;

    const others = track.clips
      .filter((c) => c.id !== id)
      .sort((a, b) => a.start - b.start);
    const center = proposedStart + duration / 2;
    let index = others.findIndex((c) => center < c.start + c.duration / 2);
    if (index < 0) index = others.length;

    const ordered = [...others.slice(0, index), moved, ...others.slice(index)];
    let cursor = Math.min(...track.clips.map((c) => c.start));
    let movedStart = moved.start;
    const clips = ordered.map((clip) => {
      const start = cursor;
      if (clip.id === id) movedStart = start;
      const next = { ...clip, start };
      cursor += clip.duration;
      return next;
    });

    p.onTrack(track.id, { clips });
    return movedStart;
  };

  // Em faixas com espaços livres, mantém a posição escolhida sempre que possível.
  // Se houver colisão, escolhe o espaço válido MAIS PRÓXIMO em vez de jogar o clipe para o fim.
  const nearestFreeStart = (
    track: Track,
    id: string,
    proposed: number,
    duration: number,
  ) => {
    const others = track.clips
      .filter((c) => c.id !== id)
      .sort((a, b) => a.start - b.start);
    const collides = (start: number) =>
      others.some(
        (c) => start < c.start + c.duration - EPS && start + duration > c.start + EPS,
      );

    const direct = Math.max(0, proposed);
    if (!collides(direct)) return direct;

    const options = [
      0,
      ...others.map((c) => c.start + c.duration),
      ...others.map((c) => Math.max(0, c.start - duration)),
    ]
      .filter((value, index, all) => all.findIndex((n) => Math.abs(n - value) < EPS) === index)
      .filter((value) => !collides(value));

    if (!options.length) return direct;
    return options.reduce((best, value) =>
      Math.abs(value - proposed) < Math.abs(best - proposed) ? value : best,
    );
  };

  const constrainTrim = (
    track: Track,
    id: string,
    edge: "start" | "end",
    value: number,
  ) => {
    const clip = track.clips.find((c) => c.id === id);
    if (!clip) return value;
    const others = track.clips.filter((c) => c.id !== id);
    if (edge === "start") {
      const previousEnd = others
        .filter((c) => c.start < clip.start)
        .reduce((max, c) => Math.max(max, c.start + c.duration), 0);
      return Math.max(previousEnd, Math.min(value, clip.start + clip.duration - EPS));
    }
    const nextStart = others
      .filter((c) => c.start >= clip.start + clip.duration - EPS)
      .reduce((min, c) => Math.min(min, c.start), Number.POSITIVE_INFINITY);
    return Math.min(value, nextStart);
  };

  const move = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();

    const delta = (e.clientX - d.x) / zoom;
    const target = d.start + (d.edge === "end" ? d.duration : 0) + delta;
    let next =
      snapping && !e.altKey
        ? snap(target, candidates, 8 / zoom, p.project.settings.fps)
        : snap(target, [], 0, p.project.settings.fps);
    let snapped = Math.abs(next - target) > EPS;

    const track = p.project.tracks.find((t) => t.clips.some((c) => c.id === d.id));

    if (!d.edge) {
      if (snapping && !e.altKey) {
        const snappedEnd =
          snap(
            target + d.duration,
            candidates,
            8 / zoom,
            p.project.settings.fps,
          ) - d.duration;
        if (Math.abs(snappedEnd - target) < Math.abs(next - target)) {
          next = Math.max(0, snappedEnd);
          snapped = true;
        }
      }

      if (track && isContiguousTrack(track)) {
        const reorderedStart = reorderContiguousTrack(track, d.id, next, d.duration);
        if (reorderedStart !== null) {
          setDragVisual({
            id: d.id,
            trackId: track.id,
            start: reorderedStart,
            duration: d.duration,
            snapped: true,
            mode: "move",
          });
        }
        return;
      }

      if (track) {
        const freeStart = nearestFreeStart(track, d.id, next, d.duration);
        if (Math.abs(freeStart - next) > EPS) snapped = true;
        next = freeStart;
        setDragVisual({
          id: d.id,
          trackId: track.id,
          start: next,
          duration: d.duration,
          snapped,
          mode: "move",
        });
      }
    } else if (track) {
      const constrained = constrainTrim(track, d.id, d.edge, next);
      if (Math.abs(constrained - next) > EPS) snapped = true;
      next = constrained;
      const clip = track.clips.find((c) => c.id === d.id);
      if (clip) {
        const start = d.edge === "start" ? next : clip.start;
        const duration =
          d.edge === "start"
            ? Math.max(EPS, clip.start + clip.duration - next)
            : Math.max(EPS, next - clip.start);
        setDragVisual({
          id: d.id,
          trackId: track.id,
          start,
          duration,
          snapped,
          mode: d.edge === "start" ? "trim-start" : "trim-end",
        });
      }
    }

    p.onMove(d.id, next, d.edge);
  };

  const end = () => {
    if (drag.current) {
      drag.current = null;
      setDragVisual(null);
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
          <label className="zoom" title="O zoom só muda por estes controles">
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
            <div
              className={`track-row ${t.locked ? "locked" : ""} ${dragVisual?.trackId === t.id ? "drop-active" : ""}`}
              key={t.id}
              style={{ gridTemplateColumns: `${label}px ${width}px` }}
            >
              <div className="track-name">
                <small className="layer-number">{t.type === "video" ? `V${index + 1}` : t.type === "audio" ? "A" : "T"}</small>
                <strong title={t.name}>{t.name}</strong>
                <div>
                  <button
                    aria-label={`${t.type === "text" ? (t.muted ? "Mostrar" : "Ocultar") : (t.muted ? "Ativar" : "Silenciar")} ${t.name}`}
                    onClick={() => p.onTrack(t.id, { muted: !t.muted })}
                  >
                    {t.type === "text"
                      ? t.muted ? <EyeOff size={13} /> : <Eye size={13} />
                      : t.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
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
                {dragVisual?.trackId === t.id && dragVisual.mode === "move" && (
                  <div
                    className={`clip-drop-slot ${dragVisual.snapped ? "snapped" : ""}`}
                    style={{
                      left: dragVisual.start * zoom,
                      width: Math.max(4, dragVisual.duration * zoom),
                    }}
                    aria-hidden="true"
                  >
                    <i />
                  </div>
                )}
                {t.clips.map((c) => {
                  const asset = p.project.assets.find((a) => a.id === c.assetId);
                  const dragging = dragVisual?.id === c.id;
                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Clipe ${c.name}`}
                      aria-pressed={p.selected.includes(c.id)}
                      key={c.id}
                      className={`clip clip-${t.type} ${p.selected.includes(c.id) ? "selected" : ""} ${dragging ? "dragging" : ""}`}
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
                      {asset?.thumbnail && (
                        <div className="clip-film" style={{ backgroundImage: `url(${asset.thumbnail})` }} />
                      )}
                      {asset?.peaks && (
                        <svg className="clip-wave" viewBox="0 0 160 40" preserveAspectRatio="none" aria-hidden="true">
                          {asset.peaks.map((peak, i) => (
                            <line key={i} x1={i} x2={i} y1={20 - peak * 20} y2={20 + peak * 20} />
                          ))}
                        </svg>
                      )}
                      <strong>{c.name}</strong>
                      <small>{formatDuration(c.duration)}</small>
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
          {dragVisual
            ? dragVisual.snapped
              ? "Encaixe encontrado — solte para posicionar"
              : "Movendo clipe — solte na posição desejada"
            : p.selected.length
              ? `${p.selected.length} selecionado(s)`
              : "Selecione um clipe"}
        </span>
        <span>Arraste para reordenar cortes · guia verde mostra o encaixe · Alt ignora encaixe · Espaço reproduz</span>
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
