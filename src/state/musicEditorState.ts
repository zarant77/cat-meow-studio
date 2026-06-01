import type { MusicInstrument, MusicNote, MusicProject } from "../model/musicProject.js";
import { sanitizeSoundId } from "../utils/validation.js";

export interface MusicEditorState {
  project: MusicProject;
  selectedNoteId: string | null;
  selectedInstrumentIndex: number | null;
}

export type MusicProjectPatch = Partial<Pick<MusicProject, "id" | "bpm" | "ticksPerBeat" | "lengthTicks">>;
export type MusicNotePatch = Partial<Omit<MusicNote, "id">>;
export type MusicInstrumentPatch = Partial<MusicInstrument>;

interface MusicHistoryState {
  past: MusicProject[];
  present: MusicProject;
  future: MusicProject[];
}

interface ReplaceMusicProjectOptions {
  recordHistory?: boolean;
}

const defaultInstrument: MusicInstrument = {
  id: "lead",
  wave: "square",
  volume: 70,
  attackMs: 5,
  decayMs: 40,
};

let nextNoteNumber = 5;

let musicState: MusicEditorState = {
  project: {
    type: "music",
    id: "main_theme",
    bpm: 120,
    ticksPerBeat: 4,
    lengthTicks: 16,
    instruments: [
      defaultInstrument,
      {
        id: "bass",
        wave: "triangle",
        volume: 52,
        attackMs: 8,
        decayMs: 80,
      },
    ],
    notes: [
      createNote("note-1", 0, 64, 0, 2, 80),
      createNote("note-2", 0, 67, 2, 2, 80),
      createNote("note-3", 0, 69, 4, 4, 80),
      createNote("note-4", 1, 52, 0, 8, 60),
    ],
  },
  selectedNoteId: "note-1",
  selectedInstrumentIndex: 0,
};

let musicHistoryState: MusicHistoryState = {
  past: [],
  present: cloneMusicProject(musicState.project),
  future: [],
};

export function getMusicEditorState(): MusicEditorState {
  return {
    ...musicState,
    project: cloneMusicProject(musicState.project),
  };
}

export function getCurrentMusicProject(): MusicProject {
  return cloneMusicProject(musicState.project);
}

export function canUndoMusic(): boolean {
  return musicHistoryState.past.length > 0;
}

export function canRedoMusic(): boolean {
  return musicHistoryState.future.length > 0;
}

export function undoMusic(): boolean {
  const previousProject = musicHistoryState.past.at(-1);

  if (previousProject === undefined) {
    return false;
  }

  const currentProject = getCurrentMusicProject();
  musicHistoryState = {
    past: musicHistoryState.past.slice(0, -1),
    present: cloneMusicProject(previousProject),
    future: [currentProject, ...musicHistoryState.future],
  };
  applyMusicProject(previousProject, musicState.selectedNoteId, musicState.selectedInstrumentIndex);

  return true;
}

export function redoMusic(): boolean {
  const nextProject = musicHistoryState.future[0];

  if (nextProject === undefined) {
    return false;
  }

  const currentProject = getCurrentMusicProject();
  musicHistoryState = {
    past: [...musicHistoryState.past, currentProject],
    present: cloneMusicProject(nextProject),
    future: musicHistoryState.future.slice(1),
  };
  applyMusicProject(nextProject, musicState.selectedNoteId, musicState.selectedInstrumentIndex);

  return true;
}

export function createNewMusicProject(): void {
  recordMusicHistoryEntry();
  applyMusicProject(createBlankMusicProject(), null, 0);
}

export function replaceCurrentMusicProject(project: MusicProject, options: ReplaceMusicProjectOptions = {}): void {
  if (options.recordHistory !== false) {
    recordMusicHistoryEntry();
  }

  applyMusicProject(project, null, 0);
}

export function updateMusicProject(patch: MusicProjectPatch): void {
  const normalizedPatch = normalizeProjectPatch(patch);

  if (!hasProjectPatchChange(normalizedPatch)) {
    return;
  }

  recordMusicHistoryEntry();
  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      ...normalizedPatch,
    },
  };
  syncPresentMusicHistory();
}

