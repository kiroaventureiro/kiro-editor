import { FileAudio, FileImage, FileVideo, Plus, Upload } from 'lucide-react';
import type { MediaAsset } from '../editor/types';

interface Props {
  assets: MediaAsset[];
  selectedAssetId?: string;
  onImport: (files: FileList | null) => void;
  onSelect: (asset: MediaAsset) => void;
  onAddToTimeline: (asset: MediaAsset) => void;
}

function AssetIcon({ type }: { type: MediaAsset['type'] }) {
  if (type === 'audio') return <FileAudio size={16} />;
  if (type === 'image') return <FileImage size={16} />;
  return <FileVideo size={16} />;
}

export default function MediaLibrary({ assets, selectedAssetId, onImport, onSelect, onAddToTimeline }: Props) {
  const videos = assets.filter(asset => asset.type === 'video').length;
  const audio = assets.filter(asset => asset.type === 'audio').length;
  const images = assets.filter(asset => asset.type === 'image').length;

  return (
    <aside className="panel media-panel">
      <div className="panel-title-row">
        <div className="panel-heading">
          <span className="panel-kicker">ARQUIVOS</span>
          <h2>Biblioteca</h2>
        </div>
        <span className="panel-count">{assets.length}</span>
      </div>

      <label className="import-button import-dropzone">
        <span className="import-icon"><Upload size={17}/></span>
        <span className="import-copy"><strong>Importar mídia</strong><small>Vídeo, imagem ou áudio</small></span>
        <input hidden type="file" accept="video/*,audio/*,image/*" multiple onChange={(e) => onImport(e.target.files)} />
      </label>

      {assets.length > 0 && (
        <div className="library-stats" aria-label="Resumo da biblioteca">
          <span><FileVideo size={12}/>{videos}</span>
          <span><FileAudio size={12}/>{audio}</span>
          <span><FileImage size={12}/>{images}</span>
        </div>
      )}

      {assets.length === 0 ? (
        <div className="empty-card media-empty">
          <div className="empty-media-icon"><Upload size={20}/></div>
          <strong>Comece pela sua mídia</strong>
          <span>Os arquivos ficam disponíveis aqui para você montar a edição.</span>
        </div>
      ) : (
        <div className="asset-list">
          {assets.map(asset => (
            <button
              key={asset.id}
              className={`asset-card ${selectedAssetId === asset.id ? 'selected' : ''}`}
              onClick={() => onSelect(asset)}
              onDoubleClick={() => onAddToTimeline(asset)}
              title="Duplo clique para colocar na timeline"
            >
              <span className={`asset-icon asset-icon-${asset.type}`}><AssetIcon type={asset.type}/></span>
              <span className="asset-copy">
                <strong>{asset.name}</strong>
                <small>{asset.type} {asset.duration ? `· ${formatDuration(asset.duration)}` : ''}</small>
              </span>
              <span className="asset-plus" onClick={(e) => { e.stopPropagation(); onAddToTimeline(asset); }} title="Adicionar à timeline"><Plus size={15}/></span>
            </button>
          ))}
        </div>
      )}
      <p className="panel-tip">Duplo clique ou + para enviar um arquivo à timeline.</p>
    </aside>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}
