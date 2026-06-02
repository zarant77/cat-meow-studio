import { AudioPreview } from "./audio/audioPreview.js";
import { generateMusicSamples } from "./audio/musicGenerator.js";
import { exportMusicJson } from "./export/exportMusicJson.js";
import { exportSpriteJson } from "./export/exportSpriteJson.js";
import { exportSoundJson } from "./export/exportSoundJson.js";
import { importMusicJson } from "./import/importMusicJson.js";
import { importSpriteJson } from "./import/importSpriteJson.js";
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
import { clearAutosavedProject } from "./storage/localAutosave.js";
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
let projectStateSubscription: (() => void) | null = null;
let saveProjectTimeoutId: number | null = null;

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
    showStatus("Local autosave cleared.", "success");
  },
  exportCurrentJson() {
    exportJsonForMode(activeMode);
  },
  importJson() {
    jsonFileInput.click();
  },
  exportAllJson() {
    syncCurrentAssets();
    let exportedCount = 0;

    for (const asset of getProject().assets) {
      if (downloadAssetJson(asset)) {
        exportedCount += 1;
      }
    }

    showStatus(exportedCount === 0 ? "No JSON assets to export." : `Exported ${exportedCount} JSON assets.`, exportedCount === 0 ? "error" : "success");
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
};

function render(): void {
  if (!(app instanceof HTMLElement)) {
    throw new Error("Cat Meow root element was not found");
  }

  renderApp(
    app,
    activeMode,
    getEditorState(),
    getMusicEditorState(),
    status,
    appActions,
  );
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
  scheduleLocalProjectSave();
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
    const importKind = detectJsonAssetKind(text);

    if (importKind === null) {
      showStatus('JSON asset must be a sprite, music, or sfx file.', "error");
      return;
    }

    if (importKind === "music") {
      const musicResult = importMusicJson(text);

      if (!musicResult.ok) {
        showStatus(musicResult.error, "error");
        return;
      }

      replaceCurrentMusicProject(musicResult.project);
      saveCurrentMusicProject();
      preview.stop();
      switchMode("music");
      showStatus(`Imported ${musicResult.project.id}.music.json`, "success");
      render();
      return;
    }

    if (importKind === "sprite") {
      const spriteResult = importSpriteJson(text);

      if (!spriteResult.ok) {
        showStatus(spriteResult.error, "error");
        return;
      }

      replaceSpriteEditorAsset(spriteResult.sprite);
      switchMode("sprites");
      showStatus(`Imported ${spriteResult.sprite.spriteId}.sprite.json`, "success");
      return;
    }

    const soundResult = importSoundJson(text);

    if (!soundResult.ok) {
      showStatus(soundResult.error, "error");
      return;
    }

    replaceCurrentProject(soundResult.project);
    saveCurrentProject();
    switchMode("sfx");
    showStatus(`Imported ${soundResult.project.id}.sfx.json`, "success");
    render();
  } catch {
    showStatus(getImportErrorMessage(), "error");
  }
}

function detectJsonAssetKind(text: string): AssetKind | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if (parsed.version === 1 && Array.isArray(parsed.primitives)) {
    return "sprite";
  }

  if (parsed.type === "music") {
    return "music";
  }

  if (parsed.type === "sfx" || parsed.type === "sound") {
    return "sfx";
  }

  return null;
}

function renderAfterEditorChange(): void {
  saveCurrentProject();
  render();
}

function saveCurrentProject(): void {
  syncCurrentSfxAsset();
}

function renderAfterMusicChange(): void {
  saveCurrentMusicProject();
  render();
}

function saveCurrentMusicProject(): void {
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

function syncSpriteEditorFromSelectedAsset(): void {
  const selectedAsset = getSelectedProjectAssetForMode("sprites");

  if (selectedAsset?.kind === "sprite") {
    replaceSpriteEditorAsset(selectedAsset.sprite);
  }
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

function scheduleLocalProjectSave(): void {
  if (saveProjectTimeoutId !== null) {
    window.clearTimeout(saveProjectTimeoutId);
  }

  saveProjectTimeoutId = window.setTimeout(() => {
    saveProjectTimeoutId = null;
    persistLocalProject();
  }, 250);
}

function boot(): void {
  const savedProject = loadLocalProjectState();

  if (savedProject !== null) {
    replaceProjectState(savedProject.project, savedProject.selectedAssetIds, { emit: false });
    activeMode = savedProject.activeMode;

    const selectedAsset = getSelectedProjectAssetForMode(savedProject.activeMode);

    if (selectedAsset !== null) {
      selectProjectAsset(selectedAsset.kind, selectedAsset.id);
      applyProjectAssetToEditor(selectedAsset);
    }
  } else {
    syncCurrentAssets();
  }

  if (projectStateSubscription === null) {
    projectStateSubscription = subscribeProjectState(scheduleLocalProjectSave);
  }

  persistLocalProject();
  render();
}

function exportJsonForMode(mode: AppMode): void {
  exportJsonForKind(modeToAssetKind(mode));
}

function exportJsonForKind(kind: AssetKind): void {
  syncActiveAsset();
  const asset = getSelectedProjectAssetForMode(kindToMode(kind));

  if (asset === null) {
    showStatus(`No ${kind} asset to export.`, "error");
    return;
  }

  if (!downloadAssetJson(asset)) {
    showStatus(`Could not export ${asset.name}.`, "error");
  }
}

function downloadAssetJson(asset: ProjectAsset): boolean {
  if (asset.kind === "sprite") {
    const source = exportSpriteJson(asset.sprite);

    if (source === null) {
      return false;
    }

    downloadFile(`${asset.sprite.spriteId}.sprite.json`, source, "application/json;charset=utf-8");
    showStatus(`Exported ${asset.sprite.spriteId}.sprite.json`, "success");
    return true;
  }

  if (asset.kind === "music") {
    const source = exportMusicJson(asset.music);

    if (source === null) {
      return false;
    }

    downloadFile(`${asset.music.id}.music.json`, source, "application/json;charset=utf-8");
    showStatus(`Exported ${asset.music.id}.music.json`, "success");
    return true;
  }

  const source = exportSoundJson(asset.sfx);

  if (source === null) {
    return false;
  }

  downloadFile(`${asset.sfx.id}.sfx.json`, source, "application/json;charset=utf-8");
  showStatus(`Exported ${asset.sfx.id}.sfx.json`, "success");
  return true;
}

function kindToMode(kind: AssetKind): AppMode {
  if (kind === "sprite") {
    return "sprites";
  }

  return kind;
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
    actions.exportCurrentJson();
    return;
  }

  if (isCommandShortcut && key === "e") {
    event.preventDefault();
    actions.exportCurrentJson();
    return;
  }

  if (isCommandShortcut && key === "o") {
    event.preventDefault();
    actions.importJson();
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

boot();
