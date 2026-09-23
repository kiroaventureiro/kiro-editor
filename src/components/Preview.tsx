import { Maximize2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
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
    seekVersion = useRef(0);
  const latest = useRef({ project, time, playing, onTime, onPlaying });
  latest.current = { project, time, playing, onTime, onPlaying };
  const [status, setStatus] = useState(""),
    [ready, setReady] = useState(false),
    [quality, setQuality] = useState(540);
  const drag = useRef<
    { x: number; y: number; cx: number; cy: number } | undefined
  >(undefined);
  const duration = projectDuration(project);
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
  }, [project, time, playing, ready, quality]);
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
    if (!playing || !ready) return;
    void engine.current?.enableAudio(true).catch((e: Error) => {
      setStatus(e.message);
      onPlaying(false);
    });
  }, [playing, ready, onPlaying]);
  const toggle = () => {
    if (playing) onPlaying(false);
    else {
      if (time >= duration) onTime(0);
      onPlaying(true);
    }
  };
  const factor =
    quality / Math.min(project.settings.width, project.settings.height);
  return (
    <section className="preview-wrap">
      <div className="preview-heading">
        <span>
          MONTAGEM <i /> {project.settings.aspectRatio}
        </span>
        <div>
          <select
            aria-label="Qualidade da prévia"
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          >
            <option value={360}>Prévia leve</option>
            <option value={540}>Prévia normal</option>
            <option value={1080}>Prévia alta</option>
          </select>
          <button
            aria-label={focus ? "Sair do foco" : "Modo foco"}
            onClick={onFocus}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      <div className="preview-stage">
        <div className="canvas-shell" data-aspect={project.settings.aspectRatio}>
          <canvas
            ref={canvas}
            width={Math.round(project.settings.width * factor)}
            height={Math.round(project.settings.height * factor)}
            aria-label="Prévia da montagem"
            style={{
              aspectRatio: project.settings.aspectRatio.replace(":", " / "),
            }}
            onPointerDown={(e) => {
              if (!selectedClip || playing || selectedClip.type === "audio")
                return;
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
          <span className="canvas-label">CANVAS · {project.settings.width}×{project.settings.height}</span>
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
      <div className="transport">
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
        <label className="time-entry">
          <input
            aria-label="Posição em segundos"
            type="number"
            min={0}
            max={duration}
            step={1 / project.settings.fps}
            value={Number(time.toFixed(3))}
            onChange={(e) => onTime(clamp(Number(e.target.value), 0, duration))}
          />
          <span>/ {duration.toFixed(2)} s</span>
        </label>
      </div>
    </section>
  );
}
