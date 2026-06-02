import type { AnimationEasing } from "./animationTypes.js";

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export function normalizeClipTime(timeMs: number, durationMs: number, loop: boolean): number {
  const normalizedDuration = Math.max(0, Math.round(durationMs));

  if (normalizedDuration === 0) {
    return 0;
  }

  if (!loop) {
    return clamp(timeMs, 0, normalizedDuration);
  }

  const wrapped = timeMs % normalizedDuration;

  return wrapped < 0 ? wrapped + normalizedDuration : wrapped;
}

export function applyEasing(progress: number, easing: AnimationEasing): number {
  const t = clamp(progress, 0, 1);

  if (easing === "step") {
    return t < 1 ? 0 : 1;
  }

  if (easing === "ease_in") {
    return t * t;
  }

  if (easing === "ease_out") {
    return 1 - (1 - t) * (1 - t);
  }

  if (easing === "ease_in_out") {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  return t;
}

export function interpolate(start: number, end: number, progress: number, easing: AnimationEasing): number {
  const eased = applyEasing(progress, easing);

  return Math.round(start + (end - start) * eased);
}
