export const musicWaves = ["square", "sine", "triangle", "noise"] as const;

export type MusicWave = (typeof musicWaves)[number];

export function isMusicWave(value: string): value is MusicWave {
  return musicWaves.some((wave) => wave === value);
}

export interface MusicInstrument {
  id: string;
  wave: MusicWave;
  volume: number;
  attackMs: number;
  decayMs: number;
}

export interface MusicNote {
  id: string;
  instrument: number;
  note: number;
  startTick: number;
  durationTicks: number;
  volume: number;
}

export interface MusicLoop {
  enabled: boolean;
  startTick: number;
  endTick: number;
}

export interface MusicProject {
  type: "music";
  id: string;
  bpm: number;
  ticksPerBeat: number;
  lengthTicks: number;
  volume: number;
  normalizeVolume: boolean;
  targetAverageVolume: number;
  maxVolumeGain: number;
  loop: MusicLoop;
  instruments: MusicInstrument[];
  notes: MusicNote[];
}

export const defaultMusicVolume = 1;
export const defaultNormalizeMusicVolume = false;
export const defaultMusicTargetAverageVolume = 80;
export const defaultMusicMaxVolumeGain = 3;
export const minMusicNoteVolume = 0;
export const maxMusicNoteVolume = 100;

export function createDefaultMusicLoop(lengthTicks: number): MusicLoop {
  return {
    enabled: false,
    startTick: 0,
    endTick: Math.max(1, Math.round(lengthTicks)),
  };
}

export function normalizeMusicLoudness(project: Partial<MusicProject>): Pick<
  MusicProject,
  "volume" | "normalizeVolume" | "targetAverageVolume" | "maxVolumeGain"
> {
  return {
    volume: clampNumber(project.volume ?? defaultMusicVolume, 0, 4),
    normalizeVolume: project.normalizeVolume ?? defaultNormalizeMusicVolume,
    targetAverageVolume: clampInteger(project.targetAverageVolume ?? defaultMusicTargetAverageVolume, minMusicNoteVolume, maxMusicNoteVolume),
    maxVolumeGain: clampNumber(project.maxVolumeGain ?? defaultMusicMaxVolumeGain, 1, 8),
  };
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeMusicLoop(loop: Partial<MusicLoop> | undefined, lengthTicks: number): MusicLoop {
  const length = Math.max(1, Math.round(lengthTicks));
  let startTick = clampInteger(loop?.startTick ?? 0, 0, Math.max(0, length - 1));
  let endTick = clampInteger(loop?.endTick ?? length, 1, length);

  if (endTick <= startTick) {
    endTick = Math.min(length, startTick + 1);
  }

  if (endTick <= startTick) {
    startTick = Math.max(0, endTick - 1);
  }

  return {
    enabled: loop?.enabled ?? false,
    startTick,
    endTick,
  };
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
