import { Grid2X2, Link2, List, Music2, Plus, Search, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { MediaAsset, Track } from "../editor/types";

interface Props {
  tracks: Track[];
  targetTrack: string;
  onTargetTrack: (id: string) => void;
  assets: MediaAsset[];
  onImport: (files: FileList | null) => void;
  onAddToTimeline: (asset: MediaAsset) => void;
  onRelink: (id: string, file: File) => void;
  busy: boolean;
}

type Filter = "all" | MediaAsset["type"];

export default function MediaLibrary({
  tracks,
  targetTrack,
  onTargetTrack,
  assets,
  onImport,
  onAddToTimeline,
  onRelink,
  busy,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const visibleAssets = useMemo(
    () =>
      assets.filter((asset) => {
        const matchesSearch = asset.name
          .toLowerCase()
          .includes(search.trim().toLowerCase());
        const matchesFilter = filter === "all" || asset.type === filter;
        return matchesSearch && matchesFilter;
      }),
    [assets, filter, search],
  );

  const duration = (seconds?: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <aside className="panel media-panel">
      <div className="library-heading">
        <div>
          <span className="eyebrow">SEU MATERIAL</span>
          <h2>
            Biblioteca <small>{assets.length}</small>
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
        <small>Músicas, narrações e efeitos. Depois use + para inserir na timeline.</small>
      </div>

      <label className="search">
        <Search size={16} />
        <input
          aria-label="Buscar mídia"
          placeholder="Buscar na biblioteca…"
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

      <div className={`asset-list asset-list-${view}`}>
        {visibleAssets.map((asset) => (
          <article
            className={`asset-card asset-${asset.type} ${asset.path ? "" : "missing"}`}
            key={asset.id}
            title={asset.name}
          >
            <div className="asset-thumbnail">
              {asset.thumbnail ? (
                <img src={asset.thumbnail} alt="" />
              ) : (
                <span>{asset.type === "audio" ? "♫" : "▧"}</span>
              )}
              {!!asset.duration && <small>{duration(asset.duration)}</small>}
            </div>
            <div className="asset-copy">
              <strong>{asset.name}</strong>
              <small>
                {asset.path
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
                onClick={() => onAddToTimeline(asset)}
              >
                <Plus size={17} />
              </button>
            ) : (
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
            )}
          </article>
        ))}
      </div>

      {!visibleAssets.length && !!assets.length && (
        <div className="library-empty">Nenhum arquivo neste filtro.</div>
      )}
      {!assets.length && (
        <p className="panel-tip">
          Seus arquivos ficam guardados neste navegador enquanto você edita.
        </p>
      )}
    </aside>
  );
}
