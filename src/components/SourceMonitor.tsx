import { FileVideo2, Image as ImageIcon, Music2 } from "lucide-react";
import type { Clip, MediaAsset } from "../editor/types";

interface Props {
  asset?: MediaAsset;
  clip?: Clip;
}

export default function SourceMonitor({ asset, clip }: Props) {
  const seekToSource = (event: React.SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) => {
    const sourceIn = clip?.sourceIn ?? 0;
    if (sourceIn > 0 && event.currentTarget.currentTime < sourceIn) {
      event.currentTarget.currentTime = sourceIn;
    }
  };

  return (
    <section className="source-monitor" aria-label="Monitor de origem">
      <header className="source-monitor-heading">
        <div>
          <span className="monitor-kicker">SOURCE · MONITOR DE ORIGEM</span>
          <strong title={asset?.name ?? "Nenhuma mídia selecionada"}>
            {asset?.name ?? "Selecione uma mídia"}
          </strong>
        </div>
        {asset && <span className="source-kind">{asset.type === "video" ? "VÍDEO" : asset.type === "image" ? "IMAGEM" : "ÁUDIO"}</span>}
      </header>

      <div className="source-monitor-stage">
        {asset?.type === "video" && asset.path ? (
          <video
            key={asset.id}
            src={asset.path}
            poster={asset.thumbnail}
            controls
            preload="metadata"
            playsInline
            onLoadedMetadata={seekToSource}
            aria-label={`Prévia da mídia ${asset.name}`}
          />
        ) : asset?.type === "image" && asset.path ? (
          <img src={asset.path} alt={asset.name} />
        ) : asset?.type === "audio" && asset.path ? (
          <div className="source-audio">
            <Music2 size={34} aria-hidden="true" />
            <strong>{asset.name}</strong>
            <audio
              key={asset.id}
              src={asset.path}
              controls
              preload="metadata"
              onLoadedMetadata={seekToSource}
              aria-label={`Prévia do áudio ${asset.name}`}
            />
          </div>
        ) : (
          <div className="source-empty">
            <FileVideo2 size={30} aria-hidden="true" />
            <strong>Monitor de origem</strong>
            <span>Selecione um clipe na timeline para revisar a mídia original.</span>
          </div>
        )}
      </div>

      <footer className="source-monitor-footer">
        {asset
          ? `${asset.duration ? `${Math.floor(asset.duration / 60).toString().padStart(2, "0")}:${Math.floor(asset.duration % 60).toString().padStart(2, "0")} · ` : ""}MÍDIA ORIGINAL`
          : "SOURCE"}
      </footer>
    </section>
  );
}
