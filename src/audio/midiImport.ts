import { Midi, type Track } from "@tonejs/midi";
import { createDefaultMusicLoop, type MusicInstrument, type MusicNote, type MusicProject } from "../model/musicProject.js";

export interface MidiImportOptions {
  musicId: string;
  lengthTicks: number | "auto";
  quantizeGrid: number;
  transpose: number;
  velocityScale?: number;
  maxVolume?: number;
  ignoreDrumChannel?: boolean;
  maxPolyphony?: number;
  maxPolyphonyPerInstrument?: number;
  minNote?: number;
  maxNote?: number;
}

const outputTicksPerBeat = 96;
const defaultVelocityScale = 72;
const defaultMaxVolume = 76;
const defaultMaxPolyphony = 24;
const defaultMaxPolyphonyPerInstrument = 8;
const defaultMinNote = 24;
const defaultMaxNote = 96;
const defaultBpm = 120;
const minBpm = 40;
const maxBpm = 240;
const drumChannel = 9;

const defaultInstruments: MusicInstrument[] = [
  {
    id: "lead",
    wave: "triangle",
    volume: 34,
    attackMs: 8,
    decayMs: 140,
  },
  {
    id: "bass",
    wave: "triangle",
    volume: 42,
    attackMs: 10,
    decayMs: 180,
  },
  {
    id: "harmony",
    wave: "sine",
    volume: 28,
    attackMs: 16,
    decayMs: 240,
  },
  {
    id: "soft_lead",
    wave: "sine",
    volume: 32,
    attackMs: 10,
    decayMs: 160,
  },
  {
    id: "spark",
    wave: "triangle",
    volume: 22,
    attackMs: 6,
    decayMs: 100,
  },
];

export function sanitizeMusicId(value: string): string {
  const name = value
    .toLowerCase()
    .replace(/\.music\.json$/i, "")
    .replace(/\.(midi?)$/i, "");

  const sanitized = name
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized.length === 0 ? "music" : sanitized;
}

export function convertMidiToMusicProject(buffer: ArrayBuffer, fileName: string, options: MidiImportOptions): MusicProject {
  const midi = new Midi(buffer);
  const importSettings = normalizeImportOptions(options);
  const bpm = getImportedBpm(midi);
  const usableTracks = getUsableTracks(midi.tracks, importSettings);
  const instruments = createInstruments(usableTracks.length);
  const detectedLengthTicks = secondsToProjectTicks(midi.duration, bpm);
  const lengthTicks = options.lengthTicks === "auto" ? detectedLengthTicks : Math.max(1, Math.round(options.lengthTicks));

  let notes = usableTracks.flatMap((track, trackIndex) => convertTrackNotes(track, trackIndex, bpm, lengthTicks, importSettings));

  notes = limitPolyphony(notes, importSettings.maxPolyphony, importSettings.maxPolyphonyPerInstrument);
  notes.sort(compareMusicNotes);
  notes.forEach((note, index) => {
    note.id = `note-${index + 1}`;
  });

  return {
    type: "music",
    id: sanitizeMusicId(options.musicId || getBaseFileName(fileName)),
    bpm,
    ticksPerBeat: outputTicksPerBeat,
    lengthTicks,
    loop: createDefaultMusicLoop(lengthTicks),
    instruments,
    notes,
  };
}

interface NormalizedMidiImportOptions {
  quantizeGrid: number;
  transpose: number;
  velocityScale: number;
  maxVolume: number;
  ignoreDrumChannel: boolean;
  maxPolyphony: number;
  maxPolyphonyPerInstrument: number;
  minNote: number;
  maxNote: number;
}

function normalizeImportOptions(options: MidiImportOptions): NormalizedMidiImportOptions {
  const minNote = Math.round(clamp(options.minNote ?? defaultMinNote, 0, 127));
  const maxNote = Math.round(clamp(options.maxNote ?? defaultMaxNote, 0, 127));

  return {
    quantizeGrid: Math.max(0, Math.round(options.quantizeGrid)),
    transpose: Math.round(options.transpose),
    velocityScale: clamp(options.velocityScale ?? defaultVelocityScale, 1, 100),
    maxVolume: clamp(options.maxVolume ?? defaultMaxVolume, 1, 100),
    ignoreDrumChannel: options.ignoreDrumChannel ?? true,
    maxPolyphony: Math.max(1, Math.round(options.maxPolyphony ?? defaultMaxPolyphony)),
    maxPolyphonyPerInstrument: Math.max(1, Math.round(options.maxPolyphonyPerInstrument ?? defaultMaxPolyphonyPerInstrument)),
    minNote: Math.min(minNote, maxNote),
    maxNote: Math.max(minNote, maxNote),
  };
}

