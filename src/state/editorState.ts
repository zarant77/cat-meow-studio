import type { SoundCommand, SoundProject, SoundWave } from "../model/soundProject.js";
import { getSoundPreset, soundPresets } from "../model/soundPresets.js";
import { sanitizeSoundId } from "../utils/validation.js";

export interface EditorState {
  currentProjectId: string;
  commands: SoundCommand[];
  selectedCommandId: string | null;
  selectedPresetId: string | null;
}

export type SoundCommandPatch = Partial<Omit<SoundCommand, "id">>;

interface HistoryState {
  past: SoundProject[];
  present: SoundProject;
  future: SoundProject[];
}

interface ReplaceProjectOptions {
  recordHistory?: boolean;
}

const initialPreset = soundPresets[0];
const initialCommands: SoundCommand[] = initialPreset === undefined ? [] : cloneCommands(initialPreset);
const initialProject: SoundProject = {
  id: initialPreset?.id ?? "sound",
  commands: initialCommands,
};

let nextCommandNumber = initialCommands.length + 1;

let editorState: EditorState = {
  currentProjectId: initialProject.id,
  commands: initialCommands,
  selectedCommandId: initialCommands[0]?.id ?? null,
  selectedPresetId: initialPreset?.id ?? null,
};

let historyState: HistoryState = {
  past: [],
  present: cloneProject(initialProject),
  future: [],
};

const defaultCommandFields: Omit<SoundCommand, "id"> = {
  wave: "square",
  frequencyStart: 440,
  frequencyEnd: 660,
  durationMs: 120,
  volume: 70,
};

export function getEditorState(): EditorState {
  return {
    ...editorState,
    commands: editorState.commands.map((command) => ({ ...command })),
  };
}

export function getCurrentProject(): SoundProject {
  const state = getEditorState();

  return {
    id: state.currentProjectId,
    commands: state.commands,
  };
}

export function getSelectedCommand(state: EditorState): SoundCommand | null {
  return state.commands.find((command) => command.id === state.selectedCommandId) ?? null;
}

export function canUndo(): boolean {
  return historyState.past.length > 0;
}

export function canRedo(): boolean {
  return historyState.future.length > 0;
}

export function undo(): boolean {
  const previousProject = historyState.past.at(-1);

  if (previousProject === undefined) {
    return false;
  }

  const currentProject = getCurrentProject();
  historyState = {
    past: historyState.past.slice(0, -1),
    present: cloneProject(previousProject),
    future: [currentProject, ...historyState.future],
  };
  applyProject(previousProject, editorState.selectedCommandId, null);

  return true;
}

export function redo(): boolean {
  const nextProject = historyState.future[0];

  if (nextProject === undefined) {
    return false;
  }

  const currentProject = getCurrentProject();
  historyState = {
    past: [...historyState.past, currentProject],
    present: cloneProject(nextProject),
    future: historyState.future.slice(1),
  };
  applyProject(nextProject, editorState.selectedCommandId, null);

  return true;
}

export function replaceCurrentProject(project: SoundProject, options: ReplaceProjectOptions = {}): void {
  if (options.recordHistory !== false) {
    recordHistoryEntry();
  }

  applyProject(project, null, null);
}

export function createNewProject(): void {
  recordHistoryEntry();

  const command: SoundCommand = {
    id: `command-${nextCommandNumber}`,
    ...defaultCommandFields,
  };
  nextCommandNumber += 1;

  editorState = {
    ...editorState,
    currentProjectId: "sound",
    commands: [command],
    selectedCommandId: command.id,
    selectedPresetId: null,
  };
  syncPresentHistory();
}

export function updateProjectId(value: string): void {
  const sanitizedId = sanitizeSoundId(value);

  if (sanitizedId === editorState.currentProjectId) {
    return;
  }

  recordHistoryEntry();
  editorState = {
    ...editorState,
    currentProjectId: sanitizedId,
  };
  syncPresentHistory();
}

export function selectCommand(commandId: string): void {
  const commandExists = editorState.commands.some((command) => command.id === commandId);

  if (!commandExists) {
    return;
  }

  editorState = {
    ...editorState,
    selectedCommandId: commandId,
  };
}

export function addCommand(): void {
  recordHistoryEntry();

  const selectedCommand = getSelectedCommand(editorState);
  const command: SoundCommand = {
    id: `command-${nextCommandNumber}`,
    wave: selectedCommand?.wave ?? defaultCommandFields.wave,
    frequencyStart: selectedCommand?.frequencyStart ?? defaultCommandFields.frequencyStart,
    frequencyEnd: selectedCommand?.frequencyEnd ?? defaultCommandFields.frequencyEnd,
    durationMs: selectedCommand?.durationMs ?? defaultCommandFields.durationMs,
    volume: selectedCommand?.volume ?? defaultCommandFields.volume,
  };
  nextCommandNumber += 1;

  editorState = {
    ...editorState,
    commands: [...editorState.commands, command],
    selectedCommandId: command.id,
  };
  syncPresentHistory();
}

