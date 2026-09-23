export type TrackType = 'video' | 'audio' | 'text' | 'overlay';

export interface MediaAsset {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  path: string;
  duration?: number;
  thumbnail?: string;
  size?: number;
}

export interface Clip {
  id: string;
  assetId?: string;
  name: string;
  type: TrackType;
  start: number;
  duration: number;
  sourceIn?: number;
  sourceOut?: number;
  volume?: number;
  speed?: number;
  text?: string;
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  muted?: boolean;
  locked?: boolean;
  clips: Clip[];
}

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
}

export interface KiroProject {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  assets: MediaAsset[];
  tracks: Track[];
}
