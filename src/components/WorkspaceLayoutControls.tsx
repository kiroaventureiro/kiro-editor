import { ArrowLeftRight, Check, LayoutDashboard, PanelLeft, PanelRight, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";

type LayoutState = {
  library: boolean;
  inspector: boolean;
  timeline: boolean;
  tools: boolean;
  swapped: boolean;
  compactTimeline: boolean;
  floatingLibrary: boolean;
  floatingInspector: boolean;
};

type DockPosition = { x: number; y: number };

const STORAGE_KEY = "kiro-editor-workspace-layout-v2";
const POSITIONS_KEY = "kiro-editor-workspace-floating-positions-v1";

const DEFAULT_LAYOUT: LayoutState = {
  library: true,
  inspector: true,
  timeline: true,
  tools: true,
  swapped: false,
  compactTimeline: false,
  floatingLibrary: false,
  floatingInspector: false,
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

function readPositions(): Record<string, DockPosition> {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
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
  root.classList.toggle("kiro-float-library", layout.floatingLibrary && layout.library);
  root.classList.toggle("kiro-float-inspector", layout.floatingInspector && layout.inspector);
}

function attachFloatingDrag(selector: string, positionKey: string) {
  const panel = document.querySelector<HTMLElement>(selector);
  const handle = panel?.querySelector<HTMLElement>(".panel-heading");
  if (!panel || !handle) return () => {};

  const positions = readPositions();
  const saved = positions[positionKey];
  if (saved) {
    panel.style.left = `${saved.x}px`;
    panel.style.top = `${saved.y}px`;
  }

  const onPointerDown = (event: PointerEvent) => {
    const root = document.documentElement;
    const allowed =
      (positionKey === "library" && root.classList.contains("kiro-float-library")) ||
      (positionKey === "inspector" && root.classList.contains("kiro-float-inspector"));
    if (!allowed || (event.target as HTMLElement).closest("button,input,select,textarea")) return;

    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    handle.setPointerCapture?.(event.pointerId);
    panel.classList.add("panel-is-dragging");

    const move = (moveEvent: PointerEvent) => {
      const maxX = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxY = Math.max(64, window.innerHeight - panel.offsetHeight - 8);
      const x = Math.min(Math.max(8, moveEvent.clientX - offsetX), maxX);
      const y = Math.min(Math.max(64, moveEvent.clientY - offsetY), maxY);
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      panel.classList.remove("panel-is-dragging");
      const next = readPositions();
      const box = panel.getBoundingClientRect();
      next[positionKey] = { x: Math.round(box.left), y: Math.round(box.top) };
      localStorage.setItem(POSITIONS_KEY, JSON.stringify(next));
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };

  handle.addEventListener("pointerdown", onPointerDown);
  return () => handle.removeEventListener("pointerdown", onPointerDown);
}

export default function WorkspaceLayoutControls() {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<LayoutState>(() => readLayout());

  useEffect(() => {
    applyLayout(layout);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    const detachLibrary = attachFloatingDrag(".media-panel", "library");
    const detachInspector = attachFloatingDrag(".inspector", "inspector");
    return () => {
      detachLibrary();
      detachInspector();
    };
  }, [layout.floatingLibrary, layout.floatingInspector]);

  const patch = (next: Partial<LayoutState>) =>
    setLayout((current) => ({ ...current, ...next }));

  const reset = () => {
    document.querySelector<HTMLElement>(".media-panel")?.removeAttribute("style");
    document.querySelector<HTMLElement>(".inspector")?.removeAttribute("style");
    localStorage.removeItem(POSITIONS_KEY);
    setLayout(DEFAULT_LAYOUT);
  };

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
        floatingLibrary: false,
        floatingInspector: false,
      });
    if (name === "shorts")
      setLayout({
        library: true,
        inspector: true,
        timeline: true,
        tools: true,
        swapped: false,
        compactTimeline: true,
        floatingLibrary: false,
        floatingInspector: false,
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
              <small>Mostre, solte e reposicione os blocos.</small>
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
            <ToggleRow label="Biblioteca" checked={layout.library} onChange={(value) => patch({ library: value })} />
            <ToggleRow label="Propriedades" checked={layout.inspector} onChange={(value) => patch({ inspector: value })} />
            <ToggleRow label="Timeline" checked={layout.timeline} onChange={(value) => patch({ timeline: value })} />
            <ToggleRow label="Barra de ferramentas" checked={layout.tools} onChange={(value) => patch({ tools: value })} />
            <ToggleRow label="Timeline compacta" checked={layout.compactTimeline} onChange={(value) => patch({ compactTimeline: value })} />
          </div>

          <div className="layout-manager-section-title">PAINÉIS FLUTUANTES</div>
          <div className="layout-manager-actions">
            <button
              className={layout.floatingLibrary ? "active" : ""}
              disabled={!layout.library}
              onClick={() => patch({ floatingLibrary: !layout.floatingLibrary })}
            >
              <PanelLeft size={15} />
              {layout.floatingLibrary ? "Encaixar Biblioteca" : "Soltar Biblioteca"}
            </button>
            <button
              className={layout.floatingInspector ? "active" : ""}
              disabled={!layout.inspector}
              onClick={() => patch({ floatingInspector: !layout.floatingInspector })}
            >
              <PanelRight size={15} />
              {layout.floatingInspector ? "Encaixar Propriedades" : "Soltar Propriedades"}
            </button>
            <button className={layout.swapped ? "active" : ""} onClick={() => patch({ swapped: !layout.swapped })}>
              <ArrowLeftRight size={15} />
              Inverter laterais
            </button>
            <button onClick={reset}>
              <RotateCcw size={15} />
              Restaurar padrão
            </button>
          </div>

          <p>
            Ao soltar Biblioteca ou Propriedades, arraste pelo título do painel.
            A posição fica salva neste navegador.
          </p>
        </section>
      )}
    </>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button className={`layout-toggle-row ${checked ? "enabled" : ""}`} aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <i>{checked && <Check size={13} />}</i>
    </button>
  );
}
