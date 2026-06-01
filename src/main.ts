import { AudioPreview } from "./audio/audioPreview.js";
import { generateMusicSamples } from "./audio/musicGenerator.js";
import {
  exportProjectC,
  exportProjectMusicC,
  exportProjectSfxC,
  exportProjectSpritesC,
  type GeneratedCFile,
} from "./export/exportProjectC.js";
import { exportMusicJson } from "./export/exportMusicJson.js";
import { exportSoundJson } from "./export/exportSoundJson.js";
import { getSoundExportReadiness } from "./export/soundReadiness.js";
import { importMusicJson } from "./import/importMusicJson.js";
import { importSoundJson } from "./import/importSoundJson.js";
import type { AssetId, AssetKind, ProjectAsset } from "./model/assets.js";
import { createMusicProjectAsset, createSfxProjectAsset } from "./model/assetAdapters.js";
import {
  addCommand,
  createNewProject as createBlankProject,
  createProjectFromPreset,
  canRedo,
  canUndo,
  deleteCommand,
  deleteSelectedCommand,
  duplicateSelectedCommand,
  getCurrentProject,
  getEditorState,
  moveCommand,
  replaceCurrentProject,
  resetSelectedCommandToDefaults,
  resetProjectToSelectedPreset,
  redo as redoEditor,
  selectCommand,
  undo as undoEditor,
  updateProjectId,
  updateSelectedCommand,
} from "./state/editorState.js";
import {
  addMusicInstrument,
  addMusicNote,
  canRedoMusic,
  canUndoMusic,
  createNewMusicProject,
  deleteSelectedMusicInstrument,
  deleteSelectedMusicNote,
  getCurrentMusicProject,
  getMusicEditorState,
  replaceCurrentMusicProject,
  redoMusic,
  selectMusicInstrument,
  selectMusicNote,
  undoMusic,
  updateMusicProject,
  updateSelectedMusicInstrument,
  updateSelectedMusicNote,
} from "./state/musicEditorState.js";
import {
  clearAutosavedProject,
  saveAutosavedActiveMode,
  saveAutosavedMusicProject,
  saveAutosavedProject,
} from "./storage/localAutosave.js";
import { clearLocalProjectState, loadLocalProjectState, saveLocalProjectState } from "./storage/localProjectPersistence.js";
import { renderApp, type AppActions, type AppMode, type AppStatus, type MusicRenderActions, type RenderActions } from "./ui/renderApp.js";
import {
  canRedoSpriteEditor,
  canUndoSpriteEditor,
  createNewSpriteEditorAsset,
  handleSpriteEditorKeyboardShortcut,
  replaceSpriteEditorAsset,
  redoSpriteEditor,
  syncSpriteEditorAsset,
  undoSpriteEditor,
} from "./ui/renderSpriteEditor.js";
import {
  deleteProjectAsset,
  duplicateProjectAsset,
  findProjectAsset,
  getFirstProjectAsset,
  getProject,
  getSelectedAssetIds,
  getSelectedProjectAssetId,
  renameProjectAsset,
  replaceProjectState,
  resetProjectState,
  selectProjectAsset,
  setSelectedProjectAsset,
  subscribeProjectState,
  upsertCurrentProjectAsset,
} from "./state/projectState.js";
import { getAssetExplorerItems } from "./state/assetExplorerState.js";
import { downloadFile } from "./utils/downloadFile.js";
import { readTextFile } from "./utils/readTextFile.js";

const app = document.querySelector<HTMLElement>("#app");

if (app === null) {
  throw new Error("Cat Meow app root was not found.");
}

const preview = new AudioPreview();
const jsonFileInput = createJsonFileInput();
let activeMode: AppMode = "sfx";
let status: AppStatus | null = null;
let statusTimeoutId: number | null = null;
initializeLocalProject();
subscribeProjectState(() => persistLocalProject());
persistLocalProject();

