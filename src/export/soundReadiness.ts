import { generateSoundSamples } from "../audio/soundGenerator.js";
import type { SoundCommand, SoundProject } from "../model/soundProject.js";
import { isValidSoundId } from "../utils/symbolName.js";

const reasonableDurationMs = 3000;

export type ExportReadinessStatus = "ready" | "warning" | "error";

export interface ExportReadiness {
  status: ExportReadinessStatus;
  totalDurationMs: number;
  sampleCount: number;
  errors: string[];
  warnings: string[];
}

export function getSoundExportReadiness(project: SoundProject): ExportReadiness {
  const totalDurationMs = getTotalDurationMs(project.commands);
  const sampleCount = generateSoundSamples(project).length;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isValidSoundId(project.id)) {
    errors.push("Invalid id");
  }

  if (project.commands.length === 0) {
    errors.push("No commands");
  }

  if (totalDurationMs <= 0) {
    errors.push("Zero duration");
  }

  if (hasInvalidFrequency(project.commands)) {
    errors.push("Invalid frequency");
  }

  if (hasInvalidVolume(project.commands)) {
    errors.push("Invalid volume");
  }

  if (sampleCount <= 0) {
    errors.push("No generated samples");
  }

  if (totalDurationMs > reasonableDurationMs) {
    warnings.push("Long sound");
  }

  return {
    status: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ready",
    totalDurationMs,
    sampleCount,
    errors,
    warnings,
  };
}

function getTotalDurationMs(commands: SoundCommand[]): number {
  return commands.reduce((total, command) => {
    if (!Number.isFinite(command.durationMs)) {
      return total;
    }

    return total + Math.max(0, Math.round(command.durationMs));
  }, 0);
}

function hasInvalidFrequency(commands: SoundCommand[]): boolean {
  return commands.some(
    (command) =>
      !Number.isFinite(command.frequencyStart) ||
      !Number.isFinite(command.frequencyEnd) ||
      command.frequencyStart < 1 ||
      command.frequencyEnd < 1,
  );
}

function hasInvalidVolume(commands: SoundCommand[]): boolean {
  return commands.some((command) => !Number.isFinite(command.volume) || command.volume < 0 || command.volume > 100);
}
