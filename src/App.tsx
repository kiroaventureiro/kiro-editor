import { Download, FolderOpen, Save, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import MediaLibrary from './components/MediaLibrary';
import Preview from './components/Preview';
import Inspector from './components/Inspector';
import Timeline from './components/Timeline';
import { createEmptyProject, projectPresets } from './editor/project';
import type { Clip, KiroProject, MediaAsset, ProjectSettings, TrackType } from './editor/types';

const STORAGE_KEY = 'kiro-editor-project-v01';

export default function App() {
  const [project, setProject] = useState<KiroProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : createEmptyProject();
    } catch { return createEmptyProject(); }
  });
  const [selectedAssetId, setSelectedAssetId] = useState<string>();
  const [selectedClipId, setSelectedClipId] = useState<string>();
  const [notice, setNotice] = useState('Pronto para criar.');

  const selectedAsset = useMemo(() => project.assets.find(a => a.id === selectedAssetId), [project.assets, selectedAssetId]);
  const selectedClip = useMemo(() => project.tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId), [project.tracks, selectedClipId]);

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const newAssets: MediaAsset[] = [];
    for (const file of Array.from(files)) {
      const type: MediaAsset['type'] = file.type.startsWith('audio') ? 'audio' : file.type.startsWith('image') ? 'image' : 'video';
      const url = URL.createObjectURL(file);
      let duration: number | undefined;
      if (type !== 'image') duration = await readDuration(url, type);
      newAssets.push({ id: crypto.randomUUID(), name: file.name, type, path: url, duration, size: file.size });
    }
    setProject(p => ({ ...p, assets: [...p.assets, ...newAssets], updatedAt: new Date().toISOString() }));
    setSelectedAssetId(newAssets[0]?.id);
    setNotice(`${newAssets.length} arquivo(s) importado(s).`);
  };

  const addToTimeline = (asset: MediaAsset) => {
    const trackType: TrackType = asset.type === 'audio' ? 'audio' : 'video';
    const duration = asset.type === 'image' ? 4 : Math.max(0.1, asset.duration || 5);
    setProject(p => {
      const tracks = p.tracks.map(track => {
        if (track.type !== trackType) return track;
        const start = track.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
        const clip: Clip = { id: crypto.randomUUID(), assetId: asset.id, name: asset.name, type: trackType, start, duration, volume: 1, speed: 1 };
        setSelectedClipId(clip.id);
        return { ...track, clips: [...track.clips, clip] };
      });
      return { ...p, tracks, updatedAt: new Date().toISOString() };
    });
    setSelectedAssetId(asset.id);
    setNotice(`${asset.name} foi adicionado à timeline.`);
  };

  const updateClip = (patch: Partial<Clip>) => {
    if (!selectedClipId) return;
    setProject(p => ({ ...p, tracks: p.tracks.map(t => ({ ...t, clips: t.clips.map(c => c.id === selectedClipId ? { ...c, ...patch } : c) })), updatedAt: new Date().toISOString() }));
  };

  const deleteClip = () => {
    if (!selectedClipId) return;
    setProject(p => ({ ...p, tracks: p.tracks.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== selectedClipId) })), updatedAt: new Date().toISOString() }));
    setSelectedClipId(undefined);
    setNotice('Clipe removido da timeline.');
  };

  const changeAspect = (aspectRatio: ProjectSettings['aspectRatio']) => {
    const preset = projectPresets[aspectRatio];
    setProject(p => ({ ...p, settings: { ...p.settings, aspectRatio, ...preset }, updatedAt: new Date().toISOString() }));
  };

  const saveProject = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...project, assets: [] }));
    setNotice('Estrutura do projeto salva neste computador.');
  };

  const newProject = () => {
    if (!confirm('Criar um novo projeto? A timeline atual será limpa.')) return;
    setProject(createEmptyProject()); setSelectedAssetId(undefined); setSelectedClipId(undefined); setNotice('Novo projeto criado.');
  };

  const previewAsset = selectedClip?.assetId ? project.assets.find(a => a.id === selectedClip.assetId) : selectedAsset;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">K</span><div><strong>KIRO Editor</strong><small>0.3 · Web + Mobile</small></div></div>
        <div className="project-name"><strong>{project.name}</strong><small>{notice}</small></div>
        <div className="top-actions">
          <button className="ghost" onClick={newProject}><FolderOpen size={17}/> Novo</button>
          <button className="ghost" onClick={saveProject}><Save size={17}/> Salvar</button>
          <button className="ghost" disabled title="KIRO IA entra na fase 2"><Sparkles size={17}/> KIRO IA</button>
          <button className="primary" disabled title="Exportação real com FFmpeg entra no próximo marco"><Download size={17}/> Exportar</button>
        </div>
      </header>

      <main className="workspace">
        <MediaLibrary assets={project.assets} selectedAssetId={selectedAssetId} onImport={importFiles} onSelect={(asset) => { setSelectedAssetId(asset.id); setSelectedClipId(undefined); }} onAddToTimeline={addToTimeline} />
        <Preview asset={previewAsset} settings={project.settings} />
        <Inspector settings={project.settings} selectedAsset={selectedAsset} selectedClip={selectedClip} onAspectChange={changeAspect} onClipChange={updateClip} />
      </main>

      <Timeline tracks={project.tracks} selectedClipId={selectedClipId} onSelectClip={(clip) => { setSelectedClipId(clip.id); setSelectedAssetId(clip.assetId); }} onDelete={deleteClip} />
    </div>
  );
}

function readDuration(url: string, type: 'video' | 'audio') {
  return new Promise<number>((resolve) => {
    const el = document.createElement(type);
    el.preload = 'metadata'; el.src = url;
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 5);
    el.onerror = () => resolve(5);
  });
}
