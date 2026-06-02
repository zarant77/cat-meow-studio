import { interpolate, normalizeClipTime } from "./animationMath.js";
import type { AnimationClip, AnimationImpact, AnimationKey, AnimationProperty, AnimationTrack } from "./animationTypes.js";
import { defaultAnimationImpact } from "./animationTypes.js";

export function evaluateAnimation(clip: AnimationClip, timeMs: number): AnimationImpact {
  const impact: AnimationImpact = { ...defaultAnimationImpact };
  const normalizedTimeMs = normalizeClipTime(timeMs, clip.durationMs, clip.loop);

  for (const track of clip.tracks) {
    const value = evaluateTrack(track, normalizedTimeMs);

    if (value === null) {
      continue;
    }

    applyTrackValue(impact, track.property, value);
  }

  return impact;
}

function evaluateTrack(track: AnimationTrack, timeMs: number): number | null {
  const keys = [...track.keys].sort((left, right) => left.timeMs - right.timeMs);

  if (keys.length === 0) {
    return null;
  }

  const firstKey = keys[0];
  const lastKey = keys[keys.length - 1];

  if (timeMs <= firstKey.timeMs) {
    return firstKey.value;
  }

  if (timeMs >= lastKey.timeMs) {
    return lastKey.value;
  }

  for (let index = 1; index < keys.length; index += 1) {
    const targetKey = keys[index];

    if (timeMs <= targetKey.timeMs) {
      const sourceKey = keys[index - 1];

      return interpolateKey(sourceKey, targetKey, timeMs);
    }
  }

  return lastKey.value;
}

function interpolateKey(sourceKey: AnimationKey, targetKey: AnimationKey, timeMs: number): number {
  const span = targetKey.timeMs - sourceKey.timeMs;

  if (span <= 0) {
    return targetKey.value;
  }

  return interpolate(sourceKey.value, targetKey.value, (timeMs - sourceKey.timeMs) / span, targetKey.easing);
}

function applyTrackValue(impact: AnimationImpact, property: AnimationProperty, value: number): void {
  if (property === "offset_x") {
    impact.offsetX = value;
    return;
  }

  if (property === "offset_y") {
    impact.offsetY = value;
    return;
  }

  if (property === "scale_x") {
    impact.scaleX = value;
    return;
  }

  if (property === "scale_y") {
    impact.scaleY = value;
    return;
  }

  if (property === "rotation") {
    impact.rotation = value;
    return;
  }

  impact.alpha = value;
}
