import {
  maxMusicNoteVolume,
  minMusicNoteVolume,
  normalizeMusicLoudness,
  type MusicNote,
  type MusicProject,
} from "./musicProject.js";

export interface MusicVolumeStats {
  averageBefore: number;
  normalizationGain: number;
  averageAfter: number;
}

export function getTrackVolumeStats(project: MusicProject): MusicVolumeStats {
  const loudness = normalizeMusicLoudness(project);
  const volumes = project.notes.map((note) => note.volume).filter((volume) => volume > 0);

  if (volumes.length === 0) {
    return {
      averageBefore: 0,
      normalizationGain: 1,
      averageAfter: 0,
    };
  }

  const averageBefore = volumes.reduce((sum, value) => sum + value, 0) / volumes.length;
  const normalizationGain = loudness.normalizeVolume
    ? clampNumber(loudness.targetAverageVolume / Math.max(1, averageBefore), 1, loudness.maxVolumeGain)
    : 1;

  return {
    averageBefore,
    normalizationGain,
    averageAfter: averageBefore * normalizationGain * loudness.volume,
  };
}

export function getEffectiveNoteVolume(note: MusicNote, project: MusicProject, stats: MusicVolumeStats = getTrackVolumeStats(project)): number {
  const loudness = normalizeMusicLoudness(project);
  const raw = note.volume * stats.normalizationGain * loudness.volume;

  return clampInteger(raw, minMusicNoteVolume, maxMusicNoteVolume);
}

export function cloneMusicProjectWithEffectiveNoteVolumes(project: MusicProject): MusicProject {
  const stats = getTrackVolumeStats(project);

  return {
    ...project,
    notes: project.notes.map((note) => ({
      ...note,
      volume: getEffectiveNoteVolume(note, project, stats),
    })),
  };
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
