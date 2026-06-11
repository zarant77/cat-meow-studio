import type { MusicPreviewQuality } from "../audio/musicGenerator.js";
import {
  normalizeMusicLoop,
  normalizeMusicLoudness,
  type MusicInstrument,
  type MusicLoop,
  type MusicNote,
  type MusicProject,
} from "../model/musicProject.js";
import { sanitizeSoundId } from "../utils/validation.js";

export interface MusicEditorState {
  project: MusicProject;
  selectedNoteId: string | null;
  selectedNoteIds: string[];
  noteSelectionAnchorId: string | null;
  selectionStartTick: number;
  selectionEndTick: number;
  selectedInstrumentIndex: number | null;
  playingNoteIds: string[];
  isPreviewPlaying: boolean;
  isPreviewRendering: boolean;
  previewQuality: MusicPreviewQuality;
  previewSamples: Float32Array;
  currentPlaybackTick: number;
}

export type MusicProjectPatch = Partial<
  Pick<MusicProject, "id" | "bpm" | "ticksPerBeat" | "lengthTicks" | "volume" | "normalizeVolume" | "targetAverageVolume" | "maxVolumeGain">
> & {
  loop?: Partial<MusicLoop>;
};
export type MusicNotePatch = Partial<Omit<MusicNote, "id">>;
export type MusicInstrumentPatch = Partial<MusicInstrument>;
export interface MusicNoteSelectionOptions {
  extendRange?: boolean;
  toggle?: boolean;
}

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
    ...normalizeMusicLoudness({}),
    loop: {
      enabled: false,
      startTick: 0,
      endTick: 16,
    },
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
  selectedNoteIds: ["note-1"],
  noteSelectionAnchorId: "note-1",
  selectionStartTick: 0,
  selectionEndTick: 16,
  selectedInstrumentIndex: 0,
  playingNoteIds: [],
  isPreviewPlaying: false,
  isPreviewRendering: false,
  previewQuality: "fast",
  previewSamples: new Float32Array(0),
  currentPlaybackTick: 0,
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
    selectedNoteIds: [...musicState.selectedNoteIds],
    playingNoteIds: [],
    isPreviewPlaying: false,
    isPreviewRendering: false,
    previewQuality: "fast",
    previewSamples: new Float32Array(0),
    currentPlaybackTick: musicState.currentPlaybackTick,
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
  const normalizedPatch = normalizeProjectPatch(patch, musicState.project);

  if (!hasProjectPatchChange(normalizedPatch)) {
    return;
  }

  const nextProject: MusicProject = {
    ...musicState.project,
    ...normalizedPatch,
    loop: {
      ...musicState.project.loop,
      ...normalizedPatch.loop,
    },
  };

  recordMusicHistoryEntry();

  musicState = {
    ...musicState,
    project: nextProject,
  };

  syncPresentMusicHistory();
}

export function selectMusicNote(noteId: string, options: MusicNoteSelectionOptions = {}): void {
  const note = musicState.project.notes.find((candidate) => candidate.id === noteId);

  if (note === undefined) {
    return;
  }

  const selectedNoteIds = getNextSelectedNoteIds(note.id, options);
  const primaryNote = getPrimarySelectedMusicNote(selectedNoteIds);

  musicState = {
    ...musicState,
    selectedNoteId: getSingleSelectedNoteId(selectedNoteIds),
    selectedNoteIds,
    noteSelectionAnchorId: options.extendRange ? (musicState.noteSelectionAnchorId ?? note.id) : note.id,
    selectedInstrumentIndex: primaryNote?.instrument ?? note.instrument,
  };
}

export function selectAllMusicNotes(): void {
  const selectedNoteIds = musicState.project.notes.map((note) => note.id);
  const primaryNote = getPrimarySelectedMusicNote(selectedNoteIds);

  musicState = {
    ...musicState,
    selectedNoteId: getSingleSelectedNoteId(selectedNoteIds),
    selectedNoteIds,
    noteSelectionAnchorId: primaryNote?.id ?? null,
    selectedInstrumentIndex: primaryNote?.instrument ?? musicState.selectedInstrumentIndex,
  };
}

export function clearMusicNoteSelection(): void {
  musicState = {
    ...musicState,
    selectedNoteId: null,
    selectedNoteIds: [],
    noteSelectionAnchorId: null,
  };
}