export function duplicateSelectedCommand(commandId = editorState.selectedCommandId): void {
  const selectedCommand = editorState.commands.find((command) => command.id === commandId) ?? null;

  if (selectedCommand === null) {
    return;
  }

  recordHistoryEntry();
  const selectedIndex = editorState.commands.findIndex((command) => command.id === selectedCommand.id);
  const duplicatedCommand: SoundCommand = {
    ...selectedCommand,
    id: `command-${nextCommandNumber}`,
  };
  nextCommandNumber += 1;

  const commands = [...editorState.commands];
  commands.splice(selectedIndex + 1, 0, duplicatedCommand);

  editorState = {
    ...editorState,
    commands,
    selectedCommandId: duplicatedCommand.id,
  };
  syncPresentHistory();
}

export function deleteSelectedCommand(): void {
  if (editorState.selectedCommandId !== null) {
    deleteCommand(editorState.selectedCommandId);
  }
}

export function resetSelectedCommandToDefaults(): void {
  updateSelectedCommand(defaultCommandFields);
}

export function createProjectFromPreset(presetId: string): void {
  const preset = getSoundPreset(presetId);

  if (preset === null) {
    return;
  }

  recordHistoryEntry();
  applyProject(preset, null, preset.id);
}

export function resetProjectToSelectedPreset(): void {
  if (editorState.selectedPresetId === null) {
    return;
  }

  const preset = getSoundPreset(editorState.selectedPresetId);

  if (preset === null) {
    return;
  }

  recordHistoryEntry();
  applyProject(preset, null, editorState.selectedPresetId);
}

export function deleteCommand(commandId: string): void {
  const commandIndex = editorState.commands.findIndex((command) => command.id === commandId);

  if (commandIndex === -1) {
    return;
  }

  recordHistoryEntry();
  const commands = editorState.commands.filter((command) => command.id !== commandId);
  const selectedCommandId =
    editorState.selectedCommandId === commandId
      ? commands[Math.min(commandIndex, commands.length - 1)]?.id ?? null
      : editorState.selectedCommandId;

  editorState = {
    ...editorState,
    commands,
    selectedCommandId,
  };
  syncPresentHistory();
}

export function moveCommand(commandId: string, direction: -1 | 1): void {
  const commandIndex = editorState.commands.findIndex((command) => command.id === commandId);
  const nextIndex = commandIndex + direction;

  if (commandIndex === -1 || nextIndex < 0 || nextIndex >= editorState.commands.length) {
    return;
  }

  recordHistoryEntry();
  const commands = [...editorState.commands];
  const command = commands[commandIndex];
  const targetCommand = commands[nextIndex];

  if (command === undefined || targetCommand === undefined) {
    return;
  }

  commands[commandIndex] = targetCommand;
  commands[nextIndex] = command;

  editorState = {
    ...editorState,
    commands,
    selectedCommandId: commandId,
  };
  syncPresentHistory();
}

export function updateSelectedCommand(patch: SoundCommandPatch): void {
  if (editorState.selectedCommandId === null) {
    return;
  }

  const normalizedPatch = normalizeCommandPatch(patch);
  recordHistoryEntry();

  editorState = {
    ...editorState,
    commands: editorState.commands.map((command) =>
      command.id === editorState.selectedCommandId
        ? {
            ...command,
            ...normalizedPatch,
          }
        : command,
    ),
  };
  syncPresentHistory();
}

export function updateSelectedCommandWave(wave: SoundWave): void {
  updateSelectedCommand({ wave });
}

function normalizeCommandPatch(patch: SoundCommandPatch): SoundCommandPatch {
  const normalizedPatch: SoundCommandPatch = {};

  if (patch.wave !== undefined) {
    normalizedPatch.wave = patch.wave;
  }

  if (patch.frequencyStart !== undefined) {
    normalizedPatch.frequencyStart = Math.max(1, Math.round(patch.frequencyStart));
  }

  if (patch.frequencyEnd !== undefined) {
    normalizedPatch.frequencyEnd = Math.max(1, Math.round(patch.frequencyEnd));
  }

  if (patch.durationMs !== undefined) {
    normalizedPatch.durationMs = Math.max(1, Math.round(patch.durationMs));
  }

  if (patch.volume !== undefined) {
    normalizedPatch.volume = Math.min(100, Math.max(0, Math.round(patch.volume)));
  }

  return normalizedPatch;
}

function recordHistoryEntry(): void {
  historyState = {
    past: [...historyState.past, cloneProject(historyState.present)],
    present: cloneProject(historyState.present),
    future: [],
  };
}

function syncPresentHistory(): void {
  historyState = {
    ...historyState,
    present: getCurrentProject(),
  };
}

function applyProject(project: SoundProject, preferredSelectedCommandId: string | null, selectedPresetId: string | null): void {
  const commands = cloneCommands(project);
  nextCommandNumber = Math.max(commands.length + 1, nextCommandNumber);
  editorState = {
    ...editorState,
    currentProjectId: sanitizeSoundId(project.id),
    commands,
    selectedCommandId: getSaneSelectedCommandId(commands, preferredSelectedCommandId),
    selectedPresetId,
  };
  syncPresentHistory();
}

function getSaneSelectedCommandId(commands: SoundCommand[], preferredSelectedCommandId: string | null): string | null {
  if (preferredSelectedCommandId !== null && commands.some((command) => command.id === preferredSelectedCommandId)) {
    return preferredSelectedCommandId;
  }

  return commands[0]?.id ?? null;
}

function cloneProject(project: SoundProject): SoundProject {
  return {
    id: project.id,
    commands: cloneCommands(project),
  };
}

function cloneCommands(project: SoundProject): SoundCommand[] {
  return project.commands.map((command) => ({ ...command }));
}
