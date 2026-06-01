import type { MusicInstrument, MusicNote, MusicProject, MusicWave } from "../model/musicProject.js";
import { isValidSoundId, toMusicSymbolName } from "../utils/symbolName.js";

interface MusicCOptions {
  numericId?: number;
}

export function exportMusicC(project: MusicProject, options: MusicCOptions = {}): string | null {
  if (!isValidSoundId(project.id)) {
    return null;
  }

  const symbolName = toMusicSymbolName(project.id);
  const musicId = getMusicIdConstant(project.id);

  return [
    '#include "../audio/music_definition.h"',
    "",
    "typedef enum {",
    `    ${musicId} = ${clampInteger(options.numericId ?? 1, 1, 65535)}`,
    "} MusicId;",
    "",
    "static const MusicInstrument INSTRUMENTS[] = {",
    ...project.instruments.map(formatInstrument),
    "};",
    "",
    "static const MusicNote NOTES[] = {",
    ...project.notes.map(formatNote),
    "};",
    "",
    `const MusicDefinition ${symbolName} = {`,
    `    .id = ${musicId},`,
    "",
    `    .bpm = ${clampInteger(project.bpm, 20, 300)},`,
    `    .ticks_per_beat = ${clampInteger(project.ticksPerBeat, 1, 32)},`,
    `    .length_ticks = ${clampInteger(project.lengthTicks, 1, 4096)},`,
    "",
    "    .instruments = INSTRUMENTS,",
    "    .instrument_count = sizeof(INSTRUMENTS) / sizeof(INSTRUMENTS[0]),",
    "",
    "    .notes = NOTES,",
    "    .note_count = sizeof(NOTES) / sizeof(NOTES[0]),",
    "};",
    "",
  ].join("\n");
}

function formatInstrument(instrument: MusicInstrument): string {
  return `    { ${getWaveConstant(instrument.wave)}, ${volumeToByte(instrument.volume)}, ${clampInteger(
    instrument.attackMs,
    0,
    65535,
  )}, ${clampInteger(instrument.decayMs, 0, 65535)}, 255, 0 },`;
}

function formatNote(note: MusicNote): string {
  return `    { ${clampInteger(note.instrument, 0, 255)}, ${clampInteger(note.note, 0, 127)}, ${clampInteger(
    note.startTick,
    0,
    65535,
  )}, ${clampInteger(note.durationTicks, 1, 65535)}, ${volumeToByte(note.volume)} },`;
}

function getWaveConstant(wave: MusicWave): string {
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

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function getMusicIdConstant(musicId: string): string {
  return `MUSIC_ID_${toEnumToken(musicId)}`;
}

function volumeToByte(value: number): number {
  return clampInteger((clampInteger(value, 0, 100) / 100) * 255, 0, 255);
}

function toEnumToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
