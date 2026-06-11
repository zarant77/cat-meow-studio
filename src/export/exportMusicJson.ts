import type { MusicProject } from "../model/musicProject.js";
import { normalizeMusicLoop, normalizeMusicLoudness } from "../model/musicProject.js";
import { isValidSoundId } from "../utils/symbolName.js";

interface ExportedMusicNote {
  instrument: number;
  note: number;
  startTick: number;
  durationTicks: number;
  volume: number;
}

interface ExportedMusicProject {
  type: "music";
  id: string;
  bpm: number;
  ticksPerBeat: number;
  lengthTicks: number;
  volume: number;
  normalizeVolume: boolean;
  targetAverageVolume: number;
  maxVolumeGain: number;
  loop: MusicProject["loop"];
  instruments: MusicProject["instruments"];
  notes: ExportedMusicNote[];
}

export function exportMusicJson(project: MusicProject): string | null {
  if (!isValidSoundId(project.id)) {
    return null;
  }

  const exportedProject: ExportedMusicProject = {
    type: "music",
    id: project.id,
    bpm: project.bpm,
    ticksPerBeat: project.ticksPerBeat,
    lengthTicks: project.lengthTicks,
    ...normalizeMusicLoudness(project),
    loop: normalizeMusicLoop(project.loop, project.lengthTicks),
    instruments: project.instruments,
    notes: project.notes.map((note) => ({
      instrument: note.instrument,
      note: note.note,
      startTick: note.startTick,
      durationTicks: note.durationTicks,
      volume: note.volume,
    })),
  };

  return `${JSON.stringify(exportedProject, null, 2)}\n`;
}
