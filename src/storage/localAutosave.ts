import { exportMusicJson } from "../export/exportMusicJson.js";
import { exportSoundJson } from "../export/exportSoundJson.js";
import { importMusicJson } from "../import/importMusicJson.js";
import { importSoundJson } from "../import/importSoundJson.js";
import type { MusicProject } from "../model/musicProject.js";
import type { SoundProject } from "../model/soundProject.js";

export type AutosavedMode = "music" | "sfx" | "sprites";

const soundAutosaveKey = "cat-meow:sound-project";
const legacySoundAutosaveKey = "cat-meow:sfx-project";
const musicAutosaveKey = "cat-meow:music-project";
const activeModeAutosaveKey = "cat-meow:active-mode";

export function saveAutosavedProject(project: SoundProject): boolean {
  const source = exportSoundJson(project);

  if (source === null) {
    return false;
  }

  try {
    localStorage.setItem(soundAutosaveKey, source);
    return true;
  } catch {
    return false;
  }
}

export function loadAutosavedProject(): SoundProject | null {
  const source = getAutosavedSource(soundAutosaveKey) ?? getAutosavedSource(legacySoundAutosaveKey);

  if (source === null) {
    return null;
  }

  const result = importSoundJson(source);

  if (!result.ok) {
    clearAutosavedSoundProject();
    return null;
  }

  return result.project;
}

export function saveAutosavedMusicProject(project: MusicProject): boolean {
  const source = exportMusicJson(project);

  if (source === null) {
    return false;
  }

  try {
    localStorage.setItem(musicAutosaveKey, source);
    return true;
  } catch {
    return false;
  }
}

export function loadAutosavedMusicProject(): MusicProject | null {
  const source = getAutosavedSource(musicAutosaveKey);

  if (source === null) {
    return null;
  }

  const result = importMusicJson(source);

  if (!result.ok) {
    clearAutosavedMusicProject();
    return null;
  }

  return result.project;
}

export function saveAutosavedActiveMode(mode: AutosavedMode): void {
  try {
    localStorage.setItem(activeModeAutosaveKey, mode);
  } catch {
    return;
  }
}

export function loadAutosavedActiveMode(): AutosavedMode | null {
  const mode = getAutosavedSource(activeModeAutosaveKey);

  if (mode === "music" || mode === "sfx" || mode === "sprites") {
    return mode;
  }

  return null;
}

export function clearAutosavedProject(): void {
  clearAutosavedSoundProject();
  clearAutosavedMusicProject();
  clearAutosavedActiveMode();
}

function clearAutosavedSoundProject(): void {
  try {
    localStorage.removeItem(soundAutosaveKey);
    localStorage.removeItem(legacySoundAutosaveKey);
  } catch {
    return;
  }
}

function clearAutosavedMusicProject(): void {
  try {
    localStorage.removeItem(musicAutosaveKey);
  } catch {
    return;
  }
}

function clearAutosavedActiveMode(): void {
  try {
    localStorage.removeItem(activeModeAutosaveKey);
  } catch {
    return;
  }
}

function getAutosavedSource(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
