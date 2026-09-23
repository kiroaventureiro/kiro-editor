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
  const animationRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const getMedia = () => asset?.type === 'video' ? videoRef.current : asset?.type === 'audio' ? audioRef.current : null;

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setDuration(asset?.duration || 0);
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
  }, [asset?.id, asset?.duration]);

  useEffect(() => {
    const media = getMedia();
    if (!media || !clip) return;

    media.playbackRate = Math.max(0.25, Math.min(4, clip.speed ?? 1));
    media.volume = Math.max(0, Math.min(1, clip.volume ?? 1));

    if (!media.paused) return;

    const speed = clip.speed ?? 1;
    const sourceIn = clip.sourceIn ?? 0;
    const sourceOut = clip.sourceOut ?? media.duration;
    const local = sourceIn + Math.max(0, playhead - clip.start) * speed;
    const safe = Math.max(sourceIn, Math.min(sourceOut, local));

    if (Number.isFinite(safe) && Math.abs(media.currentTime - safe) > 0.05) {
      media.currentTime = safe;
      setTime(safe);
    }
  }, [playhead, clip?.id, clip?.start, clip?.sourceIn, clip?.sourceOut, clip?.speed, clip?.volume, asset?.id]);

  useEffect(() => {
    if (!playing || !clip) return;

    const tick = () => {
      const media = getMedia();
      if (!media || media.paused) return;

      const speed = clip.speed ?? 1;
      const sourceIn = clip.sourceIn ?? 0;
      const clipEnd = clip.start + clip.duration;
      const globalTime = clip.start + Math.max(0, media.currentTime - sourceIn) / speed;

      setTime(media.currentTime);

      if (globalTime >= clipEnd - 0.02) {
        media.pause();
        onPlayheadChange(clipEnd);
        return;
      }

      onPlayheadChange(globalTime);
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [playing, clip?.id, clip?.start, clip?.duration, clip?.sourceIn, clip?.speed, asset?.id]);

  const toggle = () => {
    const media = getMedia();
    if (!media) return;
    if (media.paused) void media.play(); else media.pause();
  };

  const seek = (delta: number) => {
    if (clip) {
      const target = Math.max(clip.start, Math.min(clip.start + clip.duration, playhead + delta));
      onPlayheadChange(target);
      return;
    }
    const media = getMedia();
    if (!media) return;
    media.currentTime = Math.max(0, Math.min(media.duration || 0, media.currentTime + delta));
    setTime(media.currentTime);
  };

  const handleTimeUpdate = (currentTime: number) => {
    setTime(currentTime);
    if (!clip) return;

    const media = getMedia();
    if (!media || media.paused) return;

    const speed = clip.speed ?? 1;
    const sourceIn = clip.sourceIn ?? 0;
    const globalTime = clip.start + Math.max(0, currentTime - sourceIn) / speed;
    const clipEnd = clip.start + clip.duration;
    onPlayheadChange(Math.min(clipEnd, globalTime));
  };

  const handleLoadedMetadata = (media: HTMLMediaElement) => {
    setDuration(media.duration);
    if (!clip) return;
    const sourceIn = clip.sourceIn ?? 0;
    if (Number.isFinite(sourceIn)) {
      media.currentTime = sourceIn;
      setTime(sourceIn);
    }
  };

  const ratio = settings.aspectRatio.replace(':', ' / ');
  const isPortrait = settings.aspectRatio === '9:16' || settings.aspectRatio === '4:5';
  const isSquare = settings.aspectRatio === '1:1';
  const hasPlayableMedia = asset?.type === 'video' || asset?.type === 'audio';
  const frameClass = `preview-frame ${isPortrait ? 'preview-frame-portrait' : isSquare ? 'preview-frame-square' : 'preview-frame-landscape'}`;

  return (
    <section className="preview-wrap">
      <div className="preview-stage">
        <div className={frameClass} style={{ aspectRatio: ratio }}>
          {!asset && <div className="preview-empty"><div className="portal-glow"/><span>Importe uma mídia para começar</span></div>}
          {asset?.type === 'video' && (
            <video
              ref={videoRef}
              src={asset.path}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => handleLoadedMetadata(e.currentTarget)}
            />
          )}
          {asset?.type === 'image' && <img src={asset.path} alt={asset.name}/>} 
          {asset?.type === 'audio' && (
            <div className="audio-preview">
              <FileWave/><strong>{asset.name}</strong><span>Prévia de áudio</span>
              <audio
                ref={audioRef}
                src={asset.path}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => handleLoadedMetadata(e.currentTarget)}
              />
            </div>
          )}
        </div>
      </div>
      <div className="transport">
        <button onClick={() => seek(-5)} disabled={!hasPlayableMedia}><SkipBack size={16}/></button>
        <button className="play" onClick={toggle} disabled={!hasPlayableMedia}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button>
        <button onClick={() => seek(5)} disabled={!hasPlayableMedia}><SkipForward size={16}/></button>
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
