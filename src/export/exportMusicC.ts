import type { MusicInstrument, MusicNote, MusicProject, MusicWave } from "../model/musicProject.js";
import { isValidSoundId, toMusicSymbolName } from "../utils/symbolName.js";

export function exportMusicC(project: MusicProject): string | null {
  if (!isValidSoundId(project.id)) {
    return null;
  }

  const symbolName = toMusicSymbolName(project.id);

  return [
    '#include "../audio/music_definition.h"',
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
    `    .id = "${project.id}",`,
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
  return `    { ${getWaveConstant(instrument.wave)}, ${clampInteger(instrument.volume, 0, 100)}, ${clampInteger(
    instrument.attackMs,
    0,
    65535,
  )}, ${clampInteger(instrument.decayMs, 0, 65535)} },`;
}

function formatNote(note: MusicNote): string {
  return `    { ${clampInteger(note.instrument, 0, 255)}, ${clampInteger(note.note, 0, 127)}, ${clampInteger(
    note.startTick,
    0,
    65535,
  )}, ${clampInteger(note.durationTicks, 1, 65535)}, ${clampInteger(note.volume, 0, 100)} },`;
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
