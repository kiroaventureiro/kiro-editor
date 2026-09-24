import { ArrowLeftRight, Check, LayoutDashboard, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";

type LayoutState = {
  library: boolean;
  inspector: boolean;
  timeline: boolean;
  tools: boolean;
  swapped: boolean;
  compactTimeline: boolean;
};

const STORAGE_KEY = "kiro-editor-workspace-layout-v1";

const DEFAULT_LAYOUT: LayoutState = {
  library: true,
  inspector: true,
  timeline: true,
  tools: true,
  swapped: false,
  compactTimeline: false,
};

function readLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) } as LayoutState;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function applyLayout(layout: LayoutState) {
  const root = document.documentElement;
  root.classList.toggle("kiro-hide-library", !layout.library);
  root.classList.toggle("kiro-hide-inspector", !layout.inspector);
  root.classList.toggle("kiro-hide-timeline", !layout.timeline);
  root.classList.toggle("kiro-hide-tools", !layout.tools);
  root.classList.toggle("kiro-swap-sides", layout.swapped);
  root.classList.toggle("kiro-compact-timeline", layout.compactTimeline);
}

export default function WorkspaceLayoutControls() {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<LayoutState>(() => readLayout());

  useEffect(() => {
    applyLayout(layout);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  const patch = (next: Partial<LayoutState>) =>
    setLayout((current) => ({ ...current, ...next }));

  const reset = () => setLayout(DEFAULT_LAYOUT);

  const preset = (name: "edit" | "canvas" | "shorts") => {
    if (name === "edit") setLayout(DEFAULT_LAYOUT);
    if (name === "canvas")
      setLayout({
        library: false,
        inspector: false,
        timeline: true,
        tools: true,
        swapped: false,
        compactTimeline: true,
      });
    if (name === "shorts")
      setLayout({
        library: true,
        inspector: true,
        timeline: true,
        tools: true,
        swapped: false,
        compactTimeline: true,
      });
  };

  return (
    <>
      <button
        className={`layout-manager-trigger ${open ? "active" : ""}`}
        aria-label="Organizar painéis"
        aria-expanded={open}
        title="Organizar painéis do estúdio"
        onClick={() => setOpen((value) => !value)}
      >
        <LayoutDashboard size={18} />
        <span>Layout</span>
      </button>

      {open && (
        <section className="layout-manager-popover" aria-label="Painéis do estúdio">
          <header>
            <div>
              <strong>Layout do estúdio</strong>
              <small>Mostre, esconda e reposicione os blocos.</small>
            </div>
            <button aria-label="Fechar" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </header>

          <div className="layout-presets">
            <button onClick={() => preset("edit")}>Edição</button>
            <button onClick={() => preset("canvas")}>Canvas</button>
            <button onClick={() => preset("shorts")}>Shorts</button>
          </div>

          <div className="layout-panel-list">
            <ToggleRow
              label="Biblioteca"
              checked={layout.library}
              onChange={(value) => patch({ library: value })}
            />
            <ToggleRow
              label="Propriedades"
              checked={layout.inspector}
              onChange={(value) => patch({ inspector: value })}
            />
            <ToggleRow
              label="Timeline"
              checked={layout.timeline}
              onChange={(value) => patch({ timeline: value })}
            />
            <ToggleRow
              label="Barra de ferramentas"
              checked={layout.tools}
              onChange={(value) => patch({ tools: value })}
            />
            <ToggleRow
              label="Timeline compacta"
              checked={layout.compactTimeline}
              onChange={(value) => patch({ compactTimeline: value })}
            />
          </div>

          <div className="layout-manager-actions">
            <button
              className={layout.swapped ? "active" : ""}
              onClick={() => patch({ swapped: !layout.swapped })}
            >
              <ArrowLeftRight size={15} />
              Inverter laterais
            </button>
            <button onClick={reset}>
              <RotateCcw size={15} />
              Restaurar padrão
            </button>
          </div>

          <p>
            Nesta primeira versão os blocos podem ser exibidos, ocultados,
            invertidos e salvos. O próximo passo é arrastar e encaixar cada painel
            livremente, no estilo OBS.
          </p>
        </section>
      )}
    </>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      className={`layout-toggle-row ${checked ? "enabled" : ""}`}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <i>{checked && <Check size={13} />}</i>
    </button>
  );
}