export function selectMusicNote(noteId: string): void {
  const note = musicState.project.notes.find((candidate) => candidate.id === noteId);

  if (note === undefined) {
    return;
  }

  musicState = {
    ...musicState,
    selectedNoteId: note.id,
    selectedInstrumentIndex: note.instrument,
  };
}

export function selectMusicInstrument(index: number): void {
  if (musicState.project.instruments[index] === undefined) {
    return;
  }

  musicState = {
    ...musicState,
    selectedInstrumentIndex: index,
  };
}

export function addMusicNote(): void {
  recordMusicHistoryEntry();
  const selectedNote = getSelectedMusicNote(musicState);
  const instruments = musicState.project.instruments.length === 0 ? [{ ...defaultInstrument }] : musicState.project.instruments;
  const selectedInstrumentIndex = musicState.selectedInstrumentIndex ?? 0;
  const note = createNote(
    `note-${nextNoteNumber}`,
    selectedInstrumentIndex,
    selectedNote?.note ?? 64,
    selectedNote === null ? 0 : Math.min(musicState.project.lengthTicks - 1, selectedNote.startTick + 1),
    selectedNote?.durationTicks ?? 2,
    selectedNote?.volume ?? 80,
  );
  nextNoteNumber += 1;

  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      instruments,
      notes: [...musicState.project.notes, note],
    },
    selectedNoteId: note.id,
    selectedInstrumentIndex,
  };
  syncPresentMusicHistory();
}

export function deleteSelectedMusicNote(): void {
  if (musicState.selectedNoteId === null) {
    return;
  }

  const noteIndex = musicState.project.notes.findIndex((note) => note.id === musicState.selectedNoteId);

  if (noteIndex === -1) {
    return;
  }

  recordMusicHistoryEntry();
  const notes = musicState.project.notes.filter((note) => note.id !== musicState.selectedNoteId);
  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      notes,
    },
    selectedNoteId: notes[Math.min(noteIndex, notes.length - 1)]?.id ?? null,
  };
  syncPresentMusicHistory();
}

export function updateSelectedMusicNote(patch: MusicNotePatch): void {
  if (musicState.selectedNoteId === null) {
    return;
  }

  const normalizedPatch = normalizeNotePatch(patch);

  if (!hasNotePatchChange(musicState.selectedNoteId, normalizedPatch)) {
    return;
  }

  recordMusicHistoryEntry();
  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      notes: musicState.project.notes.map((note) =>
        note.id === musicState.selectedNoteId ? { ...note, ...normalizedPatch } : note,
      ),
    },
    selectedInstrumentIndex: normalizedPatch.instrument ?? musicState.selectedInstrumentIndex,
  };
  syncPresentMusicHistory();
}

export function updateSelectedMusicInstrument(patch: MusicInstrumentPatch): void {
  if (musicState.selectedInstrumentIndex === null) {
    return;
  }

  const normalizedPatch = normalizeInstrumentPatch(patch);

  if (!hasInstrumentPatchChange(musicState.selectedInstrumentIndex, normalizedPatch)) {
    return;
  }

  recordMusicHistoryEntry();
  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      instruments: musicState.project.instruments.map((instrument, index) =>
        index === musicState.selectedInstrumentIndex ? { ...instrument, ...normalizedPatch } : instrument,
      ),
    },
  };
  syncPresentMusicHistory();
}

export function addMusicInstrument(): void {
  recordMusicHistoryEntry();
  const instrument: MusicInstrument = {
    ...defaultInstrument,
    id: `inst_${musicState.project.instruments.length + 1}`,
  };
  const instruments = [...musicState.project.instruments, instrument];

  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      instruments,
    },
    selectedInstrumentIndex: instruments.length - 1,
  };
  syncPresentMusicHistory();
}