export function updateMusicSelectionRange(startTick: number, endTick: number): void {
  const normalizedRange = normalizeSelectionRange(startTick, endTick);

  musicState = {
    ...musicState,
    selectionStartTick: normalizedRange.startTick,
    selectionEndTick: normalizedRange.endTick,
  };
}

export function selectMusicNotesInRange(startTick = musicState.selectionStartTick, endTick = musicState.selectionEndTick): void {
  const range = normalizeSelectionRange(startTick, endTick);
  const selectedNoteIds = musicState.project.notes
    .filter((note) => doesNoteOverlapRange(note, range.startTick, range.endTick))
    .map((note) => note.id);
  const primaryNote = getPrimarySelectedMusicNote(selectedNoteIds);

  musicState = {
    ...musicState,
    selectionStartTick: range.startTick,
    selectionEndTick: range.endTick,
    selectedNoteId: getSingleSelectedNoteId(selectedNoteIds),
    selectedNoteIds,
    noteSelectionAnchorId: primaryNote?.id ?? null,
    selectedInstrumentIndex: primaryNote?.instrument ?? musicState.selectedInstrumentIndex,
  };
}

export function selectMusicNotesAtTick(tick: number): string[] {
  const selectedNoteIds = getMusicNoteIdsForTickSelection(tick);
  const primaryNote = getPrimarySelectedMusicNote(selectedNoteIds);

  musicState = {
    ...musicState,
    selectedNoteId: getSingleSelectedNoteId(selectedNoteIds),
    selectedNoteIds,
    noteSelectionAnchorId: primaryNote?.id ?? null,
    selectedInstrumentIndex: primaryNote?.instrument ?? musicState.selectedInstrumentIndex,
  };

  return selectedNoteIds;
}

export function setCurrentMusicPlaybackTick(tick: number): void {
  musicState = {
    ...musicState,
    currentPlaybackTick: clampInteger(tick, 0, Math.max(0, musicState.project.lengthTicks)),
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
      notes: sortMusicNotes([...musicState.project.notes, note]),
    },
    selectedNoteId: note.id,
    selectedNoteIds: [note.id],
    noteSelectionAnchorId: note.id,
    selectedInstrumentIndex,
  };
  syncPresentMusicHistory();
}

export function deleteSelectedMusicNote(): number {
  return deleteSelectedMusicNotes();
}

export function deleteSelectedMusicNotes(): number {
  const selectedNoteIds = getValidSelectedNoteIds();

  if (selectedNoteIds.length === 0) {
    return 0;
  }

  const firstNoteIndex = musicState.project.notes.findIndex((note) => note.id === selectedNoteIds[0]);

  if (firstNoteIndex === -1) {
    return 0;
  }

  recordMusicHistoryEntry();
  const selectedNoteIdSet = new Set(selectedNoteIds);
  const notes = musicState.project.notes.filter((note) => !selectedNoteIdSet.has(note.id));
  const nextSelectedNoteId = notes[Math.min(firstNoteIndex, notes.length - 1)]?.id ?? null;
  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      notes,
    },
    selectedNoteId: nextSelectedNoteId,
    selectedNoteIds: nextSelectedNoteId === null ? [] : [nextSelectedNoteId],
    noteSelectionAnchorId: nextSelectedNoteId,
  };
  syncPresentMusicHistory();

  return selectedNoteIds.length;
}

export function deleteMusicNotesInRange(startTick = musicState.selectionStartTick, endTick = musicState.selectionEndTick): number {
  const range = normalizeSelectionRange(startTick, endTick);
  const noteIds = musicState.project.notes
    .filter((note) => doesNoteOverlapRange(note, range.startTick, range.endTick))
    .map((note) => note.id);

  return deleteMusicNotesById(noteIds, range.startTick, range.endTick);
}

export function trimEmptyMusicIntro(): boolean {
  const earliestNoteStart = musicState.project.notes.reduce<number | null>(
    (earliest, note) => (earliest === null ? note.startTick : Math.min(earliest, note.startTick)),
    null,
  );

  if (earliestNoteStart === null || earliestNoteStart <= 0) {
    return false;
  }

  recordMusicHistoryEntry();
  const shiftTicks = earliestNoteStart;
  const notes = sortMusicNotes(
    musicState.project.notes.map((note) => ({
      ...note,
      startTick: Math.max(0, note.startTick - shiftTicks),
    })),
  );
  const maxNoteEndTick = notes.reduce((maxEndTick, note) => Math.max(maxEndTick, note.startTick + note.durationTicks), 0);
  const lengthTicks = Math.max(1, musicState.project.lengthTicks - shiftTicks, maxNoteEndTick);
  const loop = getTrimmedMusicLoop(shiftTicks, lengthTicks);
  const selectionStartTick = Math.min(Math.max(0, lengthTicks - 1), Math.max(0, musicState.selectionStartTick - shiftTicks));
  const selectionEndTick = Math.min(lengthTicks, Math.max(selectionStartTick + 1, Math.max(0, musicState.selectionEndTick - shiftTicks)));

  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      lengthTicks,
      loop,
      notes,
    },
    selectionStartTick,
    selectionEndTick,
    currentPlaybackTick: Math.min(lengthTicks, Math.max(0, musicState.currentPlaybackTick - shiftTicks)),
  };
  syncPresentMusicHistory();

  return true;
}

