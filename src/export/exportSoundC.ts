import type { SoundCommand, SoundProject, SoundWave } from "../model/soundProject.js";
import { isValidSoundId, toSoundSymbolName } from "../utils/symbolName.js";

const includeLine = '#include "../audio/sound_definition.h"';

export function exportSoundC(project: SoundProject): string | null {
  if (!isValidSoundId(project.id)) {
    return null;
  }

  const commandLines = project.commands.map(formatCommandLine);
  const symbolName = toSoundSymbolName(project.id);

  return [
    includeLine,
    "",
    "static const SoundCommand COMMANDS[] = {",
    ...commandLines,
    "};",
    "",
    `const SoundDefinition ${symbolName} = {`,
    `    .id = "${project.id}",`,
    "",
    "    .commands = COMMANDS,",
    "    .command_count = sizeof(COMMANDS) / sizeof(COMMANDS[0]),",
    "};",
    "",
  ].join("\n");
}

function formatCommandLine(command: SoundCommand): string {
  return `    { ${getWaveConstant(command.wave)}, ${clampMinimum(command.frequencyStart, 1)}, ${clampMinimum(
    command.frequencyEnd,
    1,
  )}, ${clampMinimum(command.durationMs, 1)}, ${clampRange(command.volume, 0, 100)} },`;
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
