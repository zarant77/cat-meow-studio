import { soundWaves, type SoundWave } from "../model/soundProject.js";

const soundIdPattern = /[^a-z0-9_-]/g;

export function sanitizeSoundId(value: string): string {
  return value.toLowerCase().replace(soundIdPattern, "");
}

export function isSoundWave(value: string): value is SoundWave {
  return soundWaves.some((wave) => wave === value);
}

export function parseMinimumInteger(value: string, minimum: number, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.round(parsed));
}

export function parseClampedInteger(value: string, minimum: number, maximum: number, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

export function formatWaveLabel(wave: SoundWave): string {
  return `${wave.slice(0, 1).toUpperCase()}${wave.slice(1)}`;
}
