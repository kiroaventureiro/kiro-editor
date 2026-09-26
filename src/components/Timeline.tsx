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

export type TimelineMode = "video" | "text" | "audio" | undefined;

interface Props {
  project: KiroProject;
  selected: string[];
  time: number;
  mode: TimelineMode;
  onMode: (mode: TimelineMode) => void;
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
  onAddText: () => void;
}

type DragState = {
  id: string;
  sourceTrackId: string;
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
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 240;
const RULER_MIN_LABEL_GAP = 72;
const CANVAS_SELECT_EVENT = "kiro-select-clip";

export default function Timeline(p: Props) {
  const [zoom, setZoom] = useState(55);
  const [snapping, setSnapping] = useState(true);
  const [ripple, setRipple] = useState(false);
  const [viewport, setViewport] = useState(900);
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null);

  const scroll = useRef<HTMLDivElement>(null);
  const scrub = useRef<number | null>(null);
  const drag = useRef<DragState | null>(null);
  const dragVisualRef = useRef<DragVisual | null>(null);
  const autoFitDone = useRef(false);
  const projectId = useRef("");

  const total = projectDuration(p.project);
  const label = 210;
  const available = Math.max(260, viewport - label - 18);
  const width = Math.max(available, Math.max(1, total) * zoom);
  const fitZoom = Math.max(
    MIN_ZOOM,
    Math.min(MAX_ZOOM, available / Math.max(1, total)),
  );
  const tick = chooseRulerStep(zoom);

  const selectedClip = p.project.tracks
    .flatMap((t) => t.clips)
    .find((c) => p.selected.includes(c.id));
  const sourceTrack = selectedClip
    ? p.project.tracks.find((t) => t.clips.some((c) => c.id === selectedClip.id))
    : undefined;
  const compatibleTracks = selectedClip
    ? p.project.tracks.filter((t) => t.type === selectedClip.type && !t.locked)
    : [];

  const orderedTracks = [...p.project.tracks].sort((a, b) => {
    const rank = (track: Track) =>
      track.type === "video" || track.type === "overlay"
        ? 0
        : track.type === "text"
          ? 1
          : 2;
    const diff = rank(a) - rank(b);
    if (diff) return diff;
    return p.project.tracks.indexOf(a) - p.project.tracks.indexOf(b);
  });

  const primaryVideo = orderedTracks.find((track) => track.type === "video");
  const visibleTracks = orderedTracks.filter((track) => {
    if (!p.mode) return true;
    if (p.mode === "video")
      return track.type === "video" || track.type === "overlay";
    if (track.id === primaryVideo?.id) return true;
    return track.type === p.mode;
  });

  const setVisual = (visual: DragVisual | null) => {
    dragVisualRef.current = visual;
    setDragVisual(visual);
  };

  const clearSelection = () => {
    const clips = p.project.tracks
      .flatMap((track) => track.clips)
      .filter((clip) => p.selected.includes(clip.id));
    clips.forEach((clip) => p.onSelect(clip, true));
    p.onMode(undefined);
  };

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
      p.onMode(undefined);
    }
  }, [p.project.id, p.onMode]);

  useEffect(() => {
    if (!selectedClip) return;
    if (selectedClip.type === "text") p.onMode("text");
    else if (selectedClip.type === "audio") p.onMode("audio");
    else p.onMode("video");
  }, [selectedClip?.id, selectedClip?.type, p.onMode]);

  useEffect(() => {
    const handleCanvasSelection = (event: Event) => {
      const clipId = (event as CustomEvent<string>).detail;
      const clip = p.project.tracks
        .flatMap((track) => track.clips)
        .find((candidate) => candidate.id === clipId);
      if (!clip) {
        if (!clipId) clearSelection();
        return;
      }
      const keepTime = p.time;
      p.onSelect(clip, false);
      p.onSeek(keepTime);
    };
    window.addEventListener(CANVAS_SELECT_EVENT, handleCanvasSelection as EventListener);
    return () =>
      window.removeEventListener(
        CANVAS_SELECT_EVENT,
        handleCanvasSelection as EventListener,
      );
  }, [p.project, p.time, p.selected, p.onSelect, p.onSeek, p.onMode]);

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
    setZoom((value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value + delta)));

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
      clearSelection();
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
    const track = p.project.tracks.find((t) =>
      t.clips.some((clip) => clip.id === c.id),
    );
    if (!track) return;

    p.onSelect(c, e.shiftKey || e.metaKey || e.ctrlKey);
    p.onBegin();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: c.id,
      sourceTrackId: track.id,
      x: e.clientX,
      start: c.start,
      duration: c.duration,
      edge,
    };
    setVisual({
      id: c.id,
      trackId: track.id,
      start: c.start,
      duration: c.duration,
      snapped: false,
      mode:
        edge === "start"
          ? "trim-start"
          : edge === "end"
            ? "trim-end"
            : "move",
    });
  };

  const isContiguousTrack = (track: Track) => {
    if (track.clips.length < 2) return false;
    const ordered = [...track.clips].sort((a, b) => a.start - b.start);
    const tolerance = Math.max(EPS, 1 / p.project.settings.fps + EPS);
    return ordered.every((clip, index) => {
      if (!index) return true;
      const previous = ordered[index - 1];
      return (
        Math.abs(clip.start - (previous.start + previous.duration)) <= tolerance
      );
    });
  };

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
        (c) =>
          start < c.start + c.duration - EPS &&
          start + duration > c.start + EPS,
      );

    const direct = Math.max(0, proposed);
    if (!collides(direct)) return direct;

    const options = [
      0,
      ...others.map((c) => c.start + c.duration),
      ...others.map((c) => Math.max(0, c.start - duration)),
    ]
      .filter(
        (value, index, all) =>
          all.findIndex((n) => Math.abs(n - value) < EPS) === index,
      )
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
      return Math.max(
        previousEnd,
        Math.min(value, clip.start + clip.duration - EPS),
      );
    }
    const nextStart = others
      .filter((c) => c.start >= clip.start + clip.duration - EPS)
      .reduce((min, c) => Math.min(min, c.start), Number.POSITIVE_INFINITY);
    return Math.min(value, nextStart);
  };

  const trackUnderPointer = (x: number, y: number, clipType: Clip["type"]) => {
    const element = document
      .elementsFromPoint(x, y)
      .find((node) => node instanceof HTMLElement && node.matches(".track-row[data-track-id]"));
    if (!(element instanceof HTMLElement)) return undefined;
    const id = element.dataset.trackId;
    const track = p.project.tracks.find((candidate) => candidate.id === id);
    if (!track || track.locked || track.type !== clipType) return undefined;
    return track;
  };

  const move = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();

    const source = p.project.tracks.find((track) => track.id === d.sourceTrackId);
    const clip = source?.clips.find((candidate) => candidate.id === d.id);
    if (!source || !clip) return;

    const delta = (e.clientX - d.x) / zoom;
    const target = d.start + (d.edge === "end" ? d.duration : 0) + delta;
    let next =
      snapping && !e.altKey
        ? snap(target, candidates, 8 / zoom, p.project.settings.fps)
        : snap(target, [], 0, p.project.settings.fps);
    let snapped = Math.abs(next - target) > EPS;

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

      const hoveredTrack = trackUnderPointer(e.clientX, e.clientY, clip.type);
      if (hoveredTrack && hoveredTrack.id !== source.id) {
        const freeStart = nearestFreeStart(
          hoveredTrack,
          d.id,
          Math.max(0, next),
          d.duration,
        );
        setVisual({
          id: d.id,
          trackId: hoveredTrack.id,
          start: freeStart,
          duration: d.duration,
          snapped: snapped || Math.abs(freeStart - next) > EPS,
          mode: "move",
        });
        return;
      }

      if (isContiguousTrack(source)) {
        const reorderedStart = reorderContiguousTrack(
          source,
          d.id,
          next,
          d.duration,
        );
        if (reorderedStart !== null) {
          setVisual({
            id: d.id,
            trackId: source.id,
            start: reorderedStart,
            duration: d.duration,
            snapped: true,
            mode: "move",
          });
        }
        return;
      }

      const freeStart = nearestFreeStart(source, d.id, next, d.duration);
      if (Math.abs(freeStart - next) > EPS) snapped = true;
      next = freeStart;
      setVisual({
        id: d.id,
        trackId: source.id,
        start: next,
        duration: d.duration,
        snapped,
        mode: "move",
      });
    } else {
      const constrained = constrainTrim(source, d.id, d.edge, next);
      if (Math.abs(constrained - next) > EPS) snapped = true;
      next = constrained;
      const start = d.edge === "start" ? next : clip.start;
      const duration =
        d.edge === "start"
          ? Math.max(EPS, clip.start + clip.duration - next)
          : Math.max(EPS, next - clip.start);
      setVisual({
        id: d.id,
        trackId: source.id,
        start,
        duration,
        snapped,
        mode: d.edge === "start" ? "trim-start" : "trim-end",
      });
    }

    p.onMove(d.id, next, d.edge);
  };

  const end = () => {
    const d = drag.current;
    const visual = dragVisualRef.current;
    if (!d) return;

    if (!d.edge && visual && visual.trackId !== d.sourceTrackId) {
      const source = p.project.tracks.find((track) => track.id === d.sourceTrackId);
      const target = p.project.tracks.find((track) => track.id === visual.trackId);
      const clip = source?.clips.find((candidate) => candidate.id === d.id);
      if (source && target && clip && !target.locked && target.type === clip.type) {
        p.onTrack(source.id, {
          clips: source.clips.filter((candidate) => candidate.id !== clip.id),
        });
        p.onTrack(target.id, {
          clips: [...target.clips, { ...clip, start: visual.start }].sort(
            (a, b) => a.start - b.start,
          ),
        });
      }
    }

    drag.current = null;
    setVisual(null);
    p.onEnd();
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
            <Scissors size={16} />
            <span>Dividir</span>
          </button>
          <button onClick={p.onDuplicate} disabled={!p.selected.length} title="Duplicar seleção">
            <Copy size={16} />
            <span>Duplicar</span>
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
          <button className="zoom-step" aria-label="Diminuir zoom" title="Diminuir zoom" onClick={() => changeZoom(-Math.max(0.1, Math.max(zoom, 0.5) * 0.18))}>
            <Minus size={15} />
          </button>
          <label className="zoom" title="Zoom da linha do tempo">
            <span>Zoom</span>
            <input aria-label="Zoom da timeline" type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
          <button className="zoom-step" aria-label="Aumentar zoom" title="Aumentar zoom" onClick={() => changeZoom(Math.max(0.1, Math.max(zoom, 0.5) * 0.18))}>
            <Plus size={15} />
          </button>
          <button className="fit-timeline" onClick={fitAll} title="Mostrar o projeto inteiro na timeline">Ver tudo</button>
          {(p.mode === "video" || !p.mode) && (
            <button onClick={() => p.onAddTrack("video")} title="Nova camada de vídeo">
              <Plus size={16} /><span>Camada</span>
            </button>
          )}
          {(p.mode === "text" || !p.mode) && (
            <button onClick={p.onAddText} title="Adicionar texto">
              <Plus size={16} /><span>Texto</span>
            </button>
          )}
          {(p.mode === "audio" || !p.mode) && (
            <button onClick={() => p.onAddTrack("audio")} title="Nova camada de áudio">
              <Plus size={16} /><span>Áudio</span>
            </button>
          )}
        </div>
      </div>

      <div className="timeline-scroll" ref={scroll}>
        <div className="timeline-content" style={{ width: width + label }}>
          <div className="ruler-row" style={{ gridTemplateColumns: `${label}px ${width}px` }}>
            <div className="ruler-label">{p.project.settings.fps} FPS</div>
            <div className="ruler" {...scrubProps}>
              {Array.from(
                { length: Math.min(2000, Math.ceil(width / zoom / tick) + 1) },
                (_, i) => {
                  const at = i * tick;
                  return (
                    <span className={`ruler-tick ${i === 0 ? "first" : ""}`} key={i} style={{ left: at * zoom }}>
                      {formatRulerTime(at)}
                    </span>
                  );
                },
              )}
              <div className="ruler-playhead" style={{ left: p.time * zoom }}><span /></div>
            </div>
          </div>

          {visibleTracks.map((t) => {
            const index = orderedTracks.findIndex((track) => track.id === t.id);
            const code = trackCode(orderedTracks, index, t.type);
            const kind = t.type === "video" ? "▶" : t.type === "audio" ? "♪" : "T";
            return (
              <div
                className={`track-row ${t.locked ? "locked" : ""} ${dragVisual?.trackId === t.id ? "drop-active" : ""}`}
                key={t.id}
                data-track-id={t.id}
                data-track-type={t.type}
                style={{ gridTemplateColumns: `${label}px ${width}px` }}
              >
                <div className="track-name" data-track-type={t.type}>
                  <span className="track-kind" aria-hidden="true">{kind}</span>
                  <div className="track-title-block">
                    <strong title={t.name}>{t.name}</strong>
                    <small>{code}</small>
                  </div>
                  <div className="track-actions">
                    <button
                      aria-label={`${t.type === "text" ? (t.muted ? "Mostrar" : "Ocultar") : t.muted ? "Ativar" : "Silenciar"} ${t.name}`}
                      title={t.type === "text" ? (t.muted ? "Mostrar trilha" : "Ocultar trilha") : t.muted ? "Ativar áudio" : "Silenciar áudio"}
                      onClick={() => p.onTrack(t.id, { muted: !t.muted })}
                    >
                      {t.type === "text" ? (t.muted ? <EyeOff size={14} /> : <Eye size={14} />) : t.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                    <button
                      aria-label={`${t.locked ? "Desbloquear" : "Bloquear"} ${t.name}`}
                      title={t.locked ? "Desbloquear trilha" : "Bloquear trilha"}
                      onClick={() => p.onTrack(t.id, { locked: !t.locked })}
                    >
                      {t.locked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                  </div>
                </div>

                <div className="track-lane" {...scrubProps}>
                  {dragVisual?.trackId === t.id && dragVisual.mode === "move" && (
                    <div
                      className={`clip-drop-slot ${dragVisual.snapped ? "snapped" : ""}`}
                      style={{ left: dragVisual.start * zoom, width: Math.max(4, dragVisual.duration * zoom) }}
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
                        data-clip-id={c.id}
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
            );
          })}
        </div>
      </div>

      <div className="timeline-footer">
        <span>
          {dragVisual
            ? dragVisual.trackId !== drag.current?.sourceTrackId
              ? "Mover para outra camada — solte para transferir"
              : dragVisual.snapped
                ? "Encaixe encontrado — solte para posicionar"
                : "Movendo clipe — solte na posição desejada"
            : p.selected.length
              ? `${p.selected.length} selecionado(s)`
              : "Nenhum item selecionado"}
        </span>
        <span>
          {!p.mode
            ? "Todas as trilhas"
            : p.mode === "video"
              ? "Vídeo principal + camadas de vídeo"
              : p.mode === "text"
                ? "Vídeo principal + textos"
                : "Vídeo principal + áudios"}
          {" · "}Alt ignora encaixe
        </span>
      </div>
    </section>
  );
}

function chooseRulerStep(pxPerSecond: number) {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
  return steps.find((seconds) => seconds * pxPerSecond >= RULER_MIN_LABEL_GAP) ?? steps[steps.length - 1];
}

function formatRulerTime(n: number) {
  const seconds = Math.max(0, Math.round(n));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function trackCode(tracks: Track[], index: number, type: Track["type"]) {
  const ordinal = tracks.slice(0, index + 1).filter((t) => t.type === type).length;
  const prefix = type === "video" ? "V" : type === "audio" ? "A" : "T";
  return `${prefix}${ordinal}`;
}

function formatDuration(n: number) {
  if (n < 60) return `${n.toFixed(1)} s`;
  return formatRulerTime(n);
}
