import type { SoundCommand, SoundProject, SoundWave } from "../model/soundProject.js";
import { isValidSoundId, toSoundSymbolName } from "../utils/symbolName.js";

const includeLine = '#include "../audio/sound_definition.h"';

interface SoundCOptions {
  numericId?: number;
}

export function exportSoundC(project: SoundProject, options: SoundCOptions = {}): string | null {
  if (!isValidSoundId(project.id)) {
    return null;
  }

  const commandLines = project.commands.map(formatCommandLine);
  const symbolName = toSoundSymbolName(project.id);
  const soundId = getSoundIdConstant(project.id);

  return [
    includeLine,
    "",
    "typedef enum {",
    `    ${soundId} = ${clampMinimum(options.numericId ?? 1, 1)}`,
    "} SoundId;",
    "",
    "static const SoundCommand COMMANDS[] = {",
    ...commandLines,
    "};",
    "",
    `const SoundDefinition ${symbolName} = {`,
    `    .id = ${soundId},`,
    "",
    "    .commands = COMMANDS,",
    "    .command_count = sizeof(COMMANDS) / sizeof(COMMANDS[0]),",
    "};",
    "",
  ].join("\n");
}

function formatCommandLine(command: SoundCommand): string {
  return `    { ${getWaveConstant(command.wave)}, ${frequencyToNote(command.frequencyStart)}, ${frequencyToNote(
    command.frequencyEnd,
  )}, ${clampMinimum(command.durationMs, 1)}, ${volumeToByte(command.volume)} },`;
}

function getWaveConstant(wave: SoundWave): string {
  switch (wave) {
    case "square":
      return "SOUND_WAVE_SQUARE";
    case "sine":
      return "SOUND_WAVE_SINE";
    case "triangle":
      return "SOUND_WAVE_TRIANGLE";
    case "noise":
      return "SOUND_WAVE_NOISE";
  }
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

function frequencyToNote(value: number): number {
  const frequency = clampMinimum(value, 1);
  const note = Math.round(69 + 12 * Math.log2(frequency / 440));

  return clampRange(note, 0, 127);
}

function volumeToByte(value: number): number {
  return clampRange((clampRange(value, 0, 100) / 100) * 255, 0, 255);
}

function getSoundIdConstant(soundId: string): string {
  return `SOUND_ID_${toEnumToken(soundId)}`;
}

function toEnumToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
