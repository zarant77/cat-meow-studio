import type { MusicInstrument, MusicNote, MusicProject, MusicWave } from "../model/musicProject.js";
import { normalizeMusicLoop } from "../model/musicProject.js";
import { isValidSoundId, toMusicSymbolName } from "../utils/symbolName.js";

export interface MusicCOptions {
  numericId?: number;
}

export interface MusicDefinitionCBlock {
  idConstant: string;
  definitionSymbol: string;
  sourceLines: string[];
}

export function exportMusicC(project: MusicProject, options: MusicCOptions = {}): string | null {
  if (!isValidSoundId(project.id)) {
    return null;
  }

  const block = createMusicDefinitionCBlock(project, options);

  if (block === null) {
    return null;
  }

  return [
    '#include "../audio/music_definition.h"',
    "",
    "typedef enum {",
    `    ${block.idConstant} = ${clampInteger(options.numericId ?? 1, 1, 65535)}`,
    "} MusicId;",
    "",
    ...block.sourceLines,
  ].join("\n");
}

export function createMusicDefinitionCBlock(
  project: MusicProject,
  options: MusicCOptions & { instrumentSymbol?: string; noteSymbol?: string } = {},
): MusicDefinitionCBlock | null {
  if (!isValidSoundId(project.id)) {
    return null;
  }

  const instrumentSymbol = options.instrumentSymbol ?? "INSTRUMENTS";
  const noteSymbol = options.noteSymbol ?? "NOTES";
  const definitionSymbol = toMusicSymbolName(project.id);
  const idConstant = getMusicIdConstant(project.id);
  const loop = normalizeMusicLoop(project.loop, project.lengthTicks);

  return {
    idConstant,
    definitionSymbol,
    sourceLines: [
      `static const MusicInstrument ${instrumentSymbol}[] = {`,
      ...project.instruments.map(formatInstrument),
      "};",
      "",
      `static const MusicNote ${noteSymbol}[] = {`,
      ...project.notes.map(formatNote),
      "};",
      "",
      `const MusicDefinition ${definitionSymbol} = {`,
      `    .id = ${idConstant},`,
      "",
      `    .bpm = ${clampInteger(project.bpm, 20, 300)},`,
      `    .ticks_per_beat = ${clampInteger(project.ticksPerBeat, 1, 32)},`,
      `    .length_ticks = ${clampInteger(project.lengthTicks, 1, 4096)},`,
      `    .loop = {`,
      `        .enabled = ${loop.enabled ? 1 : 0},`,
      `        .start_tick = ${clampInteger(loop.startTick, 0, 4095)},`,
      `        .end_tick = ${clampInteger(loop.endTick, 1, 4096)}`,
      `    },`,
      "",
      `    .instruments = ${instrumentSymbol},`,
      `    .instrument_count = sizeof(${instrumentSymbol}) / sizeof(${instrumentSymbol}[0]),`,
      "",
      `    .notes = ${noteSymbol},`,
      `    .note_count = sizeof(${noteSymbol}) / sizeof(${noteSymbol}[0]),`,
      "};",
      "",
    ],
  };
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

export function getMusicIdConstant(musicId: string): string {
  return `MUSIC_ID_${toEnumToken(musicId)}`;
}

function volumeToByte(value: number): number {
  return clampInteger((clampInteger(value, 0, 100) / 100) * 255, 0, 255);
}

function toEnumToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
