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
export default function Inspector({
  settings,
  clip,
  locked,
  onAspect,
  onChange,
  onBegin,
  onEnd,
}: Props) {
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
  const transformControls = (
    <>
      {range("Horizontal", "x", -100, 100, 1, 0)}
      {range("Vertical", "y", -100, 100, 1, 0)}
      {range("Escala", "scale", 0.1, 4, 0.05, 1)}
      {range("Rotação", "rotation", -180, 180, 1, 0)}
      {range("Opacidade", "opacity", 0, 1, 0.01, 1)}
      <small>Você também pode arrastar diretamente no canvas.</small>
    </>
  );
  return (
    <aside className="panel inspector">
      <div className="panel-heading compact-heading">
        <span className="eyebrow">CONTROLE CRIATIVO</span>
        <h2>Propriedades</h2>
      </div>

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

      {clip ? (
        <fieldset disabled={locked} className={`clip-inspector clip-inspector-${clip.type}`}>
          <section className="inspector-section clip-identity">
            <span className="section-kicker">
              {clip.type === "text" ? "TEXTO" : clip.type === "audio" ? "ÁUDIO" : "VÍDEO / IMAGEM"}
            </span>
            <strong className="selected-clip-name">{locked ? "Trilha bloqueada" : clip.name}</strong>
            <label>
              Nome
              <input
                aria-label="Nome da cena"
                value={clip.name}
                onFocus={onBegin}
                onBlur={onEnd}
                onChange={(e) => onChange({ name: e.target.value })}
              />
            </label>
          </section>

          {clip.type === "text" && (
            <>
              <section className="inspector-section">
                <span className="section-kicker">CONTEÚDO DO TEXTO</span>
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
              <section className="inspector-section">
                <span className="section-kicker">POSIÇÃO DO TEXTO</span>
                {transformControls}
              </section>
            </>
          )}

          {clip.type === "video" && (
            <>
              <section className="inspector-section">
                <span className="section-kicker">VÍDEO</span>
                {range("Volume", "volume", 0, 1, 0.01, 1)}
                {clip.assetId && (
                  <label>
                    Velocidade
                    <select
                      aria-label="Velocidade"
                      value={clip.speed ?? 1}
                      onChange={(e) => onChange({ speed: Number(e.target.value) })}
                    >
                      {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4].map((n) => (
                        <option key={n} value={n}>{n}×</option>
                      ))}
                    </select>
                  </label>
                )}
              </section>
              <section className="inspector-section">
                <span className="section-kicker">ENQUADRAMENTO DO VÍDEO</span>
                {transformControls}
              </section>
            </>
          )}

          {clip.type === "audio" && (
            <section className="inspector-section">
              <span className="section-kicker">ÁUDIO</span>
              {range("Volume", "volume", 0, 1, 0.01, 1)}
              {clip.assetId && (
                <label>
                  Velocidade
                  <select
                    aria-label="Velocidade"
                    value={clip.speed ?? 1}
                    onChange={(e) => onChange({ speed: Number(e.target.value) })}
                  >
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4].map((n) => (
                      <option key={n} value={n}>{n}×</option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          )}

          <section className="inspector-section">
            <span className="section-kicker">ENTRADA / SAÍDA</span>
            {range("Entrada suave", "fadeIn", 0, Math.min(5, clip.duration / 2), 0.1, 0)}
            {range("Saída suave", "fadeOut", 0, Math.min(5, clip.duration / 2), 0.1, 0)}
          </section>

          {clip.type !== "audio" && (
            <details className="inspector-section">
              <summary>Movimento animado</summary>
              {range("Escala final", "endScale", 0.1, 4, 0.05, clip.scale ?? 1)}
              {range("Horizontal final", "endX", -100, 100, 1, clip.x ?? 0)}
              {range("Vertical final", "endY", -100, 100, 1, clip.y ?? 0)}
              <button
                onClick={() => onChange({ endScale: undefined, endX: undefined, endY: undefined })}
              >
                Remover movimento
              </button>
            </details>
          )}

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
      ) : (
        <div className="empty-inspector">
          <strong>Selecione um item</strong>
          <p>Vídeo, texto e áudio terão controles separados aqui.</p>
        </div>
      )}
    </aside>
  );
}