const actions: RenderActions = {
  undo() {
    if (activeMode === "music" && undoMusic()) {
      saveCurrentMusicProject();
      render();
      return;
    }

    if (activeMode === "sprites") {
      undoSpriteEditor();
      return;
    }

    if (activeMode === "sfx" && undoEditor()) {
      saveCurrentProject();
      render();
    }
  },
  redo() {
    if (activeMode === "music" && redoMusic()) {
      saveCurrentMusicProject();
      render();
      return;
    }

    if (activeMode === "sprites") {
      redoSpriteEditor();
      return;
    }

    if (activeMode === "sfx" && redoEditor()) {
      saveCurrentProject();
      render();
    }
  },
  canUndo() {
    if (activeMode === "music") {
      return canUndoMusic();
    }

    if (activeMode === "sfx") {
      return canUndo();
    }

    return canUndoSpriteEditor();
  },
  canRedo() {
    if (activeMode === "music") {
      return canRedoMusic();
    }

    if (activeMode === "sfx") {
      return canRedo();
    }

    return canRedoSpriteEditor();
  },
  playSound() {
    if (preview.isPlaying()) {
      preview.stop();
      return;
    }

    if (activeMode === "music") {
      preview.playSamples(generateMusicSamples(getCurrentMusicProject()), true);
      return;
    }

    if (activeMode === "sfx") {
      preview.play(getCurrentProject());
    }
  },
  stopSound() {
    preview.stop();
  },
  toggleFullscreen() {
    void toggleFullscreen();
  },
  createNewProject() {
    if (activeMode === "music") {
      createNewMusicProject();
      renderAfterMusicChange();
      return;
    }

    if (activeMode === "sfx") {
      createBlankProject();
      saveCurrentProject();
      render();
    }
  },
  clearSavedProject() {
    if (!window.confirm("Clear the saved local Cat Meow Studio project? The current session will stay open.")) {
      return;
    }

    clearAutosavedProject();
    clearLocalProjectState();
    showStatus("Local project save cleared.", "success");
  },
  exportSoundJson() {
    if (activeMode === "music") {
      const project = getCurrentMusicProject();
      const source = exportMusicJson(project);

      if (source === null) {
        showStatus("Enter a valid music id before exporting JSON.", "error");
        return;
      }

      downloadFile(`${project.id}.music.json`, source, "application/json;charset=utf-8");
      showStatus(`Exported ${project.id}.music.json`, "success");
      return;
    }

    if (activeMode === "sprites") {
      showStatus("Sprite mode is a placeholder for now.", "error");
      return;
    }

    const project = getCurrentProject();
    const source = exportSoundJson(project);

    if (source === null) {
      showStatus("Enter a valid sound id before exporting JSON.", "error");
      return;
    }

    downloadFile(`${project.id}.sound.json`, source, "application/json;charset=utf-8");
    showStatus(`Exported ${project.id}.sound.json`, "success");
  },
  importSoundJson() {
    if (activeMode === "sprites") {
      showStatus("Sprite mode import is not implemented yet.", "error");
      return;
    }

    jsonFileInput.click();
  },
  exportSoundC() {
    syncActiveAsset();

    if (activeMode === "music") {
      const files = exportProjectMusicC(getProject());
      downloadGeneratedCFiles(files, "No music assets to export.", "Exported music C sources.");
      return;
    }

    if (activeMode === "sprites") {
      const file = exportProjectSpritesC(getProject());

      if (file === null) {
        showStatus("No sprite assets to export.", "error");
        return;
      }

      downloadGeneratedCFiles([file], "No sprite assets to export.", `Exported ${file.fileName}`);
      return;
    }

    const sfxError = getSfxExportError();

    if (sfxError !== null) {
      showStatus(sfxError, "error");
      return;
    }

    const files = exportProjectSfxC(getProject());
    downloadGeneratedCFiles(files, "No SFX assets to export.", "Exported SFX C sources.");
  },
  exportAllC() {
    syncActiveAsset();

    const sfxError = getSfxExportError();

    if (sfxError !== null) {
      showStatus(sfxError, "error");
      return;
    }

    downloadGeneratedCFiles(exportProjectC(getProject()), "No project assets to export.", "Exported all C sources.");
  },
  createFromPreset(presetId) {
    createProjectFromPreset(presetId);
    renderAfterEditorChange();
  },
  resetToPreset() {
    resetProjectToSelectedPreset();
    renderAfterEditorChange();
  },
  selectCommand(commandId) {
    selectCommand(commandId);
    render();
  },
  addCommand() {
    if (activeMode === "music") {
      addMusicNote();
      renderAfterMusicChange();
      return;
    }

    if (activeMode === "sfx") {
      addCommand();
      renderAfterEditorChange();
    }
  },
  duplicateCommand(commandId) {
    duplicateSelectedCommand(commandId);
    renderAfterEditorChange();
  },
  resetSelectedCommand() {
    resetSelectedCommandToDefaults();
    renderAfterEditorChange();
  },
  deleteCommand(commandId) {
    deleteCommand(commandId);
    renderAfterEditorChange();
  },
  moveCommand(commandId, direction) {
    moveCommand(commandId, direction);
    renderAfterEditorChange();
  },
  updateSelectedCommand(patch) {
    updateSelectedCommand(patch);
    renderAfterEditorChange();
  },
  updateProjectId(projectId) {
    updateProjectId(projectId);
    renderAfterEditorChange();
  },
};

