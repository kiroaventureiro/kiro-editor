import {
  Download,
  FolderOpen,
  Save,
  Plus,
  Type,
  Captions,
  Film,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import MediaLibrary from "./components/MediaLibrary";
import Preview from "./components/Preview";
import Inspector from "./components/Inspector";
import Timeline from "./components/Timeline";
import { createEmptyProject, projectPresets } from "./editor/project";
import type { Clip, KiroProject, MediaAsset, Track } from "./editor/types";
import { historyReducer } from "./editor/history";
import {
  changeSpeed,
  clamp,
  frameTime,
  parseSrt,
  projectDuration,
  removeClips,
  split,
  trim,
} from "./editor/operations";
import {
  cleanProject,
  download,
  getProject,
  hydrate,
  inspectFile,
  listProjects,
  loadLast,
  putMedia,
  saveProject,
  validateProject,
} from "./editor/storage";
import { recordingFormat, renderVideo } from "./editor/engine";

export default function App() {
  const [history, dispatch] = useReducer(historyReducer, undefined, () => ({
    present: createEmptyProject(),
    past: [],
    future: [],
  }));
  const project = history.present,
    current = useRef(project);
  current.current = project;
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState(""),
    [saveState, setSaveState] = useState("Carregando…"),
    [focus, setFocus] = useState(false),
    [drawer, setDrawer] = useState<"media" | "inspector" | "none">("none");
  const [projects, setProjects] = useState<KiroProject[] | null>(null),
    [exportOpen, setExportOpen] = useState(false),
    [resolution, setResolution] = useState(720),
    [progress, setProgress] = useState<number | null>(null);
  const [timelineHeight, setTimelineHeight] = useState(310),
    [libraryWidth, setLibraryWidth] = useState(260);
  const [targetTrack, setTargetTrack] = useState("video-1");
  const abort = useRef<AbortController | null>(null),
    dirty = useRef(false),
    ready = useRef(false),
    saveChain = useRef(Promise.resolve());
  const exporting = progress !== null;
  const selectedClip = project.tracks
    .flatMap((t) => t.clips)
    .find((c) => c.id === selected.at(-1));
  const locked = project.tracks.some(
    (t) => t.locked && t.clips.some((c) => c.id === selectedClip?.id),
  );
  const format = recordingFormat();
  const enqueueSave = useCallback((p: KiroProject) => {
    const next = saveChain.current.catch(() => {}).then(() => saveProject(p));
    saveChain.current = next;
    return next;
  }, []);
  useEffect(() => {
    let alive = true;
    void loadLast()
      .then((p) => {
        if (alive && p) dispatch({ type: "load", project: p });
      })
      .catch((e: Error) => {
        if (alive)
          setNotice(`Não foi possível recuperar o projeto: ${e.message}`);
      })
      .finally(() => {
        if (alive) {
          ready.current = true;
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    dirty.current = true;
    setSaveState("Salvando…");
    const id = setTimeout(() => {
      void enqueueSave(project)
        .then(() => {
          if (current.current === project) {
            dirty.current = false;
            setSaveState("Salvo neste navegador");
          }
        })
        .catch((e: Error) => {
          setSaveState("Falha ao salvar");
          setNotice(
            `Armazenamento indisponível ou cheio. Baixe uma cópia do projeto. ${e.message}`,
          );
        });
    }, 450);
    return () => clearTimeout(id);
  }, [project, loaded, enqueueSave]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current || abort.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const hidden = () => {
      if (document.hidden && ready.current && dirty.current)
        void enqueueSave(current.current).catch(() => {});
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [enqueueSave]);
  const edit = (fn: (p: KiroProject) => KiroProject) => {
    const next = fn(current.current);
    if (next === current.current) return;
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    current.current = stamped;
    dispatch({ type: "edit", project: stamped });
  };
  const begin = () => dispatch({ type: "begin" }),
    end = () => dispatch({ type: "end" });
  const select = (c: Clip, multiple = false) => {
    setSelected((ids) =>
      multiple
        ? ids.includes(c.id)
          ? ids.filter((id) => id !== c.id)
          : [...ids, c.id]
        : [c.id],
    );
    if (!multiple) setTime(c.start);
  };
  const updateClip = (patch: Partial<Clip>) => {
    if (!selectedClip || locked) return;
    edit((p) => ({
      ...p,
      tracks: p.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id !== selectedClip.id
            ? c
            : patch.speed !== undefined
              ? { ...changeSpeed(c, patch.speed), ...patch }
              : { ...c, ...patch },
        ),
      })),
    }));
  };
  const historyStep = (type: "undo" | "redo") => {
    setPlaying(false);
    dispatch({ type: "end" });
    dispatch({ type });
    setSelected([]);
  };
  const remove = (ripple: boolean) => {
    edit((p) => removeClips(p, selected, ripple));
    setSelected([]);
  };
  const duplicate = () => {
    const ids: string[] = [];
    edit((p) => {
      const editable = p.tracks
        .filter((t) => !t.locked)
        .flatMap((t) => t.clips)
        .filter((c) => selected.includes(c.id));
      if (!editable.length) return p;
      const offset =
        Math.max(...editable.map((c) => c.start + c.duration)) -
        Math.min(...editable.map((c) => c.start));
      return {
        ...p,
        tracks: p.tracks.map((t) =>
          t.locked
            ? t
            : {
                ...t,
                clips: [
                  ...t.clips,
                  ...t.clips
                    .filter((c) => selected.includes(c.id))
                    .map((c) => {
                      const id = crypto.randomUUID();
                      ids.push(id);
                      return { ...c, id, start: c.start + offset };
                    }),
                ],
              },
        ),
      };
    });
    setSelected(ids);
  };
  const divide = () => {
    const at = frameTime(time, project.settings.fps);
    edit((p) => ({
      ...p,
      tracks: p.tracks.map((t) =>
        t.locked
          ? t
          : {
              ...t,
              clips: t.clips.flatMap((c) =>
                selected.includes(c.id) ? split(c, at) : [c],
              ),
            },
      ),
    }));
    setSelected([]);
  };
  const manualSave = async () => {
    try {
      await enqueueSave(current.current);
      dirty.current = false;
      setSaveState("Salvo neste navegador");
      download(
        new Blob([JSON.stringify(cleanProject(current.current), null, 2)], {
          type: "application/json",
        }),
        `${safeName(current.current.name)}.kiroproj.json`,
      );
      setNotice(
        "Cópia da edição baixada. As mídias ficam neste navegador; mantenha também os arquivos originais.",
      );
    } catch (e) {
      setNotice(error(e));
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (exporting || busy || !loaded || projects || exportOpen) return;
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable="true"]'))
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void manualSave();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        historyStep(e.shiftKey ? "redo" : "undo");
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        historyStep("redo");
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      } else if (e.code === "Space") {
        e.preventDefault();
        if (projectDuration(project)) {
          if (time >= projectDuration(project)) setTime(0);
          setPlaying((v) => !v);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove(false);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setTime((t) =>
          clamp(
            t + (e.key === "ArrowLeft" ? -1 : 1) / project.settings.fps,
            0,
            projectDuration(project),
          ),
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const add = (asset: MediaAsset) => {
    const type = asset.type === "audio" ? "audio" : "video",
      id = crypto.randomUUID();
    let start = 0;
    edit((p) => {
      let target =
        p.tracks.find(
          (t) => t.id === targetTrack && t.type === type && !t.locked,
        ) ?? p.tracks.find((t) => t.type === type && !t.locked);
      const tracks = [...p.tracks];
      if (!target) {
        target = {
          id: crypto.randomUUID(),
          name: type === "audio" ? "Áudio" : "Vídeo",
          type,
          clips: [],
        };
        tracks.push(target);
      }
      start = target.clips.reduce(
        (n, c) => Math.max(n, c.start + c.duration),
        0,
      );
      const duration = asset.type === "image" ? 4 : asset.duration!;
      return {
        ...p,
        tracks: tracks.map((t) =>
          t.id !== target!.id
            ? t
            : {
                ...t,
                clips: [
                  ...t.clips,
                  {
                    id,
                    assetId: asset.id,
                    name: asset.name,
                    type,
                    start,
                    duration,
                    sourceIn: 0,
                    sourceOut: duration,
                    volume: 1,
                    speed: 1,
                  },
                ],
              },
        ),
      };
    });
    setSelected([id]);
    setTime(start);
  };
  const importFiles = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    setBusy(true);
    setPlaying(false);
    const imported: MediaAsset[] = [],
      failures: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const info = await inspectFile(file),
          id = crypto.randomUUID(),
          path = await putMedia(id, file);
        imported.push({ ...info, id, path });
      } catch (e) {
        failures.push(error(e));
      }
    }
    if (imported.length) {
      edit((p) => ({ ...p, assets: [...p.assets, ...imported] }));
      if (imported.length === 1 && !projectDuration(current.current))
        add(imported[0]);
    }
    setNotice(
      failures.length
        ? failures.join(" ")
        : `${imported.length} arquivo(s) importado(s) e armazenado(s).`,
    );
    setBusy(false);
    void navigator.storage?.persist?.().catch(() => {});
  };
  const relink = async (id: string, file: File) => {
    setBusy(true);
    try {
      const old = current.current.assets.find((a) => a.id === id)!;
      const info = await inspectFile(file);
      if (info.type !== old.type)
        throw new Error("Escolha um arquivo do mesmo tipo.");
      const required = current.current.tracks
        .flatMap((t) => t.clips)
        .filter((c) => c.assetId === id)
        .reduce(
          (n, c) =>
            Math.max(n, (c.sourceIn ?? 0) + c.duration * (c.speed ?? 1)),
          0,
        );
      if (info.duration !== undefined && info.duration + 0.01 < required)
        throw new Error(
          "O arquivo é mais curto que os trechos usados na edição.",
        );
      const path = await putMedia(id, file);
      edit((p) => ({
        ...p,
        assets: p.assets.map((a) =>
          a.id === id ? { ...a, ...info, path } : a,
        ),
      }));
      setNotice("Mídia reconectada.");
    } catch (e) {
      setNotice(error(e));
    } finally {
      setBusy(false);
    }
  };
  const switchProject = async (p: KiroProject) => {
    await enqueueSave(current.current);
    setPlaying(false);
    setTime(0);
    setSelected([]);
    current.current = p;
    dispatch({ type: "load", project: p });
    setProjects(null);
  };
  const newProject = async () => {
    try {
      await switchProject(createEmptyProject());
      setNotice("Novo projeto criado. O anterior continua em Meus projetos.");
    } catch (e) {
      setNotice(error(e));
    }
  };
  const openFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("O arquivo de edição deve ter no máximo 20 MB.");
      const p = await hydrate(validateProject(JSON.parse(await file.text())));
      p.id = crypto.randomUUID();
      await switchProject(p);
      setNotice("Cópia aberta. Reconecte os arquivos que estiverem ausentes.");
    } catch (e) {
      setNotice(error(e));
    }
  };
  const addText = (clips?: Clip[]) => {
    const newClips = clips ?? [
      {
        id: crypto.randomUUID(),
        name: "Novo título",
        type: "text" as const,
        start: time,
        duration: 4,
        text: "Sua história",
        fontSize: 6,
      },
    ];
    edit((p) => {
      let target = p.tracks.find((t) => t.type === "text" && !t.locked);
      const tracks = [...p.tracks];
      if (!target) {
        target = {
          id: crypto.randomUUID(),
          name: "Textos",
          type: "text",
          clips: [],
        };
        tracks.push(target);
      }
      return {
        ...p,
        tracks: tracks.map((t) =>
          t.id === target!.id ? { ...t, clips: [...t.clips, ...newClips] } : t,
        ),
      };
    });
    setSelected([newClips[0].id]);
    setDrawer("inspector");
  };
  const importCaptions = async (file?: File) => {
    if (!file) return;
    try {
      const clips = parseSrt(await file.text());
      if (!clips.length)
        throw new Error("Não foram encontradas legendas SRT válidas.");
      addText(clips);
      setNotice(`${clips.length} legendas adicionadas como texto editável.`);
    } catch (e) {
      setNotice(error(e));
    }
  };
  const exportVideo = async () => {
    setPlaying(false);
    setProgress(0);
    const controller = new AbortController();
    abort.current = controller;
    try {
      await enqueueSave(current.current);
      const result = await renderVideo(
        current.current,
        resolution,
        controller.signal,
        setProgress,
      );
      download(
        result.blob,
        `${safeName(project.name)}-${resolution}p.${result.extension}`,
      );
      setNotice(`Vídeo ${result.extension.toUpperCase()} exportado.`);
      setExportOpen(false);
    } catch (e) {
      setNotice(error(e));
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };
  const resize = (
    e: React.PointerEvent<HTMLDivElement>,
    axis: "vertical" | "horizontal",
  ) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const origin = e.clientY,
      originX = e.clientX,
      old = timelineHeight,
      oldWidth = libraryWidth;
    const move = (event: PointerEvent) => {
      if (axis === "vertical")
        setTimelineHeight(
          clamp(old + origin - event.clientY, 230, window.innerHeight * 0.65),
        );
      else setLibraryWidth(clamp(oldWidth + event.clientX - originX, 220, 420));
    };
    const element = e.currentTarget;
    const stop = () => {
      element.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    element.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };
  if (!loaded) return <div className="loading">Abrindo seu estúdio…</div>;
  return (
    <div
      className={`app-shell ${focus ? "focus" : ""} drawer-${drawer}`}
      style={
        {
          "--timeline-height": `${timelineHeight}px`,
          "--library-width": `${libraryWidth}px`,
        } as React.CSSProperties
      }
    >
      <header className="topbar" inert={!!projects || exportOpen}>
        <div className="brand">
          <span className="brand-mark">K</span>
          <div>
            <strong>
              KIRO <em>Editor</em>
            </strong>
            <small>STUDIO · 0.5</small>
          </div>
        </div>
        <div className="project-name">
          <input
            aria-label="Nome do projeto"
            value={project.name}
            onFocus={begin}
            onBlur={end}
            onChange={(e) => edit((p) => ({ ...p, name: e.target.value }))}
          />
          <small className={saveState === "Falha ao salvar" ? "error" : ""}>
            {saveState}
          </small>
        </div>
        <div className="top-actions">
          <button
            onClick={() => void newProject()}
            disabled={busy || exporting}
          >
            <Plus size={16} />
            <span>Novo</span>
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              void enqueueSave(current.current)
                .then(listProjects)
                .then(setProjects)
                .catch((e) => setNotice(error(e)));
            }}
            disabled={busy || exporting}
          >
            <FolderOpen size={16} />
            <span>Projetos</span>
          </button>
          <button
            aria-label="Baixar cópia do projeto"
            title="Baixar cópia do projeto (Ctrl+S)"
            onClick={() => void manualSave()}
            disabled={busy || exporting}
          >
            <Save size={16} />
          </button>
          <button
            className="primary"
            onClick={() => {
              setPlaying(false);
              setExportOpen(true);
            }}
            disabled={busy || !projectDuration(project) || exporting}
          >
            <Download size={17} />
            <span>Exportar</span>
          </button>
        </div>
      </header>
      <nav className="workspace-tools" inert={busy || !!projects || exportOpen}>
        <div>
          <button
            className={drawer === "media" ? "active" : ""}
            onClick={() => setDrawer(drawer === "media" ? "none" : "media")}
          >
            <Film size={16} />
            Mídia
          </button>
          <button onClick={() => addText()} disabled={busy || exporting}>
            <Type size={16} />
            Texto
          </button>
          <label className="button">
            <Captions size={16} />
            Legendas SRT
            <input
              aria-label="Importar legendas SRT"
              hidden
              type="file"
              accept=".srt"
              disabled={busy || exporting}
              onChange={(e) => {
                void importCaptions(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <button
          onClick={() =>
            setDrawer(drawer === "inspector" ? "none" : "inspector")
          }
        >
          <SlidersHorizontal size={16} />
          Propriedades
        </button>
      </nav>
      <main className="workspace" inert={exportOpen || !!projects || busy}>
        <MediaLibrary
          tracks={project.tracks}
          targetTrack={targetTrack}
          onTargetTrack={setTargetTrack}
          assets={project.assets}
          onImport={importFiles}
          onAddToTimeline={add}
          onRelink={relink}
          busy={busy}
        />
        <div
          role="separator"
          aria-label="Largura da biblioteca"
          aria-orientation="vertical"
          className="library-resizer"
          onPointerDown={(e) => resize(e, "horizontal")}
        />
        <Preview
          project={project}
          time={time}
          playing={playing}
          onTime={setTime}
          onPlaying={setPlaying}
          focus={focus}
          onFocus={() => setFocus(!focus)}
          selectedClip={locked ? undefined : selectedClip}
          onTransform={updateClip}
          onBegin={begin}
          onEnd={end}
        />
        <Inspector
          settings={project.settings}
          clip={selectedClip}
          locked={locked}
          onAspect={(r) =>
            edit((p) => ({
              ...p,
              settings: { ...p.settings, aspectRatio: r, ...projectPresets[r] },
            }))
          }
          onChange={updateClip}
          onBegin={begin}
          onEnd={end}
        />
      </main>
      <div
        className="timeline-resizer"
        role="separator"
        aria-label="Altura da timeline"
        aria-orientation="horizontal"
        onPointerDown={(e) => resize(e, "vertical")}
      >
        <span />
      </div>
      <div className="timeline-region" inert={exportOpen || !!projects || busy}>
        <Timeline
          project={project}
          selected={selected}
          time={time}
          onSeek={setTime}
          onSelect={select}
          onMove={(id, n, edge) =>
            edit((p) => ({
              ...p,
              tracks: p.tracks.map((t) =>
                t.locked
                  ? t
                  : {
                      ...t,
                      clips: t.clips.map((c) =>
                        c.id !== id
                          ? c
                          : edge
                            ? trim(c, edge, n, p)
                            : { ...c, start: n },
                      ),
                    },
              ),
            }))
          }
          onBegin={begin}
          onEnd={end}
          onSplit={divide}
          onDelete={remove}
          onDuplicate={duplicate}
          onUndo={() => historyStep("undo")}
          onRedo={() => historyStep("redo")}
          canUndo={!!history.past.length}
          canRedo={!!history.future.length}
          onTrack={(id, patch) =>
            edit((p) => ({
              ...p,
              tracks: p.tracks.map((t) =>
                t.id === id ? { ...t, ...patch } : t,
              ),
            }))
          }
          onAddTrack={(type) => {
            const id = crypto.randomUUID();
            edit((p) => ({
              ...p,
              tracks: [
                ...p.tracks,
                {
                  id,
                  name: `${type === "audio" ? "Áudio" : "Camada"} ${p.tracks.length + 1}`,
                  type,
                  clips: [],
                },
              ],
            }));
            setTargetTrack(id);
          }}
        />
      </div>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {projects && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Meus projetos"
          >
            <div className="modal-heading">
              <h2>Meus projetos</h2>
              <button
                aria-label="Fechar projetos"
                onClick={() => setProjects(null)}
              >
                <X size={20} />
              </button>
            </div>
            <p>Projetos e mídias salvos neste navegador.</p>
            <label className="button">
              <FolderOpen size={16} />
              Abrir cópia .kiroproj.json
              <input
                aria-label="Abrir arquivo de projeto"
                hidden
                type="file"
                accept=".json"
                onChange={(e) => void openFile(e.target.files?.[0])}
              />
            </label>
            <div className="project-list">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    void getProject(p.id)
                      .then(switchProject)
                      .catch((e) => setNotice(error(e)))
                  }
                >
                  <strong>{p.name}</strong>
                  <small>
                    {p.tracks.reduce((n, t) => n + t.clips.length, 0)} clipes ·{" "}
                    {new Date(p.updatedAt).toLocaleString("pt-BR")}
                  </small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {exportOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Exportar vídeo"
          >
            <div className="modal-heading">
              <h2>Seu vídeo, pronto para sair</h2>
              <button
                aria-label="Fechar exportação"
                disabled={exporting}
                onClick={() => setExportOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p>A montagem completa, com textos, movimento e áudio.</p>
            <label>
              Resolução
              <select
                aria-label="Resolução de exportação"
                disabled={exporting}
                value={resolution}
                onChange={(e) => setResolution(Number(e.target.value))}
              >
                <option value={720}>720p · arquivo menor</option>
                <option value={1080}>1080p · alta definição</option>
              </select>
            </label>
            <div className="export-specs">
              <span>
                Formato{" "}
                <strong>
                  {format?.extension.toUpperCase() ?? "Indisponível"}
                </strong>
              </span>
              <span>
                Duração <strong>{projectDuration(project).toFixed(1)} s</strong>
              </span>
            </div>
            <p className="panel-tip">
              Exportação local em tempo real. Mantenha esta aba visível e o
              dispositivo ativo até terminar. O formato depende do navegador;
              esta versão não faz conversão posterior para MP4.
            </p>
            {exporting ? (
              <>
                <progress
                  aria-label="Progresso da exportação"
                  max={100}
                  value={progress ?? 0}
                />
                <p>{Math.round(progress ?? 0)}% · Renderizando sua montagem</p>
                <button onClick={() => abort.current?.abort()}>
                  Cancelar exportação
                </button>
              </>
            ) : (
              <button
                className="primary"
                disabled={!format}
                onClick={() => void exportVideo()}
              >
                <Download size={17} />
                Gerar e baixar vídeo
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function safeName(name: string) {
  return (
    name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") ||
    "kiro-projeto"
  );
}
function error(e: unknown) {
  return e instanceof Error
    ? e.message
    : "Não foi possível concluir a operação.";
}
