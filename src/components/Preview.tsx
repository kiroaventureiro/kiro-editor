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
import { Composition } from "../editor/engine";
import { clamp, projectDuration } from "../editor/operations";

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

function formatTime(value: number) {
  const safe = Math.max(0, Number.isFinite(value) ? value : 0);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
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

  const toggle = () => {
    if (playing) onPlaying(false);
    else {
      if (time >= duration) onTime(0);
      onPlaying(true);
    }
  };

  const movable = !!selectedClip && selectedClip.type !== "audio";
  const factor =
    previewQuality / Math.min(project.settings.width, project.settings.height);

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
          {movable && (
            <b className="canvas-hint">
              Arraste no canvas para posicionar {selectedClip?.type === "text" ? "o texto" : "o vídeo"}
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
        <div className="canvas-shell" data-aspect={project.settings.aspectRatio}>
          <canvas
            ref={canvas}
            width={Math.round(project.settings.width * factor)}
            height={Math.round(project.settings.height * factor)}
            aria-label="Prévia da montagem"
            className={movable ? "canvas-movable" : ""}
            style={{
              aspectRatio: project.settings.aspectRatio.replace(":", " / "),
            }}
            onPointerDown={(e) => {
              if (!movable || !selectedClip) return;
              if (playing) onPlaying(false);
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              onBegin();
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                cx: selectedClip.x ?? 0,
                cy: selectedClip.y ?? 0,
              };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              onTransform({
                x: clamp(
                  drag.current.cx +
                    ((e.clientX - drag.current.x) / rect.width) * 100,
                  -100,
                  100,
                ),
                y: clamp(
                  drag.current.cy +
                    ((e.clientY - drag.current.y) / rect.height) * 100,
                  -100,
                  100,
                ),
              });
            }}
            onPointerUp={() => {
              if (drag.current) {
                drag.current = undefined;
                onEnd();
              }
            }}
            onPointerCancel={() => {
              if (drag.current) {
                drag.current = undefined;
                onEnd();
              }
            }}
          />
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