function getImportedBpm(midi: Midi): number {
  const sourceBpm = midi.header.tempos[0]?.bpm ?? defaultBpm;

  return Math.round(clamp(sourceBpm, minBpm, maxBpm));
}

function secondsToProjectTicks(seconds: number, bpm: number): number {
  return Math.max(1, Math.round(Math.max(0, seconds) * outputTicksPerBeat * bpm / 60));
}

function createInstruments(trackCount: number): MusicInstrument[] {
  const count = Math.max(1, trackCount);

  return Array.from({ length: count }, (_, index) => {
    const preset = defaultInstruments[index % defaultInstruments.length];
    const suffix = index < defaultInstruments.length ? "" : `_${index + 1}`;

    return {
      ...preset,
      id: `${preset.id}${suffix}`,
    };
  });
}

function getUsableTracks(tracks: Track[], options: NormalizedMidiImportOptions): Track[] {
  return tracks
    .filter((track) => track.notes.length > 0)
    .filter((track) => !options.ignoreDrumChannel || getTrackChannel(track) !== drumChannel);
}

function getTrackChannel(track: Track): number | undefined {
  const candidate = track as Track & { channel?: unknown };
  return typeof candidate.channel === "number" ? candidate.channel : undefined;
}

function convertTrackNotes(
  track: Track,
  instrument: number,
  bpm: number,
  lengthTicks: number,
  options: NormalizedMidiImportOptions,
): MusicNote[] {
  const notes: MusicNote[] = [];

  for (const midiNote of track.notes) {
    let startTick = secondsToProjectTicks(midiNote.time, bpm);
    let endTick = secondsToProjectTicks(midiNote.time + midiNote.duration, bpm);

    if (options.quantizeGrid > 1) {
      startTick = quantizeTick(startTick, options.quantizeGrid);
      endTick = quantizeTick(endTick, options.quantizeGrid);
    }

    if (startTick >= lengthTicks) {
      continue;
    }

    const durationTicks = Math.max(1, Math.min(endTick - startTick, lengthTicks - startTick));

    if (durationTicks <= 0) {
      continue;
    }

    const rawNoteValue = Math.round(clamp(midiNote.midi + options.transpose, 0, 127));
    const noteValue = fitNoteToRange(rawNoteValue, options.minNote, options.maxNote);

    notes.push({
      id: `note-${notes.length + 1}`,
      instrument,
      note: noteValue,
      startTick,
      durationTicks,
      volume: velocityToVolume(midiNote.velocity, options.velocityScale, options.maxVolume),
    });
  }

  return notes;
}

function fitNoteToRange(note: number, minNote: number, maxNote: number): number {
  let result = note;

  while (result < minNote && result + 12 <= 127) {
    result += 12;
  }

  while (result > maxNote && result - 12 >= 0) {
    result -= 12;
  }

  return Math.round(clamp(result, minNote, maxNote));
}

function velocityToVolume(velocity: number, velocityScale: number, maxVolume: number): number {
  return Math.round(clamp(Math.sqrt(clamp(velocity, 0, 1)) * velocityScale, 1, maxVolume));
}

function limitPolyphony(notes: MusicNote[], maxPolyphony: number, maxPolyphonyPerInstrument: number): MusicNote[] {
  const byStartTick = new Map<number, MusicNote[]>();

  for (const note of notes) {
    const group = byStartTick.get(note.startTick) ?? [];
    group.push(note);
    byStartTick.set(note.startTick, group);
  }

  const limited: MusicNote[] = [];

  for (const group of byStartTick.values()) {
    const byInstrument = new Map<number, MusicNote[]>();

    for (const note of group) {
      const instrumentGroup = byInstrument.get(note.instrument) ?? [];
      instrumentGroup.push(note);
      byInstrument.set(note.instrument, instrumentGroup);
    }

    const perInstrumentLimited: MusicNote[] = [];

    for (const instrumentGroup of byInstrument.values()) {
      perInstrumentLimited.push(...takeMostImportantNotes(instrumentGroup, maxPolyphonyPerInstrument));
    }

    limited.push(...takeMostImportantNotes(perInstrumentLimited, maxPolyphony));
  }

  return limited;
}

function takeMostImportantNotes(notes: MusicNote[], limit: number): MusicNote[] {
  return [...notes]
    .sort((left, right) => right.volume - left.volume || right.durationTicks - left.durationTicks || left.note - right.note)
    .slice(0, limit);
}

function compareMusicNotes(left: MusicNote, right: MusicNote): number {
  return left.startTick - right.startTick || left.instrument - right.instrument || left.note - right.note;
}

function quantizeTick(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function getBaseFileName(fileName: string): string {
  const name = fileName.split(/[\\/]/).at(-1) ?? fileName;

  return name.replace(/\.(midi?)$/i, "");
}
