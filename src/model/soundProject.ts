export const soundWaves = ["square", "sine", "triangle", "noise"] as const;

export type SoundWave = (typeof soundWaves)[number];

export interface SoundCommand {
  id: string;
  wave: SoundWave;
  frequencyStart: number;
  frequencyEnd: number;
  durationMs: number;
  volume: number;
}

export interface SoundProject {
  id: string;
  commands: SoundCommand[];
}