const musicActions: MusicRenderActions = {
  updateProject(patch) {
    updateMusicProject(patch);
    renderAfterMusicChange();
  },
  selectNote(noteId) {
    selectMusicNote(noteId);
    render();
  },
  addNote() {
    addMusicNote();
    renderAfterMusicChange();
  },
  deleteNote() {
    deleteSelectedMusicNote();
    renderAfterMusicChange();
  },
  updateNote(patch) {
    updateSelectedMusicNote(patch);
    renderAfterMusicChange();
  },
  selectInstrument(index) {
    selectMusicInstrument(index);
    render();
  },
  addInstrument() {
    addMusicInstrument();
    renderAfterMusicChange();
  },
  deleteInstrument() {
    deleteSelectedMusicInstrument();
    renderAfterMusicChange();
  },
  updateInstrument(patch) {
    updateSelectedMusicInstrument(patch);
    renderAfterMusicChange();
  },
};

const appActions: AppActions = {
  shell: actions,
  music: musicActions,
  assets: {
    createAsset(kind) {
      createAsset(kind);
    },
    selectAsset(kind, id) {
      selectAsset(kind, id);
    },
    renameAsset(kind, id, name) {
      renameAsset(kind, id, name);
    },
    duplicateAsset(kind, id) {
      duplicateAsset(kind, id);
    },
    deleteAsset(kind, id) {
      deleteAsset(kind, id);
    },
  },
  setMode(mode) {
    switchMode(mode);
  },
};

function render(): void {
  if (!(app instanceof HTMLElement)) {
    throw new Error("Cat Meow root element was not found");
  }

  renderApp(app, activeMode, getEditorState(), getMusicEditorState(), status, appActions);
}

function createAsset(kind: AssetKind): void {
  const assetId = createUniqueAssetId(kind);

  if (kind === "sprite") {
    setSelectedProjectAsset("sprite", assetId);
    createNewSpriteEditorAsset(assetId);
    switchMode("sprites");
    return;
  }

  if (kind === "music") {
    setSelectedProjectAsset("music", assetId);
    createNewMusicProject();
    updateMusicProject({ id: assetId });
    renderAfterMusicChange();
    switchMode("music");
    return;
  }

  setSelectedProjectAsset("sfx", assetId);
  createBlankProject();
  updateProjectId(assetId);
  saveCurrentProject();
  switchMode("sfx");
}

function selectAsset(kind: AssetKind, id: AssetId): void {
  const asset = selectProjectAsset(kind, id);

  if (asset === null) {
    return;
  }

  loadProjectAsset(asset);
}

function renameAsset(kind: AssetKind, id: AssetId, name: string): void {
  const wasSelected = getSelectedProjectAssetId(kind) === id;
  const renamedAsset = renameProjectAsset(kind, id, name);

  if (renamedAsset === null) {
    return;
  }

  if (wasSelected) {
    loadProjectAsset(renamedAsset);
    return;
  }

  render();
}

function duplicateAsset(kind: AssetKind, id: AssetId): void {
  const duplicatedAsset = duplicateProjectAsset(kind, id);

  if (duplicatedAsset === null) {
    return;
  }

  loadProjectAsset(duplicatedAsset);
}

function deleteAsset(kind: AssetKind, id: AssetId): void {
  const asset = findProjectAsset(kind, id);

  if (asset === null || !window.confirm(`Delete ${asset.name}?`)) {
    return;
  }

  const wasSelected = getSelectedProjectAssetId(kind) === id;
  deleteProjectAsset(kind, id);

  if (!wasSelected) {
    render();
    return;
  }

  const fallbackAsset = getFirstProjectAsset(kind);

  if (fallbackAsset !== null) {
    loadProjectAsset(fallbackAsset);
    return;
  }

  createAsset(kind);
}

