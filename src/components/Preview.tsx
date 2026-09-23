import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Clip, MediaAsset, ProjectSettings } from '../editor/types';

interface Props {
  asset?: MediaAsset;
  settings: ProjectSettings;
  clip?: Clip;
  playhead: number;
  onPlayheadChange: (time: number) => void;
}

export default function Preview({ asset, settings, clip, playhead, onPlayheadChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setDuration(asset?.duration || 0);
  }, [asset?.id, asset?.duration]);

  const media = asset?.type === 'video' ? videoRef.current : asset?.type === 'audio' ? audioRef.current : null;

  useEffect(() => {
    if (!media || !clip) return;
    const speed = clip.speed ?? 1;
    const sourceIn = clip.sourceIn ?? 0;
    const local = sourceIn + Math.max(0, playhead - clip.start) * speed;
    const safe = Math.max(sourceIn, Math.min(clip.sourceOut ?? media.duration ?? local, local));
    if (Number.isFinite(safe) && Math.abs(media.currentTime - safe) > 0.08) {
      media.currentTime = safe;
      setTime(safe);
    }
    media.playbackRate = Math.max(0.25, Math.min(4, speed));
    media.volume = Math.max(0, Math.min(1, clip.volume ?? 1));
  }, [playhead, clip?.id, clip?.start, clip?.sourceIn, clip?.sourceOut, clip?.speed, clip?.volume, media]);

  const toggle = () => {
    if (!media) return;
    if (media.paused) void media.play(); else media.pause();
  };

  const seek = (delta: number) => {
    if (clip) {
      const target = Math.max(clip.start, Math.min(clip.start + clip.duration, playhead + delta));
      onPlayheadChange(target);
      return;
    }
    if (!media) return;
    media.currentTime = Math.max(0, Math.min(media.duration || 0, media.currentTime + delta));
  };

  const handleTimeUpdate = (currentTime: number) => {
    setTime(currentTime);
    if (!clip || !playing) return;
    const speed = clip.speed ?? 1;
    const sourceIn = clip.sourceIn ?? 0;
    const globalTime = clip.start + Math.max(0, currentTime - sourceIn) / speed;
    const clipEnd = clip.start + clip.duration;
    if (globalTime >= clipEnd - 0.03) {
      media?.pause();
      onPlayheadChange(clipEnd);
      return;
    }
    onPlayheadChange(globalTime);
  };

  const ratio = settings.aspectRatio.replace(':', ' / ');

  return (
    <section className="preview-wrap">
      <div className="preview-stage">
        <div className="preview-frame" style={{ aspectRatio: ratio }}>
          {!asset && <div className="preview-empty"><div className="portal-glow"/><span>Importe uma mídia para começar</span></div>}
          {asset?.type === 'video' && (
            <video
              ref={videoRef}
              src={asset.path}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            />
          )}
          {asset?.type === 'image' && <img src={asset.path} alt={asset.name}/>} 
          {asset?.type === 'audio' && <div className="audio-preview"><FileWave/><strong>{asset.name}</strong><span>Prévia de áudio</span><audio ref={audioRef} src={asset.path} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} /></div>}
        </div>
      </div>
      <div className="transport">
        <button onClick={() => seek(-5)} disabled={!asset}><SkipBack size={16}/></button>
        <button className="play" onClick={toggle} disabled={!media}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button>
        <button onClick={() => seek(5)} disabled={!asset}><SkipForward size={16}/></button>
        <span className="timecode">{clip ? `${formatTime(playhead)} · ` : ''}{formatTime(time)} / {formatTime(duration)}</span>
      </div>
    </section>
  );
}

function FileWave() {
  return <div className="waveform">▂▅▃▇▆▂▅▇▃▆▂▇</div>;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '00:00';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