export function updateSelectedMusicNote(patch: MusicNotePatch): void {
  if (musicState.selectedNoteId === null) {
    return;
  }

  updateMusicNote(musicState.selectedNoteId, patch);
}

export function updateMusicNote(noteId: string, patch: MusicNotePatch): void {
  const normalizedPatch = normalizeNotePatch(patch);

  if (!hasNotePatchChange(noteId, normalizedPatch)) {
    return;
  }

  recordMusicHistoryEntry();
  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      notes: sortMusicNotes(musicState.project.notes.map((note) => (note.id === noteId ? { ...note, ...normalizedPatch } : note))),
    },
    selectedNoteId: noteId,
    selectedNoteIds: [noteId],
    noteSelectionAnchorId: noteId,
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
  const selectedNoteIds = getSaneSelectedNoteIds(notes, musicState.selectedNoteIds);

  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      instruments,
      notes,
    },
    selectedNoteIds,
    selectedNoteId: getSingleSelectedNoteId(selectedNoteIds),
    noteSelectionAnchorId: getSaneSelectedNoteId(notes, musicState.noteSelectionAnchorId),
    selectedInstrumentIndex: getSaneSelectedInstrumentIndex(instruments, Math.min(removedIndex, instruments.length - 1)),
  };
  syncPresentMusicHistory();
}

export function getSelectedMusicNote(state: MusicEditorState): MusicNote | null {
  return state.selectedNoteIds.length === 1 ? (state.project.notes.find((note) => note.id === state.selectedNoteIds[0]) ?? null) : null;
}

function createNote(id: string, instrument: number, note: number, startTick: number, durationTicks: number, volume: number): MusicNote {
  return {
    id,
    instrument,
    note,
    startTick,
    durationTicks,
    volume,
  };
}

function normalizeProjectPatch(patch: MusicProjectPatch, project: MusicProject): MusicProjectPatch {
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

  if (
    patch.volume !== undefined ||
    patch.normalizeVolume !== undefined ||
    patch.targetAverageVolume !== undefined ||
    patch.maxVolumeGain !== undefined
  ) {
    const { loop: _loop, ...loudnessPatch } = patch;

    const loudness = normalizeMusicLoudness({
      ...project,
      ...loudnessPatch,
    });

    if (patch.volume !== undefined) {
      normalized.volume = loudness.volume;
    }

    if (patch.normalizeVolume !== undefined) {
      normalized.normalizeVolume = loudness.normalizeVolume;
    }

    if (patch.targetAverageVolume !== undefined) {
      normalized.targetAverageVolume = loudness.targetAverageVolume;
    }

    if (patch.maxVolumeGain !== undefined) {
      normalized.maxVolumeGain = loudness.maxVolumeGain;
    }
  }

  if (patch.loop !== undefined || normalized.lengthTicks !== undefined) {
    normalized.loop = normalizeMusicLoop(
      {
        ...project.loop,
        ...patch.loop,
      },
      normalized.lengthTicks ?? project.lengthTicks,
    );
  }

  return normalized;
}

function hasProjectPatchChange(patch: MusicProjectPatch): boolean {
  return (
    (patch.id !== undefined && patch.id !== musicState.project.id) ||
    (patch.bpm !== undefined && patch.bpm !== musicState.project.bpm) ||
    (patch.ticksPerBeat !== undefined && patch.ticksPerBeat !== musicState.project.ticksPerBeat) ||
    (patch.lengthTicks !== undefined && patch.lengthTicks !== musicState.project.lengthTicks) ||
    (patch.volume !== undefined && patch.volume !== musicState.project.volume) ||
    (patch.normalizeVolume !== undefined && patch.normalizeVolume !== musicState.project.normalizeVolume) ||
    (patch.targetAverageVolume !== undefined && patch.targetAverageVolume !== musicState.project.targetAverageVolume) ||
    (patch.maxVolumeGain !== undefined && patch.maxVolumeGain !== musicState.project.maxVolumeGain) ||
    (patch.loop !== undefined && hasLoopPatchChange(patch.loop))
  );
}