function loadProjectAsset(asset: ProjectAsset): void {
  selectProjectAsset(asset.kind, asset.id);
  applyProjectAssetToEditor(asset);

  if (asset.kind === "sprite") {
    switchMode("sprites");
    return;
  }

  if (asset.kind === "music") {
    saveCurrentMusicProject();
    switchMode("music");
    return;
  }

  saveCurrentProject();
  switchMode("sfx");
}

function switchMode(mode: AppMode): void {
  const selectedAsset = getSelectedProjectAssetForMode(mode);

  if (selectedAsset !== null) {
    applyProjectAssetToEditor(selectedAsset);
  }

  activeMode = mode;
  saveAutosavedActiveMode(mode);
  persistLocalProject();
  preview.stop();
  render();
}

function createUniqueAssetId(kind: AssetKind): AssetId {
  const baseId = getAssetBaseId(kind);
  const existingIds = new Set(getAssetExplorerItems().filter((asset) => asset.kind === kind).map((asset) => asset.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  let candidate = `${baseId}_${suffix}`;

  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${baseId}_${suffix}`;
  }

  return candidate;
}

function getAssetBaseId(kind: AssetKind): AssetId {
  if (kind === "sprite") {
    return "sprite";
  }

  if (kind === "music") {
    return "music";
  }

  return "sound";
}

function createJsonFileInput(): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.style.display = "none";
  input.addEventListener("change", () => {
    void importSelectedJsonFile(input);
  });
  document.body.append(input);

  return input;
}

async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement === null) {
    await document.documentElement.requestFullscreen();
    return;
  }

  await document.exitFullscreen();
}

async function importSelectedJsonFile(input: HTMLInputElement): Promise<void> {
  const file = input.files?.[0] ?? null;
  input.value = "";

  if (file === null) {
    return;
  }

  try {
    const text = await readTextFile(file);

    if (activeMode === "music") {
      const musicResult = importMusicJson(text);

      if (!musicResult.ok) {
        showStatus(musicResult.error, "error");
        return;
      }

      replaceCurrentMusicProject(musicResult.project);
      saveCurrentMusicProject();
      preview.stop();
      showStatus(`Imported ${musicResult.project.id}.music.json`, "success");
      render();
      return;
    }

    if (activeMode === "sprites") {
      showStatus("Sprite mode import is not implemented yet.", "error");
      return;
    }

    const soundResult = importSoundJson(text);

    if (!soundResult.ok) {
      showStatus(soundResult.error, "error");
      return;
    }

    replaceCurrentProject(soundResult.project);
    saveCurrentProject();
    showStatus(`Imported ${soundResult.project.id}.sound.json`, "success");
    render();
  } catch {
    showStatus(getImportErrorMessage(), "error");
  }
}

function renderAfterEditorChange(): void {
  saveCurrentProject();
  render();
}

function saveCurrentProject(): void {
  saveAutosavedProject(getCurrentProject());
  syncCurrentSfxAsset();
}

function renderAfterMusicChange(): void {
  saveCurrentMusicProject();
  render();
}

function saveCurrentMusicProject(): void {
  saveAutosavedMusicProject(getCurrentMusicProject());
  syncCurrentMusicAsset();
}

function syncCurrentAssets(): void {
  syncCurrentSfxAsset();
  syncCurrentMusicAsset();
  syncSpriteEditorAsset();
}

function syncActiveAsset(): void {
  if (activeMode === "music") {
    syncCurrentMusicAsset();
    return;
  }

  if (activeMode === "sprites") {
    syncSpriteEditorAsset();
    return;
  }

  syncCurrentSfxAsset();
}

function syncCurrentSfxAsset(): void {
  upsertCurrentProjectAsset(createSfxProjectAsset(getCurrentProject()));
}

function syncCurrentMusicAsset(): void {
  upsertCurrentProjectAsset(createMusicProjectAsset(getCurrentMusicProject()));
}

function initializeLocalProject(): void {
  const savedProject = loadLocalProjectState();

  if (savedProject === null) {
    resetProjectState({ emit: false });
    syncCurrentAssets();
    return;
  }

  replaceProjectState(savedProject.project, savedProject.selectedAssetIds, { emit: false });
  activeMode = savedProject.activeMode;

  const selectedAsset = getSelectedProjectAssetForMode(savedProject.activeMode);

  if (selectedAsset !== null) {
    selectProjectAsset(selectedAsset.kind, selectedAsset.id);
    applyProjectAssetToEditor(selectedAsset);
  }
}

function getSelectedProjectAssetForMode(mode: AppMode): ProjectAsset | null {
  const kind = modeToAssetKind(mode);
  const selectedAssetId = getSelectedProjectAssetId(kind);

  if (selectedAssetId !== null) {
    const selectedAsset = findProjectAsset(kind, selectedAssetId);

    if (selectedAsset !== null) {
      return selectedAsset;
    }
  }

  return getFirstProjectAsset(kind);
}

function applyProjectAssetToEditor(asset: ProjectAsset): void {
  if (asset.kind === "sprite") {
    replaceSpriteEditorAsset(asset.sprite);
    return;
  }

  if (asset.kind === "music") {
    replaceCurrentMusicProject(asset.music, { recordHistory: false });
    return;
  }

  replaceCurrentProject(asset.sfx, { recordHistory: false });
}

function modeToAssetKind(mode: AppMode): AssetKind {
  if (mode === "sprites") {
    return "sprite";
  }

  return mode;
}

function persistLocalProject(): void {
  saveLocalProjectState({
    project: getProject(),
    selectedAssetIds: getSelectedAssetIds(),
    activeMode,
  });
}

function getSfxExportError(): string | null {
  const sfxAssets = getProject().assets.filter((asset) => asset.kind === "sfx");

  for (const asset of sfxAssets) {
    const readiness = getSoundExportReadiness(asset.sfx);

    if (readiness.status === "error") {
      return `Fix ${asset.name} export errors first: ${readiness.errors.join(", ")}.`;
    }
  }

  return null;
}

function downloadGeneratedCFiles(files: GeneratedCFile[], emptyMessage: string, successMessage: string): void {
  if (files.length === 0) {
    showStatus(emptyMessage, "error");
    return;
  }

  for (const file of files) {
    downloadFile(file.fileName, file.source, "text/x-csrc;charset=utf-8");
  }

  showStatus(successMessage, "success");
}

function showStatus(message: string, tone: AppStatus["tone"]): void {
  status = {
    message,
    tone,
  };

  if (statusTimeoutId !== null) {
    window.clearTimeout(statusTimeoutId);
  }

  statusTimeoutId = window.setTimeout(() => {
    status = null;
    statusTimeoutId = null;
    render();
  }, 2800);

  render();
}

function handleKeyboardShortcut(event: KeyboardEvent): void {
  if (event.defaultPrevented) {
    return;
  }

  if (activeMode === "sprites" && handleSpriteEditorKeyboardShortcut(event)) {
    return;
  }

  if (activeMode === "sprites" && isTextEntryTarget(event.target)) {
    return;
  }

  const isCommandShortcut = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (isCommandShortcut && key === "z") {
    event.preventDefault();

    if (event.shiftKey) {
      actions.redo();
    } else {
      actions.undo();
    }

    return;
  }

  if (isCommandShortcut && key === "y") {
    event.preventDefault();
    actions.redo();
    return;
  }

  if (isCommandShortcut && key === "s") {
    event.preventDefault();
    actions.exportSoundJson();
    return;
  }

  if (isCommandShortcut && key === "e") {
    event.preventDefault();
    actions.exportSoundC();
    return;
  }

  if (isCommandShortcut && key === "o") {
    event.preventDefault();
    actions.importSoundJson();
    return;
  }

  if (isTextEntryTarget(event.target)) {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    actions.playSound();
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();

    if (activeMode === "music") {
      deleteSelectedMusicNote();
      renderAfterMusicChange();
      return;
    }

    if (activeMode === "sfx") {
      deleteSelectedCommand();
      renderAfterEditorChange();
    }
  }
}

function getImportErrorMessage(): string {
  if (activeMode === "music") {
    return "The music file could not be imported.";
  }

  if (activeMode === "sprites") {
    return "The sprite file could not be imported.";
  }

  return "The sound file could not be imported.";
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

document.addEventListener("keydown", handleKeyboardShortcut);

render();
