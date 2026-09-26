import {
  Clock3,
  FolderOpen,
  Grid2X2,
  Heart,
  Link2,
  List,
  Music2,
  Plus,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  libraryAssetLabel,
  parseKiroLibraryResponse,
  type KiroLibraryItem,
  type LibraryCategory,
  type LibrarySection,
} from "../editor/library";
import type { MediaAsset, Track } from "../editor/types";

interface Props {
  tracks: Track[];
  targetTrack: string;
  onTargetTrack: (id: string) => void;
  assets: MediaAsset[];
  onImport: (files: FileList | null) => void;
  onAddToTimeline: (asset: MediaAsset) => void;
  onAddLibraryAsset: (asset: KiroLibraryItem) => void;
  onRelink: (id: string, file: File) => void;
  busy: boolean;
}

type Filter = "all" | MediaAsset["type"];
type CatalogState = "idle" | "loading" | "ready" | "error";
type DisplayAsset = {
  asset: MediaAsset;
  source: "mine" | "kiro";
  libraryItem?: KiroLibraryItem;
};

const FAVORITES_KEY = "kiro-editor-library-favorites-v1";
const RECENTS_KEY = "kiro-editor-library-recents-v1";

function readStoredList(key: string) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function storeList(key: string, value: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Favoritos e recentes são conveniência; o editor continua funcionando
    // mesmo quando o navegador bloqueia armazenamento local.
  }
}

function itemKey(source: DisplayAsset["source"], id: string) {
  return `${source}:${id}`;
}

