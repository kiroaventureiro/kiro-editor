import { Plus, Upload, Search, Link2 } from "lucide-react";
import { useState } from "react";
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
  return (
    <aside className="panel media-panel">
      <div className="panel-heading">
        <span className="eyebrow">SEU MATERIAL</span>
        <h2>
          Biblioteca <small>{assets.length}</small>
        </h2>
      </div>
      <label
        className={`import-dropzone ${busy ? "disabled" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) onImport(e.dataTransfer.files);
        }}
      >
        <Upload size={24} />
        <strong>{busy ? "Importando…" : "Importar arquivos"}</strong>
        <span>Ou arraste vídeos, imagens e áudios</span>
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
      <label className="search">
        <Search size={16} />
        <input
          aria-label="Buscar mídia"
          placeholder="Buscar na biblioteca"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <label className="target-track">
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
        <small>Áudios usam uma trilha de áudio compatível.</small>
      </label>
      <div className="asset-list">
        {assets
          .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
          .map((a) => (
            <article
              className={`asset-card ${a.path ? "" : "missing"}`}
              key={a.id}
            >
              <div className="asset-thumbnail">
                {a.thumbnail ? (
                  <img src={a.thumbnail} alt="" />
                ) : (
                  <span>{a.type === "audio" ? "♫" : "▧"}</span>
                )}
                {a.duration && <small>{a.duration.toFixed(1)}s</small>}
              </div>
              <div className="asset-copy">
                <strong title={a.name}>{a.name}</strong>
                <small>
                  {a.path
                    ? { audio: "Áudio", video: "Vídeo", image: "Imagem" }[
                        a.type
                      ]
                    : "Arquivo ausente"}
                </small>
              </div>
              {a.path ? (
                <button
                  aria-label={`Adicionar ${a.name}`}
                  onClick={() => onAddToTimeline(a)}
                >
                  <Plus size={18} />
                </button>
              ) : (
                <label className="relink" title="Reconectar arquivo">
                  <Link2 size={18} />
                  <input
                    aria-label={`Reconectar ${a.name}`}
                    hidden
                    type="file"
                    accept={`${a.type}/*`}
                    onChange={(e) => {
                      if (e.target.files?.[0])
                        onRelink(a.id, e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </article>
          ))}
      </div>
      {!assets.length && (
        <p className="panel-tip">
          Seus arquivos serão guardados neste navegador. Use uma cópia do
          projeto e mantenha os originais para trabalhar em outro dispositivo.
        </p>
      )}
    </aside>
  );
}
