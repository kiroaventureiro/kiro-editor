import { SlidersHorizontal } from "lucide-react";
import type { Clip } from "../editor/types";

interface Props {
  clip?: Clip;
  disabled?: boolean;
  onChange: (patch: Partial<Clip>) => void;
  onBegin: () => void;
  onEnd: () => void;
}

const controls = [
  { label: "Brilho", key: "brightness", min: 0, max: 2, step: 0.01, fallback: 1 },
  { label: "Contraste", key: "contrast", min: 0, max: 2, step: 0.01, fallback: 1 },
  { label: "Saturação", key: "saturation", min: 0, max: 2, step: 0.01, fallback: 1 },
  { label: "Desfoque", key: "blur", min: 0, max: 20, step: 0.1, fallback: 0 },
] as const;

/** Dedicated, real-time controls backed by the editor's existing visual pipeline. */
export default function EffectsControl({ clip, disabled, onChange, onBegin, onEnd }: Props) {
  const unavailable = !clip || clip.type === "text" || !!disabled;

  return (
    <section className="effects-control" aria-label="Ajustes de imagem">
      <header className="dock-panel-heading">
        <div>
          <span className="dock-eyebrow">AJUSTES · IMAGEM</span>
          <strong><SlidersHorizontal size={14} aria-hidden="true" /> Ajustes de imagem</strong>
        </div>
        <span className="effects-selection">{clip?.name ?? "SEM SELEÇÃO"}</span>
      </header>
      <div className={`effect-control-grid ${unavailable ? "disabled" : ""}`}>
        {controls.map((item) => {
          const value = (clip?.[item.key] as number | undefined) ?? item.fallback;
          return (
            <label className="effect-control" key={item.key}>
              <span>
                <strong>{item.label}</strong>
                <output>{item.key === "blur" ? value.toFixed(1) : `${Math.round(value * 100)}%`}</output>
              </span>
              <input
                aria-label={item.label}
                type="range"
                min={item.min}
                max={item.max}
                step={item.step}
                value={value}
                disabled={unavailable}
                onPointerDown={onBegin}
                onPointerUp={onEnd}
                onPointerCancel={onEnd}
                onKeyDown={onBegin}
                onKeyUp={onEnd}
                onBlur={onEnd}
                onChange={(event) =>
                  onChange({ [item.key]: Number(event.target.value) } as Partial<Clip>)
                }
              />
            </label>
          );
        })}
        {unavailable && (
          <p className="effect-control-hint">
            Selecione um vídeo ou uma imagem na timeline para ajustar.
          </p>
        )}
      </div>
    </section>
  );
}
