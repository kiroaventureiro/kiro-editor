import { Download, FolderOpen, Redo2, Save, Sparkles, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import MediaLibrary from './components/MediaLibrary';
import Preview from './components/Preview';
import Inspector from './components/Inspector';
import Timeline from './components/Timeline';
import { createEmptyProject, projectPresets } from './editor/project';
import type { Clip, KiroProject, MediaAsset, ProjectSettings, TrackType } from './editor/types';

const STORAGE_KEY = 'kiro-editor-project-v01';
const HISTORY_LIMIT = 50;

type ProjectMutation = (project: KiroProject) => KiroProject;

export default function App() {
  const [project, setProject] = useState<KiroProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : createEmptyProject();
    } catch { return createEmptyProject(); }
  });
  const [undoStack, setUndoStack] = useState<KiroProject[]>([]);
  const [redoStack, setRedoStack] = useState<KiroProject[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>();
  const [selectedClipId, setSelectedClipId] = useState<string>();
  const [playhead, setPlayhead] = useState(0);
  const [notice, setNotice] = useState('Pronto para criar.');
  const [timelineTransactionOpen, setTimelineTransactionOpen] = useState(false);

  const selectedAsset = useMemo(() => project.assets.find(a => a.id === selectedAssetId), [project.assets, selectedAssetId]);
  const selectedClip = useMemo(() => project.tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId), [project.tracks, selectedClipId]);

  const pushUndoSnapshot = (snapshot: KiroProject) => {
    setUndoStack(stack => [...stack, snapshot].slice(-HISTORY_LIMIT));
    setRedoStack([]);
  };

  const commitProject = (mutation: ProjectMutation) => {
    setProject(current => {
      pushUndoSnapshot(current);
      return mutation(current);
    });
  };

  const undo = () => {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(stack => [...stack, project].slice(-HISTORY_LIMIT));
    setUndoStack(stack => stack.slice(0, -1));
    setProject(previous);
    setSelectedClipId(undefined);
    setPlayhead(0);
    setNotice('Alteração desfeita.');
  };

  const redo = () => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(stack => [...stack, project].slice(-HISTORY_LIMIT));
    setRedoStack(stack => stack.slice(0, -1));
    setProject(next);
    setSelectedClipId(undefined);
    setPlayhead(0);
    setNotice('Alteração refeita.');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      } else if (key === 's') {
        event.preventDefault();
        saveProject();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

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

    const first = newAssets[0];
    let autoAdded = false;
    let autoClipId: string | undefined;

    commitProject(p => {
      const timelineEmpty = p.tracks.every(track => track.clips.length === 0);
      const shouldAutoAdd = newAssets.length === 1 && timelineEmpty && !!first;
      let tracks = p.tracks;

      if (shouldAutoAdd) {
        const trackType: TrackType = first.type === 'audio' ? 'audio' : 'video';
        const duration = first.type === 'image' ? 4 : Math.max(0.1, first.duration || 5);
        autoClipId = crypto.randomUUID();
        tracks = p.tracks.map(track => {
          if (track.type !== trackType) return track;
          const clip: Clip = {
            id: autoClipId!,
            assetId: first.id,
            name: first.name,
            type: trackType,
            start: 0,
            duration,
            sourceIn: 0,
            sourceOut: duration,
            volume: 1,
            speed: 1,
          };
          return { ...track, clips: [...track.clips, clip] };
        });
        autoAdded = true;
      }

      return {
        ...p,
        assets: [...p.assets, ...newAssets],
        tracks,
        updatedAt: new Date().toISOString(),
      };
    });

    setSelectedAssetId(first?.id);
    if (autoAdded && autoClipId) {
      setSelectedClipId(autoClipId);
      setPlayhead(0);
      setNotice(`${first.name} foi importado e adicionado automaticamente à timeline.`);
    } else {
      setNotice(`${newAssets.length} arquivo(s) importado(s). Use + para adicionar à timeline.`);
    }
  };

  const addToTimeline = (asset: MediaAsset) => {
    const trackType: TrackType = asset.type === 'audio' ? 'audio' : 'video';
    const duration = asset.type === 'image' ? 4 : Math.max(0.1, asset.duration || 5);
    commitProject(p => {
      const tracks = p.tracks.map(track => {
        if (track.type !== trackType) return track;
        const start = track.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
        const clip: Clip = { id: crypto.randomUUID(), assetId: asset.id, name: asset.name, type: trackType, start, duration, sourceIn: 0, sourceOut: duration, volume: 1, speed: 1 };
        setSelectedClipId(clip.id);
        setPlayhead(start);
        return { ...track, clips: [...track.clips, clip] };
      });
      return { ...p, tracks, updatedAt: new Date().toISOString() };
    });
    setSelectedAssetId(asset.id);
    setNotice(`${asset.name} foi adicionado à timeline.`);
  };

  const updateClip = (patch: Partial<Clip>) => {
    if (!selectedClipId) return;
    commitProject(p => ({ ...p, tracks: p.tracks.map(t => ({ ...t, clips: t.clips.map(c => c.id === selectedClipId ? { ...c, ...patch } : c) })), updatedAt: new Date().toISOString() }));
  };

  const deleteClip = () => {
    if (!selectedClipId) return;
    commitProject(p => ({ ...p, tracks: p.tracks.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== selectedClipId) })), updatedAt: new Date().toISOString() }));
    setSelectedClipId(undefined);
    setNotice('Clipe removido da timeline.');
  };

  const beginTimelineEdit = () => {
    if (timelineTransactionOpen) return;
    pushUndoSnapshot(project);
    setTimelineTransactionOpen(true);
  };

  const endTimelineEdit = () => setTimelineTransactionOpen(false);

  const moveClip = (clipId: string, start: number) => {
    const safeStart = Math.max(0, start);
    setProject(p => ({
      ...p,
      tracks: p.tracks.map(track => ({ ...track, clips: track.clips.map(clip => clip.id === clipId ? { ...clip, start: safeStart } : clip) })),
      updatedAt: new Date().toISOString(),
    }));
    if (clipId === selectedClipId) setPlayhead(safeStart);
  };

  const trimClip = (clipId: string, edge: 'start' | 'end', time: number) => {
    setProject(p => ({
      ...p,
      tracks: p.tracks.map(track => ({
        ...track,
        clips: track.clips.map(clip => {
          if (clip.id !== clipId) return clip;
          const speed = clip.speed ?? 1;
          const sourceIn = clip.sourceIn ?? 0;
          const sourceOut = clip.sourceOut ?? (sourceIn + clip.duration * speed);
          const oldEnd = clip.start + clip.duration;

          if (edge === 'start') {
            const newStart = Math.min(oldEnd - 0.1, Math.max(0, time));
            const delta = newStart - clip.start;
            return {
              ...clip,
              start: newStart,
              duration: Math.max(0.1, oldEnd - newStart),
              sourceIn: Math.min(sourceOut - 0.01, Math.max(0, sourceIn + delta * speed)),
            };
          }

          const newEnd = Math.max(clip.start + 0.1, time);
          const newDuration = newEnd - clip.start;
          return {
            ...clip,
            duration: newDuration,
            sourceOut: Math.max(sourceIn + 0.01, sourceIn + newDuration * speed),
          };
        }),
      })),
      updatedAt: new Date().toISOString(),
    }));
  };

  const splitClip = () => {
    if (!selectedClip) return;
    const clipStart = selectedClip.start;
    const clipEnd = selectedClip.start + selectedClip.duration;
    const epsilon = 0.05;
    if (playhead <= clipStart + epsilon || playhead >= clipEnd - epsilon) {
      setNotice('Posicione o cursor dentro do clipe para dividir.');
      return;
    }

    const firstDuration = playhead - clipStart;
    const secondDuration = clipEnd - playhead;
    const sourceIn = selectedClip.sourceIn ?? 0;
    const splitSource = sourceIn + firstDuration * (selectedClip.speed ?? 1);
    const firstId = crypto.randomUUID();
    const secondId = crypto.randomUUID();

    commitProject(p => ({
      ...p,
      tracks: p.tracks.map(track => ({
        ...track,
        clips: track.clips.flatMap(clip => {
          if (clip.id !== selectedClip.id) return [clip];
          return [
            { ...clip, id: firstId, duration: firstDuration, sourceOut: splitSource },
            { ...clip, id: secondId, start: playhead, duration: secondDuration, sourceIn: splitSource, sourceOut: selectedClip.sourceOut ?? (sourceIn + selectedClip.duration) },
          ];
        }),
      })),
      updatedAt: new Date().toISOString(),
    }));

    setSelectedClipId(secondId);
    setNotice(`Clipe dividido em ${formatTime(firstDuration)} + ${formatTime(secondDuration)}.`);
  };

  const changeAspect = (aspectRatio: ProjectSettings['aspectRatio']) => {
    const preset = projectPresets[aspectRatio];
    commitProject(p => ({ ...p, settings: { ...p.settings, aspectRatio, ...preset }, updatedAt: new Date().toISOString() }));
  };

  function saveProject() {
    const serializable = {
      ...project,
      assets: project.assets.map(asset => ({ ...asset, path: '' })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    setNotice('Projeto salvo. As mídias precisarão ser reconectadas após recarregar a página.');
  }

  const newProject = () => {
    if (!confirm('Criar um novo projeto? A timeline atual será limpa.')) return;
    pushUndoSnapshot(project);
    setProject(createEmptyProject());
    setSelectedAssetId(undefined);
    setSelectedClipId(undefined);
    setPlayhead(0);
    setNotice('Novo projeto criado.');
  };

  const previewAsset = selectedClip?.assetId ? project.assets.find(a => a.id === selectedClip.assetId) : selectedAsset;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">K</span><div><strong>KIRO Editor</strong><small>0.4 · Histórico de edição</small></div></div>
        <div className="project-name"><strong>{project.name}</strong><small>{notice}</small></div>
        <div className="top-actions">
          <button className="ghost" onClick={newProject}><FolderOpen size={17}/> Novo</button>
          <button className="ghost" onClick={saveProject}><Save size={17}/> Salvar</button>
          <button className="ghost" onClick={undo} disabled={!undoStack.length} title="Desfazer (Ctrl+Z)"><Undo2 size={17}/> Desfazer</button>
          <button className="ghost" onClick={redo} disabled={!redoStack.length} title="Refazer (Ctrl+Y)"><Redo2 size={17}/> Refazer</button>
          <button className="ghost" disabled title="KIRO IA entra na fase 2"><Sparkles size={17}/> KIRO IA</button>
          <button className="primary" disabled title="Exportação real entra depois da edição base"><Download size={17}/> Exportar</button>
        </div>
      </header>

      <main className="workspace">
        <MediaLibrary assets={project.assets} selectedAssetId={selectedAssetId} onImport={importFiles} onSelect={(asset) => { setSelectedAssetId(asset.id); setSelectedClipId(undefined); }} onAddToTimeline={addToTimeline} />
        <Preview asset={previewAsset} settings={project.settings} clip={selectedClip} playhead={playhead} onPlayheadChange={setPlayhead} />
        <Inspector settings={project.settings} selectedAsset={selectedAsset} selectedClip={selectedClip} onAspectChange={changeAspect} onClipChange={updateClip} />
      </main>

      <Timeline
        tracks={project.tracks}
        selectedClipId={selectedClipId}
        playhead={playhead}
        onSeek={setPlayhead}
        onSplit={splitClip}
        onMoveClip={moveClip}
        onTrimClip={trimClip}
        onEditStart={beginTimelineEdit}
        onEditEnd={endTimelineEdit}
        onSelectClip={(clip) => { setSelectedClipId(clip.id); setSelectedAssetId(clip.assetId); setPlayhead(clip.start); }}
        onDelete={deleteClip}
      />
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

function formatTime(seconds: number) {
  return `${Math.max(0, seconds).toFixed(1)}s`;
}