export function deleteSelectedMusicInstrument(): void {
  if (
    musicState.selectedInstrumentIndex === null ||
    musicState.project.instruments.length <= 1 ||
    musicState.project.instruments[musicState.selectedInstrumentIndex] === undefined
  ) {
    return;
  }

  recordMusicHistoryEntry();
  const removedIndex = musicState.selectedInstrumentIndex;
  const instruments = musicState.project.instruments.filter((_, index) => index !== removedIndex);
  const notes = musicState.project.notes
    .filter((note) => note.instrument !== removedIndex)
    .map((note) => ({
      ...note,
      instrument: note.instrument > removedIndex ? note.instrument - 1 : note.instrument,
    }));

  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      instruments,
      notes,
    },
    selectedNoteId: getSaneSelectedNoteId(notes, musicState.selectedNoteId),
    selectedInstrumentIndex: getSaneSelectedInstrumentIndex(instruments, Math.min(removedIndex, instruments.length - 1)),
  };
  syncPresentMusicHistory();
}

export function getSelectedMusicNote(state: MusicEditorState): MusicNote | null {
  return state.project.notes.find((note) => note.id === state.selectedNoteId) ?? null;
}

function createNote(
  id: string,
  instrument: number,
  note: number,
  startTick: number,
  durationTicks: number,
  volume: number,
): MusicNote {
  return {
    id,
    instrument,
    note,
    startTick,
    durationTicks,
    volume,
  };
}

function normalizeProjectPatch(patch: MusicProjectPatch): MusicProjectPatch {
  const normalized: MusicProjectPatch = {};

  if (patch.id !== undefined) {
    normalized.id = sanitizeSoundId(patch.id);
  }

  if (patch.bpm !== undefined) {
    normalized.bpm = Math.max(20, Math.round(patch.bpm));
  }

  if (patch.ticksPerBeat !== undefined) {
    normalized.ticksPerBeat = Math.max(1, Math.round(patch.ticksPerBeat));
  }

  if (patch.lengthTicks !== undefined) {
    normalized.lengthTicks = Math.max(1, Math.round(patch.lengthTicks));
  }

  return normalized;
}

function hasProjectPatchChange(patch: MusicProjectPatch): boolean {
  return (
    (patch.id !== undefined && patch.id !== musicState.project.id) ||
    (patch.bpm !== undefined && patch.bpm !== musicState.project.bpm) ||
    (patch.ticksPerBeat !== undefined && patch.ticksPerBeat !== musicState.project.ticksPerBeat) ||
    (patch.lengthTicks !== undefined && patch.lengthTicks !== musicState.project.lengthTicks)
  );
}

function normalizeNotePatch(patch: MusicNotePatch): MusicNotePatch {
  const normalized: MusicNotePatch = {};

  if (patch.instrument !== undefined) {
    normalized.instrument = clampInteger(patch.instrument, 0, Math.max(0, musicState.project.instruments.length - 1));
  }

  if (patch.note !== undefined) {
    normalized.note = clampInteger(patch.note, 0, 127);
  }

  if (patch.startTick !== undefined) {
    normalized.startTick = clampInteger(patch.startTick, 0, Math.max(0, musicState.project.lengthTicks - 1));
  }

  if (patch.durationTicks !== undefined) {
    normalized.durationTicks = clampInteger(patch.durationTicks, 1, musicState.project.lengthTicks);
  }

  if (patch.volume !== undefined) {
    normalized.volume = clampInteger(patch.volume, 0, 100);
  }

  return normalized;
}

function hasNotePatchChange(noteId: string, patch: MusicNotePatch): boolean {
  const note = musicState.project.notes.find((candidate) => candidate.id === noteId);

  if (note === undefined) {
    return false;
  }

  return (
    (patch.instrument !== undefined && patch.instrument !== note.instrument) ||
    (patch.note !== undefined && patch.note !== note.note) ||
    (patch.startTick !== undefined && patch.startTick !== note.startTick) ||
    (patch.durationTicks !== undefined && patch.durationTicks !== note.durationTicks) ||
    (patch.volume !== undefined && patch.volume !== note.volume)
  );
}

