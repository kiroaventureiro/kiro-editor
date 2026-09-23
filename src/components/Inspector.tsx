import { Gauge, MonitorUp, SlidersHorizontal, Volume2 } from 'lucide-react';
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
      <div className="panel-heading inspector-heading">
        <span className="panel-kicker">PROPRIEDADES</span>
        <h2>Ajustes</h2>
      </div>

      <section className="inspector-section">
        <div className="inspector-section-title"><MonitorUp size={14}/><span>Projeto</span></div>
        <label>Formato
          <select value={settings.aspectRatio} onChange={e => onAspectChange(e.target.value as ProjectSettings['aspectRatio'])}>
            <option value="16:9">YouTube · 16:9</option>
            <option value="9:16">Shorts / Reels · 9:16</option>
            <option value="1:1">Quadrado · 1:1</option>
            <option value="4:5">Feed · 4:5</option>
          </select>
        </label>
        <div className="project-specs">
          <span><strong>{settings.width} × {settings.height}</strong><small>resolução</small></span>
          <span><strong>{settings.fps}</strong><small>fps</small></span>
        </div>
      </section>

      {selectedClip ? (
        <section className="inspector-section inspector-section-active">
          <div className="inspector-section-title"><SlidersHorizontal size={14}/><span>Clipe</span></div>
          <div className="selected-item-card">
            <strong>{selectedClip.name}</strong>
            <span>{selectedClip.duration.toFixed(1)} s</span>
          </div>

          {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
            <label className="control-row">
              <span className="control-label"><Volume2 size={13}/>Volume <b>{Math.round((selectedClip.volume ?? 1) * 100)}%</b></span>
              <input type="range" min="0" max="1" step="0.05" value={selectedClip.volume ?? 1} onChange={e => onClipChange({ volume: Number(e.target.value) })}/>
            </label>
          )}

          {selectedClip.type === 'video' && (
            <label>
              <span className="control-label"><Gauge size={13}/>Velocidade</span>
              <select value={selectedClip.speed ?? 1} onChange={e => onClipChange({ speed: Number(e.target.value) })}>
                <option value="0.5">0,5×</option><option value="0.75">0,75×</option><option value="1">1× normal</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option><option value="2">2×</option>
              </select>
            </label>
          )}
        </section>
      ) : selectedAsset ? (
        <section className="inspector-section inspector-section-active">
          <div className="inspector-section-title"><SlidersHorizontal size={14}/><span>Mídia</span></div>
          <div className="selected-item-card"><strong>{selectedAsset.name}</strong><span>{selectedAsset.type}</span></div>
        </section>
      ) : (
        <div className="inspector-empty">
          <SlidersHorizontal size={20}/>
          <strong>Nada selecionado</strong>
          <span>Selecione um clipe na timeline para ver os controles.</span>
        </div>
      )}
    </aside>
  );
}
