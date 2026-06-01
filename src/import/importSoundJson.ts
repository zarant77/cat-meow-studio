import type { SoundCommand, SoundProject } from "../model/soundProject.js";
import { isSoundWave } from "../utils/validation.js";
import { isValidSoundId } from "../utils/symbolName.js";

export type ImportSoundJsonResult =
  | {
      ok: true;
      project: SoundProject;
    }
  | ImportSoundJsonFailure;

interface ImportSoundJsonFailure {
  ok: false;
  error: string;
}

export function importSoundJson(text: string): ImportSoundJsonResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return {
      ok: false,
      error: "The file is not valid JSON.",
    };
  }

  if (!isRecord(parsed)) {
    return fail("The sound file must be a JSON object.");
  }

  if (parsed.type !== "sfx" && parsed.type !== "sound") {
    return fail('The sound file type must be "sfx".');
  }

  if (typeof parsed.id !== "string" || !isValidSoundId(parsed.id)) {
    return fail("The sound id is empty or contains unsupported characters.");
  }

  if (!Array.isArray(parsed.commands)) {
    return fail("The sound commands must be an array.");
  }

  const commands: SoundCommand[] = [];

  for (let index = 0; index < parsed.commands.length; index += 1) {
    const commandResult = parseCommand(parsed.commands[index], index);

    if (!commandResult.ok) {
      return commandResult;
    }

    commands.push(commandResult.command);
  }

  return {
    ok: true,
    project: {
      id: parsed.id,
      commands,
    },
  };
}

type ParseCommandResult =
  | {
      ok: true;
      command: SoundCommand;
    }
  | ImportSoundJsonFailure;

function parseCommand(value: unknown, index: number): ParseCommandResult {
  if (!isRecord(value)) {
    return fail(`Command ${index + 1} must be an object.`);
  }

  if (typeof value.wave !== "string" || !isSoundWave(value.wave)) {
    return fail(`Command ${index + 1} has an unsupported wave.`);
  }

  const frequencyStart = parseMinimumNumber(value.frequencyStart, 1);
  const frequencyEnd = parseMinimumNumber(value.frequencyEnd, 1);
  const durationMs = parseMinimumNumber(value.durationMs, 1);
  const volume = parseClampedNumber(value.volume, 0, 100);

  if (frequencyStart === null) {
    return fail(`Command ${index + 1} frequencyStart must be a number.`);
  }

  if (frequencyEnd === null) {
    return fail(`Command ${index + 1} frequencyEnd must be a number.`);
  }

  if (durationMs === null) {
    return fail(`Command ${index + 1} durationMs must be a number.`);
  }

  if (volume === null) {
    return fail(`Command ${index + 1} volume must be a number.`);
  }

  return {
    ok: true,
    command: {
      id: `command-${index + 1}`,
      wave: value.wave,
      frequencyStart,
      frequencyEnd,
      durationMs,
      volume,
    },
  };
}

function parseMinimumNumber(value: unknown, minimum: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(minimum, Math.round(value));
}

function parseClampedNumber(value: unknown, minimum: number, maximum: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(error: string): ImportSoundJsonFailure {
  return {
    ok: false,
    error,
  };
}
