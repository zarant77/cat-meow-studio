import { isMusicWave, type MusicInstrument, type MusicNote, type MusicProject } from "../model/musicProject.js";
import { isValidSoundId } from "../utils/symbolName.js";

export type ImportMusicJsonResult =
  | {
      ok: true;
      project: MusicProject;
    }
  | ImportMusicJsonFailure;

interface ImportMusicJsonFailure {
  ok: false;
  error: string;
}

export function importMusicJson(text: string): ImportMusicJsonResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return fail("The file is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    return fail("The music file must be a JSON object.");
  }

  if (parsed.type !== "music") {
    return fail('Wrong file type. Music mode expects a "music" JSON file.');
  }

  const id = typeof parsed.id === "string" ? parsed.id : null;

  if (id === null || !isValidSoundId(id)) {
    return fail("The music id is empty or contains unsupported characters.");
  }

  const bpm = parseMinimumInteger(parsed.bpm, 1);
  const ticksPerBeat = parseMinimumInteger(parsed.ticksPerBeat, 1);
  const lengthTicks = parseMinimumInteger(parsed.lengthTicks, 1);

  if (bpm === null) {
    return fail("Music bpm must be a number greater than or equal to 1.");
  }

  if (ticksPerBeat === null) {
    return fail("Music ticksPerBeat must be a number greater than or equal to 1.");
  }

  if (lengthTicks === null) {
    return fail("Music lengthTicks must be a number greater than or equal to 1.");
  }

  if (!Array.isArray(parsed.instruments)) {
    return fail("Music instruments must be an array.");
  }

  if (!Array.isArray(parsed.notes)) {
    return fail("Music notes must be an array.");
  }

  const instruments: MusicInstrument[] = [];

  for (let index = 0; index < parsed.instruments.length; index += 1) {
    const instrumentResult = parseInstrument(parsed.instruments[index], index);

    if (!instrumentResult.ok) {
      return instrumentResult;
    }

    instruments.push(instrumentResult.instrument);
  }

  const notes: MusicNote[] = [];

  for (let index = 0; index < parsed.notes.length; index += 1) {
    const noteResult = parseNote(parsed.notes[index], index, instruments.length);

    if (!noteResult.ok) {
      return noteResult;
    }

    notes.push(noteResult.note);
  }

  return {
    ok: true,
    project: {
      type: "music",
      id,
      bpm,
      ticksPerBeat,
      lengthTicks,
      instruments,
      notes,
    },
  };
}

type ParseInstrumentResult =
  | {
      ok: true;
      instrument: MusicInstrument;
    }
  | ImportMusicJsonFailure;

function parseInstrument(value: unknown, index: number): ParseInstrumentResult {
  if (!isRecord(value)) {
    return fail(`Instrument ${index + 1} must be an object.`);
  }

  const id = typeof value.id === "string" ? value.id : null;

  if (id === null || !isValidSoundId(id)) {
    return fail(`Instrument ${index + 1} id is empty or contains unsupported characters.`);
  }

  const wave = typeof value.wave === "string" && isMusicWave(value.wave) ? value.wave : null;

  if (wave === null) {
    return fail(`Instrument ${index + 1} has an unsupported wave.`);
  }

  const volume = parseBoundedInteger(value.volume, 0, 100);
  const attackMs = parseMinimumInteger(value.attackMs, 0);
  const decayMs = parseMinimumInteger(value.decayMs, 0);

  if (volume === null) {
    return fail(`Instrument ${index + 1} volume must be a number from 0 to 100.`);
  }

  if (attackMs === null) {
    return fail(`Instrument ${index + 1} attackMs must be a number greater than or equal to 0.`);
  }

  if (decayMs === null) {
    return fail(`Instrument ${index + 1} decayMs must be a number greater than or equal to 0.`);
  }

  return {
    ok: true,
    instrument: {
      id,
      wave,
      volume,
      attackMs,
      decayMs,
    },
  };
}

type ParseNoteResult =
  | {
      ok: true;
      note: MusicNote;
    }
  | ImportMusicJsonFailure;

function parseNote(value: unknown, index: number, instrumentCount: number): ParseNoteResult {
  if (!isRecord(value)) {
    return fail(`Note ${index + 1} must be an object.`);
  }

  const instrument = parseInteger(value.instrument);

  if (instrument === null || instrument < 0 || instrument >= instrumentCount) {
    return fail(`Note ${index + 1} instrument must reference an existing instrument.`);
  }

  const note = parseBoundedInteger(value.note, 0, 127);
  const startTick = parseMinimumInteger(value.startTick, 0);
  const durationTicks = parseMinimumInteger(value.durationTicks, 1);
  const volume = parseBoundedInteger(value.volume, 0, 100);

  if (note === null) {
    return fail(`Note ${index + 1} pitch must be a MIDI note number from 0 to 127.`);
  }

  if (startTick === null) {
    return fail(`Note ${index + 1} startTick must be a number greater than or equal to 0.`);
  }

  if (durationTicks === null) {
    return fail(`Note ${index + 1} durationTicks must be a number greater than or equal to 1.`);
  }

  if (volume === null) {
    return fail(`Note ${index + 1} volume must be a number from 0 to 100.`);
  }

  return {
    ok: true,
    note: {
      id: `note-${index + 1}`,
      instrument,
      note,
      startTick,
      durationTicks,
      volume,
    },
  };
}

function parseInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value);
}

function parseMinimumInteger(value: unknown, minimum: number): number | null {
  const parsed = parseInteger(value);

  if (parsed === null || parsed < minimum) {
    return null;
  }

  return parsed;
}

function parseBoundedInteger(value: unknown, minimum: number, maximum: number): number | null {
  const parsed = parseInteger(value);

  if (parsed === null || parsed < minimum || parsed > maximum) {
    return null;
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(error: string): ImportMusicJsonFailure {
  return {
    ok: false,
    error,
  };
}
