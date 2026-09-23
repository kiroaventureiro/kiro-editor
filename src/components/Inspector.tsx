import type { Clip, MediaAsset, ProjectSettings } from '../editor/types';

interface Props {
  settings: ProjectSettings;
  selectedAsset?: MediaAsset;
  selectedClip?: Clip;
  onAspectChange: (ratio: ProjectSettings['aspectRatio']) => void;
  onClipChange: (patch: Partial<Clip>) => void;
}

export default function Inspector({ settings, selectedAsset, selectedClip, onAspectChange, onClipChange }: Props) {
  return (
    <aside className="panel inspector">
      <h2>Ajustes</h2>
      <label>Formato do projeto
        <select value={settings.aspectRatio} onChange={e => onAspectChange(e.target.value as ProjectSettings['aspectRatio'])}>
          <option value="16:9">YouTube · 16:9</option>
          <option value="9:16">Shorts / Reels · 9:16</option>
          <option value="1:1">Quadrado · 1:1</option>
          <option value="4:5">Feed · 4:5</option>
        </select>
      </label>
      <div className="info-card"><strong>{settings.width} × {settings.height}</strong><span>{settings.fps} fps</span></div>

      {selectedClip ? (
        <>
          <h3>Clipe selecionado</h3>
          <div className="info-card"><strong>{selectedClip.name}</strong><span>{selectedClip.duration.toFixed(1)} s</span></div>
          {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
            <label>Volume
              <input type="range" min="0" max="1" step="0.05" value={selectedClip.volume ?? 1} onChange={e => onClipChange({ volume: Number(e.target.value) })}/>
            </label>
          )}
          {selectedClip.type === 'video' && (
            <label>Velocidade
              <select value={selectedClip.speed ?? 1} onChange={e => onClipChange({ speed: Number(e.target.value) })}>
                <option value="0.5">0,5×</option><option value="0.75">0,75×</option><option value="1">1×</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option><option value="2">2×</option>
              </select>
            </label>
          )}
        </>
      ) : selectedAsset ? (
        <><h3>Mídia selecionada</h3><div className="info-card"><strong>{selectedAsset.name}</strong><span>{selectedAsset.type}</span></div></>
      ) : <p className="panel-tip">Selecione uma mídia ou um clipe para editar suas propriedades.</p>}
    </aside>
  );
}