export default function MediaLibrary({
  tracks,
  targetTrack,
  onTargetTrack,
  assets,
  onImport,
  onAddToTimeline,
  onAddLibraryAsset,
  onRelink,
  busy,
}: Props) {
  const [section, setSection] = useState<LibrarySection>("mine");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [libraryCategory, setLibraryCategory] = useState<
    "all" | LibraryCategory
  >("all");
  const [catalog, setCatalog] = useState<KiroLibraryItem[]>([]);
  const [catalogState, setCatalogState] = useState<CatalogState>("idle");
  const [catalogError, setCatalogError] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() =>
    readStoredList(FAVORITES_KEY),
  );
  const [recents, setRecents] = useState<string[]>(() =>
    readStoredList(RECENTS_KEY),
  );

  useEffect(() => {
    if (
      !["kiro", "favorites", "recent"].includes(section) ||
      catalogState !== "idle"
    )
      return;

    const controller = new AbortController();
    setCatalogState("loading");
    setCatalogError("");
    void fetch("/api/library?scope=public", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(body?.error || "Não foi possível abrir a KIRO Library.");
        return parseKiroLibraryResponse(body);
      })
      .then((response) => {
        setCatalog(response.items);
        setCatalogState("ready");
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setCatalogError(error.message);
        setCatalogState("error");
      });

    return () => controller.abort();
  }, [section, catalogState]);

  const allAssets = useMemo<DisplayAsset[]>(
    () => [
      ...assets.map((asset) => ({ asset, source: "mine" as const })),
      ...catalog.map((libraryItem) => ({
        asset: libraryItem as MediaAsset,
        source: "kiro" as const,
        libraryItem,
      })),
    ],
    [assets, catalog],
  );

  const baseAssets = useMemo(() => {
    if (section === "mine")
      return allAssets.filter((item) => item.source === "mine");
    if (section === "kiro")
      return allAssets.filter((item) => item.source === "kiro");
    if (section === "favorites") {
      const wanted = new Set(favorites);
      return allAssets.filter((item) => wanted.has(itemKey(item.source, item.asset.id)));
    }

    const byKey = new Map(
      allAssets.map((item) => [itemKey(item.source, item.asset.id), item]),
    );
    return recents.flatMap((key) => {
      const item = byKey.get(key);
      return item ? [item] : [];
    });
  }, [allAssets, favorites, recents, section]);

  const visibleAssets = useMemo(
    () =>
      baseAssets.filter((item) => {
        const matchesSearch = item.asset.name
          .toLowerCase()
          .includes(search.trim().toLowerCase());
        const matchesFilter = filter === "all" || item.asset.type === filter;
        const matchesCategory =
          section !== "kiro" ||
          libraryCategory === "all" ||
          item.libraryItem?.category === libraryCategory;
        return matchesSearch && matchesFilter && matchesCategory;
      }),
    [baseAssets, filter, libraryCategory, search, section],
  );

  const rememberRecent = (item: DisplayAsset) => {
    const key = itemKey(item.source, item.asset.id);
    setRecents((current) => {
      const next = [key, ...current.filter((value) => value !== key)].slice(0, 40);
      storeList(RECENTS_KEY, next);
      return next;
    });
  };

  const toggleFavorite = (item: DisplayAsset) => {
    const key = itemKey(item.source, item.asset.id);
    setFavorites((current) => {
      const next = current.includes(key)
        ? current.filter((value) => value !== key)
        : [key, ...current];
      storeList(FAVORITES_KEY, next);
      return next;
    });
  };

  const addAsset = (item: DisplayAsset) => {
    rememberRecent(item);
    if (item.source === "kiro" && item.libraryItem)
      onAddLibraryAsset(item.libraryItem);
    else onAddToTimeline(item.asset);
  };

  const duration = (seconds?: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const sectionTitle = {
    mine: "Meus arquivos",
    kiro: "KIRO Library",
    favorites: "Favoritos",
    recent: "Recentes",
  }[section];

  return (
    <aside className="panel media-panel">
      <div className="library-heading">
        <div>
          <span className="eyebrow">
            {section === "kiro" ? "CATÁLOGO KIRO" : "BIBLIOTECA"}
          </span>
          <h2>
            {sectionTitle} <small>{visibleAssets.length}</small>
          </h2>
        </div>
        <div className="library-view-toggle" aria-label="Visualização da biblioteca">
          <button
            className={view === "grid" ? "active" : ""}
            aria-label="Grade"
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={15} />
          </button>
          <button
            className={view === "list" ? "active" : ""}
            aria-label="Lista"
            onClick={() => setView("list")}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      <nav className="library-sections" aria-label="Áreas da biblioteca">
        <button
          className={section === "mine" ? "active" : ""}
          onClick={() => setSection("mine")}
        >
          <FolderOpen size={14} /> Meus arquivos
        </button>
        <button
          className={section === "kiro" ? "active" : ""}
          onClick={() => setSection("kiro")}
        >
          <Sparkles size={14} /> KIRO Library
        </button>
        <button
          className={section === "favorites" ? "active" : ""}
          onClick={() => setSection("favorites")}
        >
          <Heart size={14} /> Favoritos
        </button>
        <button
          className={section === "recent" ? "active" : ""}
          onClick={() => setSection("recent")}
        >
          <Clock3 size={14} /> Recentes
        </button>
      </nav>

      {section === "mine" && (
        <>
          <label
            className={`import-dropzone ${busy ? "disabled" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) onImport(e.dataTransfer.files);
            }}
          >
            <Upload size={26} />
            <strong>{busy ? "Importando…" : "Importar arquivos"}</strong>
            <span>Ou arraste vídeos, imagens e áudios para esta área</span>
            <input
              aria-label="Importar mídia"
              hidden
              type="file"
              accept="video/*,audio/*,image/*"
              multiple
              disabled={busy}
              onChange={(e) => {
                onImport(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          <div className="library-audio-entry">
            <label className={`button audio-import-button ${busy ? "disabled" : ""}`}>
              <Music2 size={16} />
              <span>Importar áudio</span>
              <input
                aria-label="Importar áudio"
                hidden
                type="file"
                accept="audio/*"
                multiple
                disabled={busy}
                onChange={(e) => {
                  setFilter("audio");
                  onImport(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <small>
              Músicas, narrações e efeitos. Depois use + para inserir na timeline.
            </small>
          </div>
          <p className="library-source-note">
            Seus arquivos pessoais continuam guardados neste navegador e não são
            publicados na KIRO Library.
          </p>
        </>
      )}

      {section === "kiro" && (
        <>
          <div className="kiro-library-hero">
            <strong>Catálogo para quem usa o KIRO Editor</strong>
            <span>
              Aqui entrarão vídeos, imagens, músicas, efeitos, overlays e templates
              liberados pela KIRO Produções. O acervo interno da produtora fica em
              uma área administrativa separada e não é enviado ao navegador.
            </span>
          </div>
          <div className="library-category-row" aria-label="Categorias KIRO Library">
            {[
              ["all", "Todos"],
              ["video", "Vídeos"],
              ["image", "Imagens"],
              ["audio", "Áudios"],
              ["overlay", "Overlays"],
              ["template", "Templates"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={libraryCategory === value ? "active" : ""}
                onClick={() =>
                  setLibraryCategory(value as "all" | LibraryCategory)
                }
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <label className="search">
        <Search size={16} />
        <input
          aria-label="Buscar mídia"
          placeholder={
            section === "kiro" ? "Buscar na KIRO Library…" : "Buscar na biblioteca…"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>

      <div className="media-filters" aria-label="Filtros da biblioteca">
        {[
          ["all", "Todos"],
          ["video", "Vídeos"],
          ["image", "Imagens"],
          ["audio", "Áudios"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value as Filter)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="target-track compact-target-track">
        Adicionar à trilha
        <select
          aria-label="Trilha de destino"
          value={targetTrack}
          onChange={(e) => onTargetTrack(e.target.value)}
        >
          {tracks
            .filter((t) => !t.locked && t.type !== "text")
            .map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </label>

      {section === "kiro" && catalogState === "loading" && (
        <div className="library-status-card">
          <strong>Abrindo KIRO Library…</strong>
          <span>Carregando o catálogo público autorizado.</span>
        </div>
      )}

      {section === "kiro" && catalogState === "error" && (
        <div className="library-status-card">
          <strong>KIRO Library indisponível</strong>
          <span>{catalogError}</span>
          <button onClick={() => setCatalogState("idle")}>Tentar novamente</button>
        </div>
      )}

      <div className={`asset-list asset-list-${view}`}>
        {visibleAssets.map((item) => {
          const asset = item.asset;
          const key = itemKey(item.source, asset.id);
          const favorite = favorites.includes(key);
          return (
            <article
              className={`asset-card asset-${asset.type} ${asset.path ? "" : "missing"}`}
              key={key}
              title={asset.name}
            >
              <div className="asset-thumbnail">
                {item.source === "kiro" && (
                  <span className="asset-source-badge">KIRO</span>
                )}
                {item.libraryItem?.tier === "plus" && (
                  <span className="asset-tier-badge">PLUS</span>
                )}
                {asset.thumbnail ? (
                  <img src={asset.thumbnail} alt="" />
                ) : (
                  <span>{asset.type === "audio" ? "♫" : "▧"}</span>
                )}
                {!!asset.duration && <small>{duration(asset.duration)}</small>}
                <button
                  className={`asset-favorite ${favorite ? "active" : ""}`}
                  aria-label={favorite ? `Remover ${asset.name} dos favoritos` : `Favoritar ${asset.name}`}
                  title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                  onClick={() => toggleFavorite(item)}
                >
                  <Heart size={13} fill={favorite ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="asset-copy">
                <strong>{asset.name}</strong>
                <small>
                  {item.source === "kiro" && item.libraryItem
                    ? `${libraryAssetLabel(item.libraryItem)} · KIRO Library`
                    : asset.path
                      ? { audio: "Áudio", video: "Vídeo", image: "Imagem" }[
                          asset.type
                        ]
                      : "Arquivo ausente"}
                </small>
              </div>
              {asset.path ? (
                <button
                  className="asset-add"
                  aria-label={`Adicionar ${asset.name}`}
                  title="Adicionar à timeline"
                  onClick={() => addAsset(item)}
                >
                  <Plus size={17} />
                </button>
              ) : item.source === "mine" ? (
                <label className="relink" title="Reconectar arquivo">
                  <Link2 size={17} />
                  <input
                    aria-label={`Reconectar ${asset.name}`}
                    hidden
                    type="file"
                    accept={`${asset.type}/*`}
                    onChange={(e) => {
                      if (e.target.files?.[0]) onRelink(asset.id, e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : null}
            </article>
          );
        })}
      </div>

      {!visibleAssets.length && section === "kiro" && catalogState === "ready" && (
        <div className="library-status-card">
          <strong>Catálogo público preparado</strong>
          <span>
            A estrutura já está separada do acervo interno. O próximo passo é
            conectar o armazenamento e publicar os primeiros assets autorizados.
          </span>
        </div>
      )}

      {!visibleAssets.length && section === "favorites" && (
        <div className="library-status-card">
          <strong>Nenhum favorito ainda</strong>
          <span>Use o coração nos arquivos para montar sua coleção rápida.</span>
        </div>
      )}

      {!visibleAssets.length && section === "recent" && (
        <div className="library-status-card">
          <strong>Nenhum item recente</strong>
          <span>Os arquivos adicionados à timeline aparecerão aqui.</span>
        </div>
      )}

      {!visibleAssets.length && section === "mine" && !!assets.length && (
        <div className="library-empty">Nenhum arquivo neste filtro.</div>
      )}
      {section === "mine" && !assets.length && (
        <p className="panel-tip">
          Seus arquivos ficam guardados neste navegador enquanto você edita.
        </p>
      )}
    </aside>
  );
}
