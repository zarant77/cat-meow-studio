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

export interface MusicProject {
  type: "music";
  id: string;
  bpm: number;
  ticksPerBeat: number;
  lengthTicks: number;
  instruments: MusicInstrument[];
  notes: MusicNote[];
}
