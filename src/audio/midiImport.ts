import { Midi, type Track } from "@tonejs/midi";
import type { MusicInstrument, MusicNote, MusicProject } from "../model/musicProject.js";

export interface MidiImportOptions {
  musicId: string;
  lengthTicks: number | "auto";
  quantizeGrid: number;
  transpose: number;
}

const outputTicksPerBeat = 4;

const defaultInstruments: MusicInstrument[] = [
  {
    id: "lead",
    wave: "square",
    volume: 76,
    attackMs: 5,
    decayMs: 70,
  },
  {
    id: "bass",
    wave: "triangle",
    volume: 82,
    attackMs: 3,
    decayMs: 95,
  },
  {
    id: "pulse",
    wave: "square",
    volume: 34,
    attackMs: 2,
    decayMs: 28,
  },
  {
    id: "harmony",
    wave: "triangle",
    volume: 48,
    attackMs: 10,
    decayMs: 140,
  },
  {
    id: "spark",
    wave: "square",
    volume: 30,
    attackMs: 2,
    decayMs: 35,
  },
];

export function sanitizeMusicId(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]/g, "");

  return sanitized.length === 0 ? "music" : sanitized;
}

export function convertMidiToMusicProject(buffer: ArrayBuffer, fileName: string, options: MidiImportOptions): MusicProject {
  const midi = new Midi(buffer);
  const tickScale = outputTicksPerBeat / Math.max(1, midi.header.ppq);
  const usableTracks = midi.tracks.filter((track) => track.notes.length > 0).slice(0, defaultInstruments.length);
  const instruments = defaultInstruments.slice(0, Math.max(1, usableTracks.length)).map((instrument) => ({ ...instrument }));
  const detectedLengthTicks = Math.max(1, Math.ceil(midi.durationTicks * tickScale));
  const lengthTicks = options.lengthTicks === "auto" ? detectedLengthTicks : Math.max(1, Math.round(options.lengthTicks));
  const notes = usableTracks.flatMap((track, trackIndex) =>
    convertTrackNotes(track, trackIndex, tickScale, lengthTicks, options.quantizeGrid, options.transpose),
  );

  notes.sort((left, right) => left.startTick - right.startTick || left.instrument - right.instrument || left.note - right.note);
  notes.forEach((note, index) => {
    note.id = `note-${index + 1}`;
  });

  return {
    type: "music",
    id: sanitizeMusicId(options.musicId || getBaseFileName(fileName)),
    bpm: Math.round(midi.header.tempos[0]?.bpm ?? 120),
    ticksPerBeat: outputTicksPerBeat,
    lengthTicks,
    instruments,
    notes,
  };
}

function convertTrackNotes(
  track: Track,
  instrument: number,
  tickScale: number,
  lengthTicks: number,
  quantizeGrid: number,
  transpose: number,
): MusicNote[] {
  const notes: MusicNote[] = [];

  for (const midiNote of track.notes) {
    let startTick = Math.round(midiNote.ticks * tickScale);
    let durationTicks = Math.max(1, Math.round(midiNote.durationTicks * tickScale));

    if (quantizeGrid > 1) {
      startTick = quantizeTick(startTick, quantizeGrid);
      durationTicks = Math.max(1, quantizeTick(durationTicks, quantizeGrid));
    }

    if (startTick >= lengthTicks) {
      continue;
    }

    durationTicks = Math.min(durationTicks, lengthTicks - startTick);

    if (durationTicks <= 0) {
      continue;
    }

    notes.push({
      id: `note-${notes.length + 1}`,
      instrument,
      note: Math.round(clamp(midiNote.midi + transpose, 0, 127)),
      startTick,
      durationTicks,
      volume: Math.round(clamp(midiNote.velocity * 100, 1, 100)),
    });
  }

  return notes;
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
