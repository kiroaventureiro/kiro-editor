import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { Clip } from "../editor/types";

interface Props {
  clip?: Clip;
  disabled?: boolean;
  onChange: (patch: Partial<Clip>) => void;
  onBegin: () => void;
  onEnd: () => void;
}

type ImageTool = "image" | "framing" | "effects";

const tabs: Array<[ImageTool, string]> = [
  ["image", "Imagem"],
  ["framing", "Enquadramento"],
  ["effects", "Efeitos"],
];

export default function EffectsControl({
  clip,
  disabled,
  onChange,
  onBegin,
  onEnd,
}: Props) {
  const [tool, setTool] = useState<ImageTool>("image");
  const unavailable =
    !clip || clip.type === "text" || clip.type === "audio" || !!disabled;

  const range = (
    label: string,
    key: keyof Clip,
    min: number,
    max: number,
    step: number,
    fallback: number,
    format: (value: number) => string = (value) => String(value),
  ) => {
    const value = Number(clip?.[key] ?? fallback);
    return (
      <label className="effect-control" key={key}>
        <span>
          <strong>{label}</strong>
          <output>{format(value)}</output>
        </span>
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={unavailable}
          onPointerDown={onBegin}
          onPointerUp={onEnd}
          onPointerCancel={onEnd}
          onKeyDown={onBegin}
          onKeyUp={onEnd}
          onBlur={onEnd}
          onChange={(event) =>
            onChange({ [key]: Number(event.target.value) } as Partial<Clip>)
          }
        />
      </label>
    );
  };

  const applyPatch = (patch: Partial<Clip>) => {
    onBegin();
    onChange(patch);
    onEnd();
  };

  const selectionHint = unavailable ? (
    <p className="effect-control-hint">
      Selecione um vídeo ou uma imagem na timeline para ajustar.
    </p>
  ) : null;

  return (
    <section className="effects-control" aria-label="Ajustes de imagem">
      <header className="dock-panel-heading">
        <div className="effects-heading-copy">
          <span className="dock-eyebrow">AJUSTES VISUAIS</span>
          <strong>
            <SlidersHorizontal size={14} aria-hidden="true" /> Imagem e vídeo
          </strong>
        </div>
        <span
          className="effects-selection"
          title={clip?.name ?? "Nenhum clipe selecionado"}
          aria-label={clip?.name ? `Clipe selecionado: ${clip.name}` : "Nenhum clipe selecionado"}
        >
          {clip?.name ?? "Selecione um clipe"}
        </span>
      </header>

      <nav className="dock-tool-tabs" role="tablist" aria-label="Ferramentas de imagem">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`image-tab-${value}`}
            aria-controls="image-tool-panel"
            aria-selected={tool === value}
            onClick={() => setTool(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div
        className="dock-tool-content"
        id="image-tool-panel"
        role="tabpanel"
        aria-labelledby={`image-tab-${tool}`}
      >
        {tool === "image" && (
          <div className="effect-control-grid">
            {range("Brilho", "brightness", 0, 2, 0.01, 1, (v) => `${Math.round(v * 100)}%`)}
            {range("Contraste", "contrast", 0, 2, 0.01, 1, (v) => `${Math.round(v * 100)}%`)}
            {range("Saturação", "saturation", 0, 2, 0.01, 1, (v) => `${Math.round(v * 100)}%`)}
            {range("Desfoque", "blur", 0, 20, 0.1, 0, (v) => v.toFixed(1))}
            {selectionHint}
          </div>
        )}

        {tool === "framing" && (
          <div className="effect-control-grid">
            {range("Horizontal", "x", -100, 100, 1, 0, (v) => String(Math.round(v)))}
            {range("Vertical", "y", -100, 100, 1, 0, (v) => String(Math.round(v)))}
            {range("Escala", "scale", 0.1, 4, 0.05, 1, (v) => `${Math.round(v * 100)}%`)}
            {range("Rotação", "rotation", -180, 180, 1, 0, (v) => `${Math.round(v)}°`)}
            {range("Opacidade", "opacity", 0, 1, 0.01, 1, (v) => `${Math.round(v * 100)}%`)}
            {selectionHint}
          </div>
        )}

        {tool === "effects" && clip && clip.type !== "text" && clip.type !== "audio" ? (
          <div className="dock-effect-stack">
            <section className="dock-effect-group">
              <span className="dock-tool-kicker">COR</span>
              <div className="effect-preset-row">
                <button type="button" disabled={unavailable} title="Realça as cores e o contraste" onClick={() => applyPatch({ brightness: 1.08, contrast: 1.12, saturation: 1.14, blur: 0 })}>Vivo</button>
                <button type="button" disabled={unavailable} title="Aplica cores mais suaves e contraste cinematográfico" onClick={() => applyPatch({ brightness: 0.9, contrast: 1.22, saturation: 0.72, blur: 0 })}>Cinema</button>
                <button type="button" disabled={unavailable} title="Converte a imagem para preto e branco" onClick={() => applyPatch({ brightness: 1, contrast: 1, saturation: 0, blur: 0 })}>Preto e branco</button>
                <button type="button" disabled={unavailable} title="Restaura brilho, contraste, saturação e desfoque" onClick={() => applyPatch({ brightness: 1, contrast: 1, saturation: 1, blur: 0 })}>Restaurar cor</button>
              </div>
            </section>
            <section className="dock-effect-group">
              <span className="dock-tool-kicker">TRANSIÇÃO DE ENTRADA</span>
              <label className="dock-select-control">
                Tipo
                <select
                  aria-label="Transição de entrada"
                  disabled={unavailable}
                  value={clip.transitionIn ?? "none"}
                  onChange={(event) =>
                    applyPatch({
                      transitionIn:
                        event.target.value === "none"
                          ? undefined
                          : (event.target.value as Clip["transitionIn"]),
                    })
                  }
                >
                  <option value="none">Sem transição</option>
                  <option value="dissolve">Dissolver</option>
                  <option value="fade">Esmaecer</option>
                  <option value="zoom">Zoom</option>
                  <option value="slide-left">Deslizar da direita</option>
                  <option value="slide-right">Deslizar da esquerda</option>
                </select>
              </label>
              {clip.transitionIn &&
                range(
                  "Duração da transição",
                  "transitionDuration",
                  0.1,
                  Math.max(0.1, Math.min(3, clip.duration / 2)),
                  0.05,
                  Math.min(0.6, clip.duration / 2),
                  (v) => `${v.toFixed(2)} s`,
                )}
            </section>
            <section className="dock-effect-group dock-effect-motion">
              <span className="dock-tool-kicker">MOVIMENTO</span>
              {range("Escala final", "endScale", 0.1, 4, 0.05, clip.scale ?? 1, (v) => `${Math.round(v * 100)}%`)}
              {range("Horizontal final", "endX", -100, 100, 1, clip.x ?? 0, (v) => String(Math.round(v)))}
              {range("Vertical final", "endY", -100, 100, 1, clip.y ?? 0, (v) => String(Math.round(v)))}
              <button
                type="button"
                className="dock-reset-effect"
                disabled={unavailable}
                onClick={() => onChange({ endScale: undefined, endX: undefined, endY: undefined })}
              >
                Remover movimento
              </button>
            </section>
          </div>
        ) : tool === "effects" ? (
          selectionHint
        ) : null}
      </div>
    </section>
  );
}
