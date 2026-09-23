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
  return (
    <aside className="panel media-panel">
      <div className="panel-title-row"><h2>Mídia</h2><Plus size={16}/></div>
      <label className="import-button">
        <Upload size={16}/> Importar arquivos
        <input hidden type="file" accept="video/*,audio/*,image/*" multiple onChange={(e) => onImport(e.target.files)} />
      </label>

      {assets.length === 0 ? (
        <div className="empty-card">
          <strong>Sua biblioteca está vazia</strong>
          <span>Importe vídeos, imagens ou músicas do computador.</span>
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
              <span className="asset-icon"><AssetIcon type={asset.type}/></span>
              <span className="asset-copy"><strong>{asset.name}</strong><small>{asset.type} {asset.duration ? `· ${asset.duration.toFixed(1)}s` : ''}</small></span>
              <span className="asset-plus" onClick={(e) => { e.stopPropagation(); onAddToTimeline(asset); }}><Plus size={15}/></span>
            </button>
          ))}
        </div>
      )}
      <p className="panel-tip">Dica: clique em + ou dê duplo clique para adicionar à timeline.</p>
    </aside>
  );
}
