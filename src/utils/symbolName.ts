import { sanitizeSoundId } from "./validation.js";

export function isValidSoundId(value: string): boolean {
  return value.length > 0 && sanitizeSoundId(value) === value;
}

export function toSoundSymbolName(soundId: string): string {
  const symbolBase = soundId.toUpperCase().replaceAll("-", "_");

  if (/^[0-9]/.test(symbolBase)) {
    return `SOUND_${symbolBase}_SOUND`;
  }

  return `${symbolBase}_SOUND`;
}

export function toMusicSymbolName(musicId: string): string {
  const symbolBase = musicId.toUpperCase().replaceAll("-", "_");

  if (/^[0-9]/.test(symbolBase)) {
    return `MUSIC_${symbolBase}_MUSIC`;
  }

  return `${symbolBase}_MUSIC`;
}