function hasLoopPatchChange(loop: Partial<MusicLoop>): boolean {
  return (
    (loop.enabled !== undefined && loop.enabled !== musicState.project.loop.enabled) ||
    (loop.startTick !== undefined && loop.startTick !== musicState.project.loop.startTick) ||
    (loop.endTick !== undefined && loop.endTick !== musicState.project.loop.endTick)
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

function applyMusicProject(
  project: MusicProject,
  preferredSelectedNoteId: string | null,
  preferredSelectedInstrumentIndex: number | null,
): void {
  const clonedProject = cloneMusicProject(project);
  const selectedNoteIds = getSaneSelectedNoteIds(clonedProject.notes, preferredSelectedNoteId === null ? [] : [preferredSelectedNoteId]);
  const selectedNoteId = getSingleSelectedNoteId(selectedNoteIds);
  const selectedInstrumentIndex = getSaneSelectedInstrumentIndex(clonedProject.instruments, preferredSelectedInstrumentIndex);

  musicState = {
    project: clonedProject,
    selectedNoteId,
    selectedNoteIds,
    noteSelectionAnchorId: selectedNoteIds[0] ?? null,
    selectionStartTick: musicState.selectionStartTick,
    selectionEndTick: Math.min(Math.max(1, clonedProject.lengthTicks), musicState.selectionEndTick),
    selectedInstrumentIndex,
    playingNoteIds: [],
    isPreviewPlaying: false,
    isPreviewRendering: false,
    previewQuality: "fast",
    previewSamples: new Float32Array(0),
    currentPlaybackTick: 0,
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
    ...normalizeMusicLoudness({}),
    loop: {
      enabled: false,
      startTick: 0,
      endTick: 16,
    },
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

function getSaneSelectedNoteIds(notes: MusicNote[], preferredSelectedNoteIds: string[]): string[] {
  const noteIds = new Set(notes.map((note) => note.id));
  const selectedNoteIds = preferredSelectedNoteIds.filter(
    (noteId, index) => noteIds.has(noteId) && preferredSelectedNoteIds.indexOf(noteId) === index,
  );

  if (selectedNoteIds.length > 0) {
    return selectedNoteIds;
  }

  return notes[0] === undefined ? [] : [notes[0].id];
}

function getValidSelectedNoteIds(): string[] {
  const noteIds = new Set(musicState.project.notes.map((note) => note.id));

  return musicState.selectedNoteIds.filter((noteId, index) => noteIds.has(noteId) && musicState.selectedNoteIds.indexOf(noteId) === index);
}

function getSingleSelectedNoteId(selectedNoteIds: string[]): string | null {
  return selectedNoteIds.length === 1 ? (selectedNoteIds[0] ?? null) : null;
}

function getPrimarySelectedMusicNote(selectedNoteIds: string[]): MusicNote | null {
  const selectedNoteIdSet = new Set(selectedNoteIds);

  return musicState.project.notes.find((note) => selectedNoteIdSet.has(note.id)) ?? null;
}

function getNextSelectedNoteIds(noteId: string, options: MusicNoteSelectionOptions): string[] {
  if (options.extendRange) {
    return getMusicNoteRangeSelection(noteId);
  }

  if (options.toggle) {
    const selectedNoteIds = new Set(getValidSelectedNoteIds());

    if (selectedNoteIds.has(noteId)) {
      selectedNoteIds.delete(noteId);
    } else {
      selectedNoteIds.add(noteId);
    }

    return musicState.project.notes.filter((note) => selectedNoteIds.has(note.id)).map((note) => note.id);
  }

  return [noteId];
}

function getMusicNoteRangeSelection(noteId: string): string[] {
  const notes = getSortedMusicNotes();
  const anchorId = musicState.noteSelectionAnchorId ?? musicState.selectedNoteIds[0] ?? noteId;
  const anchorIndex = notes.findIndex((note) => note.id === anchorId);
  const noteIndex = notes.findIndex((note) => note.id === noteId);

  if (anchorIndex === -1 || noteIndex === -1) {
    return [noteId];
  }

  const startIndex = Math.min(anchorIndex, noteIndex);
  const endIndex = Math.max(anchorIndex, noteIndex);

  return notes.slice(startIndex, endIndex + 1).map((note) => note.id);
}

function getMusicNoteIdsForTickSelection(tick: number): string[] {
  const currentTick = clampInteger(tick, 0, Math.max(0, musicState.project.lengthTicks));
  const activeNoteIds = musicState.project.notes
    .filter((note) => currentTick >= note.startTick && currentTick < note.startTick + note.durationTicks)
    .map((note) => note.id);

  if (activeNoteIds.length > 0) {
    return activeNoteIds;
  }

  const nextStartTick = musicState.project.notes.reduce<number | null>((bestTick, note) => {
    if (note.startTick < currentTick) {
      return bestTick;
    }

    return bestTick === null ? note.startTick : Math.min(bestTick, note.startTick);
  }, null);

  if (nextStartTick !== null) {
    return musicState.project.notes.filter((note) => note.startTick === nextStartTick).map((note) => note.id);
  }

  const previousStartTick = musicState.project.notes.reduce<number | null>((bestTick, note) => {
    if (note.startTick >= currentTick) {
      return bestTick;
    }

    return bestTick === null ? note.startTick : Math.max(bestTick, note.startTick);
  }, null);

  return previousStartTick === null
    ? []
    : musicState.project.notes.filter((note) => note.startTick === previousStartTick).map((note) => note.id);
}

function normalizeSelectionRange(startTick: number, endTick: number): { startTick: number; endTick: number } {
  const start = clampInteger(startTick, 0, Math.max(0, musicState.project.lengthTicks));
  const end = clampInteger(endTick, 0, Math.max(0, musicState.project.lengthTicks));
  const minTick = Math.min(start, end);
  const maxTick = Math.max(start, end);

  return {
    startTick: minTick,
    endTick: Math.max(minTick + 1, maxTick),
  };
}

function doesNoteOverlapRange(note: MusicNote, startTick: number, endTick: number): boolean {
  return note.startTick < endTick && note.startTick + note.durationTicks > startTick;
}

function getTrimmedMusicLoop(shiftTicks: number, lengthTicks: number): MusicLoop {
  const startTick = Math.max(0, musicState.project.loop.startTick - shiftTicks);
  const endTick = Math.max(0, musicState.project.loop.endTick - shiftTicks);

  if (musicState.project.loop.enabled && endTick <= startTick) {
    return normalizeMusicLoop(
      {
        enabled: false,
        startTick: 0,
        endTick: lengthTicks,
      },
      lengthTicks,
    );
  }

  return normalizeMusicLoop(
    {
      ...musicState.project.loop,
      startTick,
      endTick,
    },
    lengthTicks,
  );
}

function deleteMusicNotesById(noteIds: string[], selectionStartTick: number, selectionEndTick: number): number {
  const noteIdSet = new Set(noteIds);

  if (noteIdSet.size === 0) {
    return 0;
  }

  const firstNoteIndex = musicState.project.notes.findIndex((note) => noteIdSet.has(note.id));

  if (firstNoteIndex === -1) {
    return 0;
  }

  recordMusicHistoryEntry();
  const notes = musicState.project.notes.filter((note) => !noteIdSet.has(note.id));
  const nextSelectedNoteId = notes[Math.min(firstNoteIndex, notes.length - 1)]?.id ?? null;

  musicState = {
    ...musicState,
    project: {
      ...musicState.project,
      notes,
    },
    selectionStartTick,
    selectionEndTick,
    selectedNoteId: nextSelectedNoteId,
    selectedNoteIds: nextSelectedNoteId === null ? [] : [nextSelectedNoteId],
    noteSelectionAnchorId: nextSelectedNoteId,
  };
  syncPresentMusicHistory();

  return noteIdSet.size;
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
  const loudness = normalizeMusicLoudness(project);

  return {
    ...project,
    ...loudness,
    loop: normalizeMusicLoop(project.loop, project.lengthTicks),
    instruments: project.instruments.map((instrument) => ({ ...instrument })),
    notes: sortMusicNotes(project.notes.map((note) => ({ ...note }))),
  };
}

function sortMusicNotes(notes: MusicNote[]): MusicNote[] {
  return [...notes].sort(
    (left, right) =>
      left.startTick - right.startTick || left.instrument - right.instrument || left.note - right.note || left.id.localeCompare(right.id),
  );
}

function getSortedMusicNotes(): MusicNote[] {
  return sortMusicNotes(musicState.project.notes);
}
