export type AnimationProperty =
  | "offset_x"
  | "offset_y"
  | "scale_x"
  | "scale_y"
  | "rotation"
  | "alpha";

export type AnimationEasing =
  | "linear"
  | "ease_in"
  | "ease_out"
  | "ease_in_out"
  | "step";

export interface AnimationKey {
  timeMs: number;
  value: number;
  easing: AnimationEasing;
}

export interface AnimationTrack {
  property: AnimationProperty;
  keys: AnimationKey[];
}

export interface AnimationFile {
  version: 1;
  id: string;
  durationMs: number;
  loop: boolean;
  tracks: AnimationTrack[];
}

export type AnimationClip = AnimationFile;

export type AnimationImpact = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
};

export const animationProperties: readonly AnimationProperty[] = [
  "offset_x",
  "offset_y",
  "scale_x",
  "scale_y",
  "rotation",
  "alpha",
] as const;

export const animationEasings: readonly AnimationEasing[] = [
  "linear",
  "ease_in",
  "ease_out",
  "ease_in_out",
  "step",
] as const;

export const defaultAnimationImpact: AnimationImpact = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1000,
  scaleY: 1000,
  rotation: 0,
  alpha: 255,
};
