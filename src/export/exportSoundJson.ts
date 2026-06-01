import type { SoundCommand, SoundProject } from "../model/soundProject.js";
import { isValidSoundId } from "../utils/symbolName.js";

interface ExportedSoundCommand {
  wave: SoundCommand["wave"];
  frequencyStart: number;
  frequencyEnd: number;
  durationMs: number;
  volume: number;
}

interface ExportedSoundJson {
  type: "sound";
  id: string;
  commands: ExportedSoundCommand[];
}

export function exportSoundJson(project: SoundProject): string | null {
  if (!isValidSoundId(project.id)) {
    return null;
  }

  const exportedProject: ExportedSoundJson = {
    type: "sound",
    id: project.id,
    commands: project.commands.map(exportCommand),
  };

  return `${JSON.stringify(exportedProject, null, 2)}\n`;
}

function exportCommand(command: SoundCommand): ExportedSoundCommand {
  return {
    wave: command.wave,
    frequencyStart: clampMinimum(command.frequencyStart, 1),
    frequencyEnd: clampMinimum(command.frequencyEnd, 1),
    durationMs: clampMinimum(command.durationMs, 1),
    volume: clampRange(command.volume, 0, 100),
  };
}

function clampMinimum(value: number, minimum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(minimum, Math.round(value));
}

function clampRange(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
