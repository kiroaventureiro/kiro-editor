export type TrackType = "video" | "audio" | "text" | "overlay";
export type TransitionType =
  | "dissolve"
  | "fade"
  | "zoom"
  | "slide-left"
  | "slide-right";

export interface MediaAsset {
  id: string;
  name: string;
  type: "video" | "audio" | "image";
  path: string;
  duration?: number;
  thumbnail?: string;
  size?: number;
  peaks?: number[];
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
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  endScale?: number;
  endX?: number;
  endY?: number;
  fadeIn?: number;
  fadeOut?: number;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  caption?: boolean;
  captionStyle?: "clean" | "yellow-bar" | "impact";
  backgroundColor?: string;
  backgroundOpacity?: number;
  backgroundPadding?: number;
  transitionIn?: TransitionType;
  transitionDuration?: number;
  notes?: string;
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  muted?: boolean;
  locked?: boolean;
  clips: Clip[];
}

export interface ProjectMarker {
  id: string;
  time: number;
  label: string;
  kind: "beat" | "manual";
  sourceAssetId?: string;
}

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
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
  markers?: ProjectMarker[];
}