function normalizeInstrumentPatch(patch: MusicInstrumentPatch): MusicInstrumentPatch {
  const normalized: MusicInstrumentPatch = {};

  if (patch.id !== undefined) {
    normalized.id = sanitizeSoundId(patch.id);
  }

  if (patch.wave !== undefined) {
    normalized.wave = patch.wave;
  }

  if (patch.volume !== undefined) {
    normalized.volume = clampInteger(patch.volume, 0, 100);
  }

  if (patch.attackMs !== undefined) {
    normalized.attackMs = Math.max(0, Math.round(patch.attackMs));
  }

  if (patch.decayMs !== undefined) {
    normalized.decayMs = Math.max(0, Math.round(patch.decayMs));
  }

  return normalized;
}

function hasInstrumentPatchChange(index: number, patch: MusicInstrumentPatch): boolean {
  const instrument = musicState.project.instruments[index];

  if (instrument === undefined) {
    return false;
  }

  return (
    (patch.id !== undefined && patch.id !== instrument.id) ||
    (patch.wave !== undefined && patch.wave !== instrument.wave) ||
    (patch.volume !== undefined && patch.volume !== instrument.volume) ||
    (patch.attackMs !== undefined && patch.attackMs !== instrument.attackMs) ||
    (patch.decayMs !== undefined && patch.decayMs !== instrument.decayMs)
  );
}

function recordMusicHistoryEntry(): void {
  musicHistoryState = {
    past: [...musicHistoryState.past, cloneMusicProject(musicHistoryState.present)],
    present: cloneMusicProject(musicHistoryState.present),
    future: [],
  };
}

function syncPresentMusicHistory(): void {
  musicHistoryState = {
    ...musicHistoryState,
    present: getCurrentMusicProject(),
  };
}

function applyMusicProject(project: MusicProject, preferredSelectedNoteId: string | null, preferredSelectedInstrumentIndex: number | null): void {
  const clonedProject = cloneMusicProject(project);
  const selectedNoteId = getSaneSelectedNoteId(clonedProject.notes, preferredSelectedNoteId);
  const selectedInstrumentIndex = getSaneSelectedInstrumentIndex(clonedProject.instruments, preferredSelectedInstrumentIndex);

  musicState = {
    project: clonedProject,
    selectedNoteId,
    selectedInstrumentIndex,
  };
  nextNoteNumber = Math.max(getNextNoteNumber(clonedProject.notes), nextNoteNumber);
  syncPresentMusicHistory();
}

function createBlankMusicProject(): MusicProject {
  return {
    type: "music",
    id: "music",
    bpm: 120,
    ticksPerBeat: 4,
    lengthTicks: 16,
    instruments: [{ ...defaultInstrument }],
    notes: [],
  };
}

function getSaneSelectedNoteId(notes: MusicNote[], preferredSelectedNoteId: string | null): string | null {
  if (preferredSelectedNoteId !== null && notes.some((note) => note.id === preferredSelectedNoteId)) {
    return preferredSelectedNoteId;
  }

  return notes[0]?.id ?? null;
}

function getSaneSelectedInstrumentIndex(instruments: MusicInstrument[], preferredSelectedInstrumentIndex: number | null): number | null {
  if (preferredSelectedInstrumentIndex !== null && instruments[preferredSelectedInstrumentIndex] !== undefined) {
    return preferredSelectedInstrumentIndex;
  }

  return instruments[0] === undefined ? null : 0;
}

function getNextNoteNumber(notes: MusicNote[]): number {
  const highestNoteNumber = notes.reduce((highest, note) => {
    const match = /^note-(\d+)$/.exec(note.id);

    if (match === null) {
      return highest;
    }

    return Math.max(highest, Number(match[1]));
  }, 0);

  return highestNoteNumber + 1;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function cloneMusicProject(project: MusicProject): MusicProject {
  return {
    ...project,
    instruments: project.instruments.map((instrument) => ({ ...instrument })),
    notes: project.notes.map((note) => ({ ...note })),
  };
}
