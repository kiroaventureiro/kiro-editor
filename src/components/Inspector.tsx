import { useEffect, useState } from "react";
import type { Clip, ProjectSettings } from "../editor/types";

interface Props {
  settings: ProjectSettings;
  clip?: Clip;
  locked: boolean;
  onAspect: (r: ProjectSettings["aspectRatio"]) => void;
  onChange: (p: Partial<Clip>) => void;
  onBegin: () => void;
  onEnd: () => void;
}

type InspectorTab = "project" | "media" | "text" | "effects";
type CaptionPreset = Exclude<Clip["captionStyle"], undefined>;

export default function Inspector({
  settings,
  clip,
  locked,
  onAspect,
  onChange,
  onBegin,
  onEnd,
}: Props) {
  const [tab, setTab] = useState<InspectorTab>("project");

  useEffect(() => {
    if (!clip) setTab("project");
    else if (clip.type === "text") setTab("text");
    else setTab("media");
  }, [clip?.id]);

  const range = (
    label: string,
    key: keyof Clip,
    min: number,
    max: number,
    step: number,
    fallback: number,
  ) => (
    <label className="control" key={key}>
      <span>
        {label}
        <b>{Number(Number(clip?.[key] ?? fallback).toFixed(2))}</b>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(clip?.[key] ?? fallback)}
        onPointerDown={onBegin}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onBlur={onEnd}
        onChange={(e) => onChange({ [key]: Number(e.target.value) })}
      />
    </label>
  );

  const applyCaptionPreset = (preset: CaptionPreset) => {
    if (preset === "yellow-bar") {
      onChange({
        caption: true,
        captionStyle: preset,
        y: 34,
        fontSize: 5.5,
        fontWeight: 800,
        color: "#111111",
        strokeWidth: 0,
        backgroundColor: "#ffd84d",
        backgroundOpacity: 0.96,
        backgroundPadding: 0.34,
      });
      return;
    }
    if (preset === "impact") {
      onChange({
        caption: true,
        captionStyle: preset,
        y: 28,
        fontSize: 6.2,
        fontWeight: 850,
        color: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 0.1,
        backgroundColor: "#000000",
        backgroundOpacity: 0.72,
        backgroundPadding: 0.3,
      });
      return;
    }
    onChange({
      caption: true,
      captionStyle: "clean",
      y: 34,
      fontSize: 5.2,
      fontWeight: 750,
      color: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 0.12,
      backgroundColor: "#000000",
      backgroundOpacity: 0,
      backgroundPadding: 0.28,
    });
  };

  const identity = (
    <section className="inspector-section clip-identity">
      <span className="section-kicker">
        {clip?.type === "text"
          ? clip.caption
            ? "LEGENDA"
            : "TEXTO"
          : clip?.type === "audio"
            ? "ÁUDIO"
            : "VÍDEO / IMAGEM"}
      </span>
      <strong className="selected-clip-name">
        {locked ? "Trilha bloqueada" : clip?.name}
      </strong>
      <label>
        Nome
        <input
          aria-label="Nome da cena"
          value={clip?.name ?? ""}
          onFocus={onBegin}
          onBlur={onEnd}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
    </section>
  );

  const transformControls = (
    <section className="inspector-section">
      <span className="section-kicker">POSIÇÃO E ENQUADRAMENTO</span>
      {range("Horizontal", "x", -100, 100, 1, 0)}
      {range("Vertical", "y", -100, 100, 1, 0)}
      {range("Escala", "scale", 0.1, 4, 0.05, 1)}
      {range("Rotação", "rotation", -180, 180, 1, 0)}
      {range("Opacidade", "opacity", 0, 1, 0.01, 1)}
      <small>Você também pode arrastar diretamente no canvas.</small>
    </section>
  );

  const projectTab = (
    <section className="inspector-section project-section">
      <span className="section-kicker">PROJETO</span>
      <label>
        Formato
        <select
          aria-label="Formato do projeto"
          value={settings.aspectRatio}
          onChange={(e) =>
            onAspect(e.target.value as ProjectSettings["aspectRatio"])
          }
        >
          <option value="16:9">YouTube · 16:9</option>
          <option value="9:16">Reels / Shorts · 9:16</option>
          <option value="1:1">Quadrado · 1:1</option>
          <option value="4:5">Feed · 4:5</option>
        </select>
      </label>
      <p className="specs">
        {settings.width} × {settings.height} · {settings.fps} fps
      </p>
    </section>
  );

  const mediaTab = clip && clip.type !== "text" ? (
    <fieldset
      disabled={locked}
      className={`clip-inspector clip-inspector-${clip.type}`}
    >
      {identity}
      <section className="inspector-section">
        <span className="section-kicker">
          {clip.type === "audio" ? "SOM" : "REPRODUÇÃO"}
        </span>
        {range("Volume", "volume", 0, 1, 0.01, 1)}
        {clip.type === "audio" && (
          <>
            {range(
              "Fade de entrada",
              "fadeIn",
              0,
              Math.min(5, clip.duration / 2),
              0.05,
              0,
            )}
            {range(
              "Fade de saída",
              "fadeOut",
              0,
              Math.min(5, clip.duration / 2),
              0.05,
              0,
            )}
            <small className="audio-inspector-hint">
              Use a forma de onda na timeline para localizar fala, música e
              pausas com mais precisão.
            </small>
          </>
        )}
        {clip.assetId && (
          <label>
            Velocidade
            <select
              aria-label="Velocidade"
              value={clip.speed ?? 1}
              onChange={(e) => onChange({ speed: Number(e.target.value) })}
            >
              {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {clip.type !== "audio" && transformControls}
      <details className="inspector-section">
        <summary>Roteiro da cena</summary>
        <textarea
          aria-label="Roteiro da cena"
          placeholder="Ação, narração, personagens e referências desta cena…"
          value={clip.notes ?? ""}
          onFocus={onBegin}
          onBlur={onEnd}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </details>
    </fieldset>
  ) : null;

  const textTab = clip?.type === "text" ? (
    <fieldset disabled={locked} className="clip-inspector clip-inspector-text">
      {identity}
      <section className="inspector-section">
        <span className="section-kicker">CONTEÚDO</span>
        <label>
          Texto
          <textarea
            aria-label="Texto do título"
            value={clip.text ?? ""}
            onFocus={onBegin}
            onBlur={onEnd}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </label>
        {range("Tamanho", "fontSize", 2, 20, 0.5, 6)}
        <label className="color-control">
          Cor
          <input
            aria-label="Cor do texto"
            type="color"
            value={clip.color ?? "#ffffff"}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </label>
      </section>

      <section className="inspector-section caption-style-section">
        <div className="caption-style-heading">
          <span className="section-kicker">LEGENDAS</span>
          {!clip.caption && (
            <button
              type="button"
              className="caption-convert"
              onClick={() => applyCaptionPreset("clean")}
            >
              Transformar em legenda
            </button>
          )}
        </div>
        <div className="caption-presets" aria-label="Estilos de legenda">
          <button
            type="button"
            className={clip.captionStyle === "clean" ? "active" : ""}
            onClick={() => applyCaptionPreset("clean")}
          >
            <span className="caption-preview clean">Aa</span>
            Limpa
          </button>
          <button
            type="button"
            className={clip.captionStyle === "yellow-bar" ? "active" : ""}
            onClick={() => applyCaptionPreset("yellow-bar")}
          >
            <span className="caption-preview yellow">Aa</span>
            Tarja amarela
          </button>
          <button
            type="button"
            className={clip.captionStyle === "impact" ? "active" : ""}
            onClick={() => applyCaptionPreset("impact")}
          >
            <span className="caption-preview impact">Aa</span>
            Impacto
          </button>
        </div>
        {clip.caption && (
          <>
            <div className="caption-color-row">
              <label className="color-control">
                Fundo
                <input
                  aria-label="Cor do fundo da legenda"
                  type="color"
                  value={clip.backgroundColor ?? "#000000"}
                  onChange={(e) =>
                    onChange({ backgroundColor: e.target.value })
                  }
                />
              </label>
              <label className="color-control">
                Contorno
                <input
                  aria-label="Cor do contorno da legenda"
                  type="color"
                  value={clip.strokeColor ?? "#000000"}
                  onChange={(e) => onChange({ strokeColor: e.target.value })}
                />
              </label>
            </div>
            {range(
              "Opacidade do fundo",
              "backgroundOpacity",
              0,
              1,
              0.05,
              clip.captionStyle === "yellow-bar" ? 0.96 : 0,
            )}
            {range(
              "Espaço da tarja",
              "backgroundPadding",
              0.05,
              0.8,
              0.05,
              0.28,
            )}
          </>
        )}
      </section>

      {transformControls}
      <details className="inspector-section">
        <summary>Roteiro da cena</summary>
        <textarea
          aria-label="Roteiro da cena"
          value={clip.notes ?? ""}
          onFocus={onBegin}
          onBlur={onEnd}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </details>
    </fieldset>
  ) : null;

  const effectsTab = clip ? (
    <fieldset disabled={locked} className="clip-inspector effects-inspector">
      <section className="inspector-section project-section">
        <span className="section-kicker">EFEITOS</span>
        <strong className="selected-clip-name">{clip.name}</strong>
        {range(
          "Entrada suave",
          "fadeIn",
          0,
          Math.min(5, clip.duration / 2),
          0.1,
          0,
        )}
        {range(
          "Saída suave",
          "fadeOut",
          0,
          Math.min(5, clip.duration / 2),
          0.1,
          0,
        )}
      </section>
      {clip.type !== "audio" && clip.type !== "text" && (
        <section className="inspector-section transition-section">
          <span className="section-kicker">TRANSIÇÃO DE ENTRADA</span>
          <label>
            Tipo
            <select
              aria-label="Transição de entrada"
              value={clip.transitionIn ?? "none"}
              onChange={(e) =>
                onChange({
                  transitionIn:
                    e.target.value === "none"
                      ? undefined
                      : (e.target.value as Clip["transitionIn"]),
                })
              }
            >
              <option value="none">Sem transição</option>
              <option value="dissolve">Dissolver</option>
              <option value="fade">Fade</option>
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
            )}
          <small>
            A transição acontece no início do clipe e também é aplicada na exportação.
          </small>
        </section>
      )}
      {clip.type !== "audio" && (
        <section className="inspector-section">
          <span className="section-kicker">MOVIMENTO</span>
          {range(
            "Escala final",
            "endScale",
            0.1,
            4,
            0.05,
            clip.scale ?? 1,
          )}
          {range("Horizontal final", "endX", -100, 100, 1, clip.x ?? 0)}
          {range("Vertical final", "endY", -100, 100, 1, clip.y ?? 0)}
          <button
            onClick={() =>
              onChange({ endScale: undefined, endX: undefined, endY: undefined })
            }
          >
            Remover movimento
          </button>
        </section>
      )}
      {clip.type !== "audio" && clip.type !== "text" && (
        <section className="inspector-section visual-effects-section">
          <span className="section-kicker">AJUSTES VISUAIS</span>
          {range("Brilho", "brightness", 0.2, 2, 0.05, 1)}
          {range("Contraste", "contrast", 0.2, 2, 0.05, 1)}
          {range("Saturação", "saturation", 0, 2, 0.05, 1)}
          {range("Desfoque", "blur", 0, 3, 0.05, 0)}
          <div className="effect-preset-row">
            <button
              type="button"
              onClick={() =>
                onChange({ brightness: 1.08, contrast: 1.12, saturation: 1.14, blur: 0 })
              }
            >
              Vivo
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({ brightness: 0.9, contrast: 1.22, saturation: 0.72, blur: 0 })
              }
            >
              Cinema
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({ brightness: 1, contrast: 1, saturation: 0, blur: 0 })
              }
            >
              P&B
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({ brightness: 1, contrast: 1, saturation: 1, blur: 0 })
              }
            >
              Limpar
            </button>
          </div>
          <small>Esses ajustes são renderizados no Canvas e no arquivo exportado.</small>
        </section>
      )}
      <div className="future-effects">
        <strong>Próximos efeitos</strong>
        <span>
          Sombras, máscaras, glow, glitch e animações avançadas entrarão nesta aba.
        </span>
      </div>
    </fieldset>
  ) : (
    <div className="empty-inspector">
      <strong>Selecione um item</strong>
      <p>Os efeitos aparecerão aqui.</p>
    </div>
  );

  return (
    <aside className="panel inspector">
      <div className="panel-heading compact-heading">
        <span className="eyebrow">CONTROLE CRIATIVO</span>
        <h2>Propriedades</h2>
      </div>

      <nav className="inspector-tabs" aria-label="Categorias de propriedades">
        <button
          className={tab === "project" ? "active" : ""}
          onClick={() => setTab("project")}
        >
          Projeto
        </button>
        <button
          className={tab === "media" ? "active" : ""}
          onClick={() => setTab("media")}
          disabled={!clip || clip.type === "text"}
        >
          Mídia
        </button>
        <button
          className={tab === "text" ? "active" : ""}
          onClick={() => setTab("text")}
          disabled={clip?.type !== "text"}
        >
          Texto
        </button>
        <button
          className={tab === "effects" ? "active" : ""}
          onClick={() => setTab("effects")}
          disabled={!clip}
        >
          Efeitos
        </button>
      </nav>

      <div className="inspector-tab-content">
        {tab === "project" && projectTab}
        {tab === "media" &&
          (mediaTab ?? (
            <div className="empty-inspector">
              <strong>Selecione vídeo, imagem ou áudio</strong>
            </div>
          ))}
        {tab === "text" &&
          (textTab ?? (
            <div className="empty-inspector">
              <strong>Selecione um texto</strong>
            </div>
          ))}
        {tab === "effects" && effectsTab}
      </div>
    </aside>
  );
}
