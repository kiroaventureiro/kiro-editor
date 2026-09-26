import {
  Crop,
  Focus,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Clip, KiroProject } from "../editor/types";
import { Composition, visualTrackStack } from "../editor/engine";
import { activeAt, clamp, projectDuration } from "../editor/operations";

interface Props {
  project: KiroProject;
  time: number;
  playing: boolean;
  onTime: (time: number) => void;
  onPlaying: (playing: boolean) => void;
  focus: boolean;
  onFocus: () => void;
  selectedClip?: Clip;
  onTransform: (patch: Partial<Clip>) => void;
  onBegin: () => void;
  onEnd: () => void;
}

const CANVAS_SELECT_EVENT = "kiro-select-clip";

function formatTime(value: number) {
  const safe = Math.max(0, Number.isFinite(value) ? value : 0);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function clipBox(clip: Clip) {
  const scale = clamp(clip.scale ?? 1, 0.08, 4);
  if (clip.type === "text") {
    const lines = (clip.text ?? clip.name).split("\n");
    const longest = Math.max(1, ...lines.map((line) => line.length));
    const fontSize = clip.fontSize ?? 6;
    return {
      width: clamp(longest * fontSize * 0.62 * scale, 12, 160),
      height: clamp(lines.length * fontSize * 1.55 * scale, 7, 120),
    };
  }
  return {
    width: 100 * scale,
    height: 100 * scale,
  };
}

export default function Preview({
  project,
  time,
  playing,
  onTime,
  onPlaying,
  focus,
  onFocus,
  selectedClip,
  onTransform,
  onBegin,
  onEnd,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    shell = useRef<HTMLDivElement>(null),
    engine = useRef<Composition | undefined>(undefined),
    seekVersion = useRef(0),
    previousVolume = useRef(1);
  const latest = useRef({ project, time, playing, onTime, onPlaying });
  latest.current = { project, time, playing, onTime, onPlaying };

  const [status, setStatus] = useState(""),
    [ready, setReady] = useState(false),
    [volume, setVolume] = useState(1),
    [fitView, setFitView] = useState(true);

  const drag = useRef<
    { x: number; y: number; cx: number; cy: number } | undefined
  >(undefined);
  const resize = useRef<
    { distance: number; scale: number; cx: number; cy: number } | undefined
  >(undefined);

  const duration = projectDuration(project);
  const previewQuality = focus ? 1080 : 720;
  const resourceKey = JSON.stringify(
    project.tracks
      .flatMap((t) => t.clips)
      .map((c) => [
        c.id,
        c.assetId,
        project.assets.find((a) => a.id === c.assetId)?.path,
      ]),
  );

  const activeVisualClips = visualTrackStack(project.tracks).flatMap((track) =>
    track.clips
      .filter(
        (clip) =>
          clip.type !== "audio" &&
          activeAt(clip, time) &&
          !(track.type === "text" && track.muted),
      )
      .map((clip) => ({ clip, track })),
  );

  const movable = !!selectedClip && selectedClip.type !== "audio";
  const selectedVisible =
    movable && !!selectedClip && activeAt(selectedClip, time);
  const selectedBox = selectedVisible && selectedClip ? clipBox(selectedClip) : null;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setStatus("Preparando prévia…");
    const next = new Composition(latest.current.project, canvas.current!);
    engine.current = next;
    void next
      .prepare()
      .then(async () => {
        if (cancelled) return;
        await next.seek(latest.current.time);
        next.setMonitorVolume(volume);
        if (!cancelled) {
          setReady(true);
          setStatus("");
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setStatus(e.message);
          latest.current.onPlaying(false);
        }
      });
    return () => {
      cancelled = true;
      next.dispose();
    };
  }, [resourceKey]);

  useEffect(() => {
    engine.current?.update(project);
    if (!ready || playing) return;
    const version = ++seekVersion.current;
    void engine.current
      ?.seek(time)
      .then(() => {
        if (version === seekVersion.current) setStatus("");
      })
      .catch((e: Error) => {
        if (version === seekVersion.current) setStatus(e.message);
      });
  }, [project, time, playing, ready, previewQuality]);

  useEffect(() => {
    if (!ready) return;
    let frame = 0,
      previous = performance.now(),
      lastPublished = 0;
    const draw = (now: number) => {
      const state = latest.current;
      if (state.playing) {
        const next = Math.min(
          projectDuration(state.project),
          state.time + (now - previous) / 1000,
        );
        state.time = next;
        try {
          engine.current?.sync(next, true);
        } catch (e) {
          setStatus(e instanceof Error ? e.message : "Falha na reprodução.");
          state.onPlaying(false);
        }
        if (
          now - lastPublished > 30 ||
          next >= projectDuration(state.project)
        ) {
          state.onTime(next);
          lastPublished = now;
        }
        if (next >= projectDuration(state.project)) state.onPlaying(false);
        engine.current?.draw(
          Math.min(
            next,
            Math.max(
              0,
              projectDuration(state.project) - 1 / state.project.settings.fps,
            ),
          ),
        );
      } else {
        engine.current?.pause();
      }
      previous = now;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    engine.current?.setMonitorVolume(volume);
    void engine.current?.enableAudio(playing).catch((e: Error) => {
      setStatus(e.message);
      onPlaying(false);
    });
  }, [playing, ready, volume, onPlaying]);

  const factor =
    previewQuality / Math.min(project.settings.width, project.settings.height);

  const toggle = () => {
    if (playing) onPlaying(false);
    else {
      if (time >= duration) onTime(0);
      onPlaying(true);
    }
  };

  const toggleMute = () => {
    if (volume > 0) {
      previousVolume.current = volume;
      setVolume(0);
    } else {
      setVolume(previousVolume.current || 1);
    }
  };

  const resetFraming = () => {
    if (!movable) return;
    onBegin();
    onTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    onEnd();
  };

  const pickClip = (clientX: number, clientY: number) => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return undefined;
    const px = ((clientX - rect.left) / rect.width) * 100;
    const py = ((clientY - rect.top) / rect.height) * 100;

    return [...activeVisualClips]
      .reverse()
      .find(({ clip }) => {
        const box = clipBox(clip);
        const centerX = 50 + (clip.x ?? 0);
        const centerY = 50 + (clip.y ?? 0);
        const angle = -((clip.rotation ?? 0) * Math.PI) / 180;
        const dx = px - centerX;
        const dy = py - centerY;
        const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
        const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
        return Math.abs(rx) <= box.width / 2 && Math.abs(ry) <= box.height / 2;
      })?.clip;
  };

  const selectFromCanvas = (clientX: number, clientY: number) => {
    const hit = pickClip(clientX, clientY);
    if (!hit) {
      window.dispatchEvent(
        new CustomEvent<string>(CANVAS_SELECT_EVENT, { detail: "" }),
      );
      return;
    }
    if (hit.id !== selectedClip?.id) {
      window.dispatchEvent(
        new CustomEvent<string>(CANVAS_SELECT_EVENT, { detail: hit.id }),
      );
    }
  };

  const beginMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!selectedClip || !selectedVisible) return;
    if (playing) onPlaying(false);
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onBegin();
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      cx: selectedClip.x ?? 0,
      cy: selectedClip.y ?? 0,
    };
  };

  const moveSelected = (e: React.PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    onTransform({
      x: clamp(
        drag.current.cx + ((e.clientX - drag.current.x) / rect.width) * 100,
        -100,
        100,
      ),
      y: clamp(
        drag.current.cy + ((e.clientY - drag.current.y) / rect.height) * 100,
        -100,
        100,
      ),
    });
  };

  const endMove = () => {
    if (!drag.current) return;
    drag.current = undefined;
    onEnd();
  };

  const beginResize = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!selectedClip || !selectedVisible) return;
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (playing) onPlaying(false);
    const centerX = rect.left + rect.width * (0.5 + (selectedClip.x ?? 0) / 100);
    const centerY = rect.top + rect.height * (0.5 + (selectedClip.y ?? 0) / 100);
    onBegin();
    resize.current = {
      distance: Math.max(8, Math.hypot(e.clientX - centerX, e.clientY - centerY)),
      scale: selectedClip.scale ?? 1,
      cx: centerX,
      cy: centerY,
    };
  };

  const resizeSelected = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!resize.current) return;
    const distance = Math.hypot(
      e.clientX - resize.current.cx,
      e.clientY - resize.current.cy,
    );
    const ratio = distance / resize.current.distance;
    onTransform({ scale: clamp(resize.current.scale * ratio, 0.08, 4) });
  };

  const endResize = () => {
    if (!resize.current) return;
    resize.current = undefined;
    onEnd();
  };

  return (
    <section
      className={`preview-wrap canvas-module ${fitView ? "canvas-fit-view" : "canvas-fill-view"}`}
    >
      <div className="preview-heading canvas-module-heading">
        <div className="canvas-meta">
          <strong>Canvas</strong>
          <i />
          <span>{project.settings.width} × {project.settings.height}</span>
          <i />
          <span>{project.settings.fps} fps</span>
          {activeVisualClips.length > 1 && (
            <b className="canvas-layer-count">
              {activeVisualClips.length} camadas visíveis
            </b>
          )}
          {movable && (
            <b className="canvas-hint">
              Clique para selecionar · arraste para mover · use os cantos para redimensionar
            </b>
          )}
        </div>
        <div className="canvas-actions">
          <button
            className={`canvas-fit-toggle ${fitView ? "active" : ""}`}
            aria-label={fitView ? "Modo Ajustar" : "Modo Preencher"}
            title={fitView ? "Visualização: Ajustar" : "Visualização: Preencher"}
            onClick={() => setFitView((value) => !value)}
          >
            <Focus size={15} />
            <span>{fitView ? "Ajustar" : "Preencher"}</span>
          </button>
          <button
            aria-label={focus ? "Sair do foco" : "Expandir canvas"}
            title={focus ? "Sair do foco" : "Expandir canvas"}
            onClick={onFocus}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div className={`preview-stage canvas-monitor ${!duration ? "canvas-monitor-empty" : ""}`}>
        <div
          ref={shell}
          className="canvas-shell"
          data-aspect={project.settings.aspectRatio}
        >
          <canvas
            ref={canvas}
            width={Math.round(project.settings.width * factor)}
            height={Math.round(project.settings.height * factor)}
            aria-label="Prévia da montagem"
            className={activeVisualClips.length ? "canvas-selectable" : ""}
            style={{
              aspectRatio: project.settings.aspectRatio.replace(":", " / "),
            }}
            onPointerDown={(e) => {
              if (playing) onPlaying(false);
              selectFromCanvas(e.clientX, e.clientY);
            }}
          />

          {selectedBox && selectedClip && (
            <div
              className={`canvas-selection-box canvas-selection-${selectedClip.type}`}
              style={{
                left: `${50 + (selectedClip.x ?? 0)}%`,
                top: `${50 + (selectedClip.y ?? 0)}%`,
                width: `${selectedBox.width}%`,
                height: `${selectedBox.height}%`,
                transform: `translate(-50%, -50%) rotate(${selectedClip.rotation ?? 0}deg)`,
              }}
              aria-label={`Objeto selecionado: ${selectedClip.name}`}
              onPointerDown={beginMove}
              onPointerMove={moveSelected}
              onPointerUp={endMove}
              onPointerCancel={endMove}
            >
              <span className="canvas-selection-label">{selectedClip.name}</span>
              {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                <button
                  key={corner}
                  type="button"
                  className={`canvas-resize-handle ${corner}`}
                  aria-label="Redimensionar objeto"
                  title="Arraste para aumentar ou diminuir"
                  onPointerDown={beginResize}
                  onPointerMove={resizeSelected}
                  onPointerUp={endResize}
                  onPointerCancel={endResize}
                />
              ))}
            </div>
          )}
        </div>

        {(!duration || status) && (
          <div className="preview-message">
            <strong>{status || "Sua próxima história começa aqui"}</strong>
            {!duration && (
              <span>Importe arquivos e adicione suas cenas à timeline.</span>
            )}
          </div>
        )}
      </div>

      <div className="transport canvas-transport">
        <div className="canvas-time-readout">
          <strong>{formatTime(time)}</strong>
          <span>/ {formatTime(duration)}</span>
        </div>

        <div className="canvas-playback-controls">
          <button
            aria-label="Voltar um quadro"
            onClick={() => onTime(Math.max(0, time - 1 / project.settings.fps))}
          >
            <SkipBack size={17} />
          </button>
          <button
            className="play primary"
            aria-label={playing ? "Pausar" : "Reproduzir montagem"}
            disabled={!ready || !duration}
            onClick={toggle}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            aria-label="Avançar um quadro"
            onClick={() =>
              onTime(Math.min(duration, time + 1 / project.settings.fps))
            }
          >
            <SkipForward size={17} />
          </button>
        </div>

        <div className="canvas-view-controls">
          <button
            aria-label={volume > 0 ? "Silenciar prévia" : "Ativar áudio da prévia"}
            title={volume > 0 ? "Silenciar" : "Ativar áudio"}
            className={volume === 0 ? "is-muted" : ""}
            onClick={toggleMute}
          >
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            className="canvas-volume-slider"
            aria-label="Volume da prévia"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
          <span className="canvas-aspect-chip">{project.settings.aspectRatio}</span>
          <button
            aria-label="Reenquadrar mídia selecionada"
            title="Reenquadrar mídia"
            disabled={!movable}
            onClick={resetFraming}
          >
            <Crop size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
