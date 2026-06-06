import { AudioPreview } from "./audio/audioPreview.js";
import { convertMidiToMusicProject, sanitizeMusicId } from "./audio/midiImport.js";
import { generateMusicSamples, getTickSeconds, type MusicPreviewQuality } from "./audio/musicGenerator.js";
import { exportMusicJson } from "./export/exportMusicJson.js";
import { exportFontJson } from "./export/exportFontJson.js";
import { exportSpriteJson } from "./export/exportSpriteJson.js";
import { exportSoundJson } from "./export/exportSoundJson.js";
import { importAnimationJson } from "./animation/animationJson.js";
import { importMusicJson } from "./import/importMusicJson.js";
import { importFontJson } from "./import/importFontJson.js";
import { importSpriteJson } from "./import/importSpriteJson.js";
import { importSoundJson } from "./import/importSoundJson.js";
import type { AssetKind, ProjectAsset } from "./model/assets.js";
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
  updateMusicNote,
  updateMusicProject,
  updateSelectedMusicInstrument,
} from "./state/musicEditorState.js";
import { renderApp, type AppActions, type AppMode, type AppStatus, type MusicRenderActions, type RenderActions } from "./ui/renderApp.js";
import {
  exportCurrentAnimatorJson,
  getCurrentAnimatorJson,
  replaceAnimatorAnimation,
  stopAnimatorPlayback,
  toggleAnimatorPlayback,
} from "./ui/animatorView.js";
import {
  canRedoSpriteEditor,
  canUndoSpriteEditor,
  createNewSpriteEditorAsset,
  getCurrentSpriteEditorAsset,
  handleSpriteEditorKeyboardShortcut,
  replaceSpriteEditorAsset,
  redoSpriteEditor,
  syncSpriteEditorAsset,
  undoSpriteEditor,
} from "./ui/renderSpriteEditor.js";
import {
  canRedoFontEditor,
  canUndoFontEditor,
  createNewFont,
  getCurrentFont,
  handleFontEditorKeyboardShortcut,
  redoFontEditor,
  replaceCurrentFont,
  setFontEditorChangeListener,
  undoFontEditor,
} from "./ui/renderFontEditor.js";
import {
  findProjectAsset,
  getFirstProjectAsset,
  getProject,
  getSelectedProjectAssetId,
  resetProjectState,
  upsertCurrentProjectAsset,
} from "./state/projectState.js";
import { downloadFile } from "./utils/downloadFile.js";
import { readTextFile } from "./utils/readTextFile.js";

const app = document.querySelector<HTMLElement>("#app");

if (app === null) {
  throw new Error("Cat Meow app root was not found.");
}

const preview = new AudioPreview();
let musicPlaybackState: MusicPlaybackState | null = null;
let musicPreviewState: MusicPreviewState = {
  samples: new Float32Array(0),
  dirty: true,
  isRendering: false,
  quality: "fast",
  debounceId: null,
};
let musicPreviewRenderVersion = 0;
const jsonFileInput = createJsonFileInput();
let activeMode: AppMode = getModeFromLocationHash() ?? "sprites";
let status: AppStatus | null = null;
let statusTimeoutId: number | null = null;
let isSyncingHash = false;
const savedModeSnapshots = new Map<AppMode, string>();
const legacyProjectStorageKeys = [
  "cat-meow-studio:project",
  "cat-meow:sound-project",
  "cat-meow:sfx-project",
  "cat-meow:music-project",
  "cat-meow:active-mode",
] as const;

const actions: RenderActions = {
  undo() {
    if (activeMode === "font") {
      if (undoFontEditor()) {
        render();
      }
      return;
    }
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
    if (activeMode === "font") {
      if (redoFontEditor()) {
        render();
      }
      return;
    }
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
    if (activeMode === "font") {
      return canUndoFontEditor();
    }

    if (activeMode === "animator") {
      return false;
    }

    if (activeMode === "music") {
      return canUndoMusic();
    }

    if (activeMode === "sfx") {
      return canUndo();
    }

    return canUndoSpriteEditor();
  },
  canRedo() {
    if (activeMode === "font") {
      return canRedoFontEditor();
    }

    if (activeMode === "animator") {
      return false;
    }

    if (activeMode === "music") {
      return canRedoMusic();
    }

    if (activeMode === "sfx") {
      return canRedo();
    }

    return canRedoSpriteEditor();
  },
  playSound() {
    if (activeMode === "animator") {
      toggleAnimatorPlayback();
      return;
    }

    if (activeMode === "music") {
      if (musicPlaybackState?.isPlaying) {
        pauseMusicPlayback();
        return;
      }

      playMusicProject(false);
      return;
    }

    if (preview.isPlaying()) {
      preview.stop();
      return;
    }

    if (activeMode === "sfx") {
      preview.play(getCurrentProject());
    }
  },
  playMusicLoop() {
    playMusicProject(true);
  },
  goToCurrentMusicPosition() {
    goToCurrentMusicPosition();
  },
  stopSound() {
    if (activeMode === "animator") {
      stopAnimatorPlayback();
      return;
    }

    stopMusicPlayback();
    preview.stop();
  },
  toggleFullscreen() {
    void toggleFullscreen();
  },
  createNewProject() {
    if (activeMode === "font") {
      createNewFont();
      markCurrentModeSaved();
      return;
    }
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
  openMode(mode) {
    if (hasUnsavedChanges() && !window.confirm("You have unsaved changes. Continue without exporting them?")) {
      return;
    }

    createFreshSceneForMode(mode);
  },
  clearSavedProject() {
    if (!window.confirm("Clear old local Cat Meow Studio browser storage? The current session will stay open.")) {
      return;
    }

    clearLegacyProjectStorage();
    showStatus("Old browser storage cleared.", "success");
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
    renderAfterMusicChange(doesMusicProjectPatchAffectAudio(patch));
  },
  selectNote(noteId) {
    if (getMusicEditorState().selectedNoteId === noteId) {
      return;
    }

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
  updateNote(noteId, patch) {
    updateMusicNote(noteId, patch);
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

function playMusicProject(loopOnly: boolean): void {
  const project = getCurrentMusicProject();
  const tickSeconds = getTickSeconds(project);
  const loop = project.loop;
  const shouldLoop = loop.enabled || loopOnly;
  const pausedTick = musicPlaybackState?.isPlaying === false ? musicPlaybackState.pausedTick : null;
  const startOffsetTick = getMusicPlaybackStartTick(pausedTick ?? (loopOnly ? loop.startTick : 0), shouldLoop, loop.startTick, loop.endTick, project.lengthTicks);
  const loopStartSeconds = loop.startTick * tickSeconds;
  const loopEndSeconds = loop.endTick * tickSeconds;

  stopMusicPlayback();
  getMusicPreviewSamplesForPlay((samples) => {
    preview.playSamples(samples, {
      loop: shouldLoop,
      loopStartSeconds,
      loopEndSeconds,
      startOffsetSeconds: startOffsetTick * tickSeconds,
    });
    startMusicPlayback({
      startedAtMs: performance.now(),
      startOffsetTick,
      tickSeconds,
      loop: shouldLoop,
      loopStartTick: loop.startTick,
      loopEndTick: loop.endTick,
      playingNoteIds: [],
      isPlaying: true,
      pausedTick: startOffsetTick,
    });
  });
}

interface MusicPreviewState {
  samples: Float32Array;
  dirty: boolean;
  isRendering: boolean;
  quality: MusicPreviewQuality;
  debounceId: number | null;
}

function markMusicPreviewDirty(scheduleRender = activeMode === "music"): void {
  musicPreviewRenderVersion += 1;
  musicPreviewState = {
    ...musicPreviewState,
    dirty: true,
  };

  if (musicPreviewState.debounceId !== null) {
    window.clearTimeout(musicPreviewState.debounceId);
  }

  if (scheduleRender) {
    scheduleMusicPreviewRender("fast", 220);
  }
}

function scheduleMusicPreviewRender(quality: MusicPreviewQuality, delayMs: number): void {
  const renderVersion = musicPreviewRenderVersion;

  if (musicPreviewState.debounceId !== null) {
    window.clearTimeout(musicPreviewState.debounceId);
  }

  musicPreviewState = {
    ...musicPreviewState,
    debounceId: window.setTimeout(() => {
      musicPreviewState = {
        ...musicPreviewState,
        debounceId: null,
      };
      renderMusicPreviewSamples(quality, renderVersion);
    }, delayMs),
  };
}

function getMusicPreviewSamplesForPlay(onReady: (samples: Float32Array) => void): void {
  if (!musicPreviewState.dirty && musicPreviewState.quality === "rich" && musicPreviewState.samples.length > 0) {
    onReady(musicPreviewState.samples);
    return;
  }

  if (musicPreviewState.debounceId !== null) {
    window.clearTimeout(musicPreviewState.debounceId);
  }

  const renderVersion = ++musicPreviewRenderVersion;
  musicPreviewState = {
    ...musicPreviewState,
    debounceId: null,
    dirty: true,
    isRendering: true,
    quality: "rich",
  };
  render();

  window.setTimeout(() => {
    const samples = renderMusicPreviewSamples("rich", renderVersion);

    if (samples !== null) {
      onReady(samples);
    }
  }, 0);
}

function renderMusicPreviewSamples(quality: MusicPreviewQuality, renderVersion: number): Float32Array | null {
  const project = getCurrentMusicProject();
  const startedAt = performance.now();
  musicPreviewState = {
    ...musicPreviewState,
    isRendering: true,
    quality,
  };

  const samples = generateMusicSamples(project, { quality });
  const elapsedMs = performance.now() - startedAt;

  if (renderVersion !== musicPreviewRenderVersion) {
    musicPreviewState = {
      ...musicPreviewState,
      dirty: true,
      isRendering: false,
    };
    if (activeMode === "music") {
      render();
    }
    return null;
  }

  musicPreviewState = {
    ...musicPreviewState,
    samples,
    dirty: false,
    isRendering: false,
    quality,
  };
  logMusicPreviewRender(project.notes.length, samples.length, quality, elapsedMs);

  if (activeMode === "music") {
    render();
  }

  return samples;
}

function logMusicPreviewRender(noteCount: number, sampleCount: number, quality: MusicPreviewQuality, elapsedMs: number): void {
  if (!isDevelopmentHost()) {
    return;
  }

  console.info(
    `Music preview render: ${Math.round(elapsedMs)} ms, notes: ${noteCount}, samples: ${sampleCount}, quality: ${quality}`,
  );
}

function isDevelopmentHost(): boolean {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

interface MusicPlaybackState {
  startedAtMs: number;
  startOffsetTick: number;
  tickSeconds: number;
  loop: boolean;
  loopStartTick: number;
  loopEndTick: number;
  playingNoteIds: string[];
  isPlaying: boolean;
  pausedTick: number;
}

function startMusicPlayback(playbackState: MusicPlaybackState): void {
  musicPlaybackState = playbackState;
  render();
}

function pauseMusicPlayback(): void {
  const playbackState = musicPlaybackState;

  if (playbackState === null || !playbackState.isPlaying) {
    return;
  }

  const project = getCurrentMusicProject();
  const currentTick = getCurrentMusicPlaybackTick(playbackState, project.lengthTicks) ?? playbackState.startOffsetTick;

  playbackState.isPlaying = false;
  playbackState.pausedTick = currentTick;
  playbackState.playingNoteIds = [];
  preview.stop();

  if (activeMode === "music") {
    render();
  }
}

function stopMusicPlayback(): void {
  const playbackState = musicPlaybackState;

  const shouldRender = playbackState !== null;
  musicPlaybackState = null;

  if (shouldRender && activeMode === "music") {
    render();
  }
}

function goToCurrentMusicPosition(): void {
  const playbackState = musicPlaybackState;

  if (playbackState === null) {
    return;
  }

  const project = getCurrentMusicProject();
  const currentTick = playbackState.isPlaying
    ? getCurrentMusicPlaybackTick(playbackState, project.lengthTicks)
    : playbackState.pausedTick;

  if (currentTick === null) {
    return;
  }

  playbackState.playingNoteIds = getMusicNoteIdsAtTick(currentTick);

  if (activeMode === "music") {
    render();
    window.requestAnimationFrame(scrollCurrentMusicPositionIntoView);
  }
}

function getCurrentMusicPlaybackTick(playbackState: MusicPlaybackState, lengthTicks: number): number | null {
  const elapsedSeconds = Math.max(0, (performance.now() - playbackState.startedAtMs) / 1000);
  let tick = playbackState.startOffsetTick + elapsedSeconds / playbackState.tickSeconds;

  if (playbackState.loop && tick >= playbackState.loopEndTick) {
    const loopLength = Math.max(1, playbackState.loopEndTick - playbackState.loopStartTick);
    tick = playbackState.loopStartTick + ((tick - playbackState.loopStartTick) % loopLength);
  }

  if (!playbackState.loop && tick >= lengthTicks) {
    return null;
  }

  return Math.max(0, Math.min(Math.max(0, lengthTicks - 1), tick));
}

function getMusicPlaybackStartTick(tick: number, loop: boolean, loopStartTick: number, loopEndTick: number, lengthTicks: number): number {
  if (loop) {
    const loopLength = Math.max(1, loopEndTick - loopStartTick);

    if (tick < loopStartTick || tick >= loopEndTick) {
      return loopStartTick + ((((tick - loopStartTick) % loopLength) + loopLength) % loopLength);
    }

    return tick;
  }

  return Math.max(0, Math.min(Math.max(0, lengthTicks - 1), tick));
}

function getMusicNoteIdsAtTick(tick: number): string[] {
  return getCurrentMusicProject().notes
    .filter((note) => tick >= note.startTick && tick < note.startTick + note.durationTicks)
    .map((note) => note.id);
}

const appActions: AppActions = {
  shell: actions,
  music: musicActions,
};

setFontEditorChangeListener(render);

function render(): void {
  if (!(app instanceof HTMLElement)) {
    throw new Error("Cat Meow root element was not found");
  }

  const musicState = getMusicEditorState();

  renderApp(
    app,
    activeMode,
    getEditorState(),
    {
      ...musicState,
      playingNoteIds: musicPlaybackState?.playingNoteIds ?? [],
      isPreviewPlaying: musicPlaybackState?.isPlaying ?? false,
      isPreviewRendering: musicPreviewState.isRendering,
      previewQuality: musicPreviewState.quality,
      previewSamples: musicPreviewState.samples,
    },
    status,
    appActions,
  );

}

function scrollCurrentMusicPositionIntoView(): void {
  const timelineNote = app?.querySelector<HTMLElement>(".music-timeline-note.is-playing");
  const trackerCell = app?.querySelector<HTMLElement>(".tracker-inline-input.is-playing");

  timelineNote?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  trackerCell?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

function createFreshSceneForMode(mode: AppMode): void {
  if (mode === "font") {
    createNewFont();
    switchMode("font");
    markCurrentModeSaved();
    return;
  }
  if (mode === "animator") {
    switchMode("animator");
    ensureCurrentModeSnapshot();
    return;
  }

  if (mode === "sprites") {
    createNewSpriteEditorAsset("sprite");
    switchMode("sprites");
    markCurrentModeSaved();
    return;
  }

  if (mode === "music") {
    createNewMusicProject();
    updateMusicProject({ id: "music" });
    markMusicPreviewDirty();
    switchMode("music");
    render();
    markCurrentModeSaved();
    return;
  }

  createBlankProject();
  updateProjectId("sound");
  switchMode("sfx");
  markCurrentModeSaved();
}

function switchMode(mode: AppMode): void {
  activeMode = mode;
  stopMusicPlayback();
  preview.stop();
  syncHashForMode(mode);
  render();
  if (mode === "music" && musicPreviewState.dirty) {
    scheduleMusicPreviewRender("fast", 220);
  }
}

function createJsonFileInput(): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json,.mid,.midi,audio/midi,audio/x-midi";
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

  const isMidiImport = isMidiFile(file);

  try {
    if (isMidiImport) {
      await importMidiFileIntoEditor(file);
      return;
    }

    const text = await readTextFile(file);

    if (activeMode === "animator") {
      importJsonForAnimator(text);
      return;
    }

    const importKind = detectJsonAssetKind(text);

    if (importKind === null) {
      showStatus('JSON asset must be a sprite, animation, font, music, or sfx file.', "error");
      return;
    }

    if (importKind === "font") {
      const fontResult = importFontJson(text);

      if (!fontResult.ok) {
        showStatus(fontResult.error, "error");
        return;
      }

      replaceCurrentFont(fontResult.font);
      switchMode("font");
      showStatus(`Imported ${fontResult.font.id}.font.json`, "success");
      markCurrentModeSaved();
      return;
    }

    if (importKind === "music") {
      const musicResult = importMusicJson(text);

      if (!musicResult.ok) {
        showStatus(musicResult.error, "error");
        return;
      }

      replaceCurrentMusicProject(musicResult.project);
      markMusicPreviewDirty();
      saveCurrentMusicProject();
      preview.stop();
      switchMode("music");
      showStatus(`Imported ${musicResult.project.id}.music.json`, "success");
      render();
      markCurrentModeSaved();
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
      markCurrentModeSaved();
      return;
    }

    if (importKind === "animation") {
      const animationResult = importAnimationJson(text);

      if (!animationResult.ok) {
        showStatus(animationResult.error, "error");
        return;
      }

      replaceAnimatorAnimation(animationResult.animationFile);
      switchMode("animator");
      showStatus(`Imported ${animationResult.animationFile.id}.anim.json`, "success");
      markCurrentModeSaved();
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
    markCurrentModeSaved();
  } catch {
    showStatus(isMidiImport ? "Could not import this MIDI file." : getImportErrorMessage(), "error");
  }
}

async function importMidiFileIntoEditor(file: File): Promise<void> {
  const buffer = await file.arrayBuffer();
  const project = convertMidiToMusicProject(buffer, file.name, {
    musicId: sanitizeMusicId(file.name.replace(/\.(midi?)$/i, "")),
    lengthTicks: "auto",
    quantizeGrid: 1,
    transpose: 0,
  });

  replaceCurrentMusicProject(project);
  markMusicPreviewDirty();
  saveCurrentMusicProject();
  preview.stop();
  switchMode("music");
  showStatus(`Imported ${project.id} from MIDI`, "success");
  markCurrentModeSaved();
}

function isMidiFile(file: File): boolean {
  return /\.(midi?)$/i.test(file.name) || file.type === "audio/midi" || file.type === "audio/x-midi";
}

function detectJsonAssetKind(text: string): AssetKind | "animation" | "font" | null {
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

  if (parsed.version === 1 && (Array.isArray(parsed.tracks) || Array.isArray(parsed.animations))) {
    return "animation";
  }

  if (parsed.type === "music") {
    return "music";
  }

  if (parsed.type === "vector" && parsed.gridSize === 16 && Array.isArray(parsed.glyphs)) {
    return "font";
  }

  if (parsed.type === "sfx" || parsed.type === "sound") {
    return "sfx";
  }

  return null;
}

function importJsonForAnimator(text: string): void {
  const importKind = detectJsonAssetKind(text);

  if (importKind === "animation") {
    const animationResult = importAnimationJson(text);

    if (!animationResult.ok) {
      showStatus(animationResult.error, "error");
      return;
    }

    replaceAnimatorAnimation(animationResult.animationFile);
    switchMode("animator");
    showStatus(`Imported ${animationResult.animationFile.id}.anim.json`, "success");
    markCurrentModeSaved();
    return;
  }

  showStatus("Top import in Animator expects animation JSON. Use the left toolbar to import a sprite preview.", "error");
}

function renderAfterEditorChange(): void {
  saveCurrentProject();
  render();
}

function saveCurrentProject(): void {
  syncCurrentSfxAsset();
}

function renderAfterMusicChange(markPreviewDirty = true): void {
  if (markPreviewDirty) {
    markMusicPreviewDirty();
  }
  saveCurrentMusicProject();
  render();
}

function doesMusicProjectPatchAffectAudio(patch: Parameters<MusicRenderActions["updateProject"]>[0]): boolean {
  return patch.bpm !== undefined || patch.ticksPerBeat !== undefined || patch.lengthTicks !== undefined || patch.loop !== undefined;
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
  if (activeMode === "font") {
    return;
  }
  if (activeMode === "music") {
    syncCurrentMusicAsset();
    return;
  }

  if (activeMode === "sprites") {
    syncSpriteEditorAsset();
    return;
  }

  if (activeMode === "animator") {
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

function modeToAssetKind(mode: AppMode): AssetKind {
  if (mode === "sprites") {
    return "sprite";
  }

  if (mode === "animator") {
    return "sprite";
  }

  if (mode === "font") {
    return "sprite";
  }

  return mode;
}

function getModeFromLocationHash(): AppMode | null {
  return routeToMode(window.location.hash.replace(/^#/, ""));
}

function routeToMode(route: string): AppMode | null {
  if (route === "sprite" || route === "sprites") {
    return "sprites";
  }

  if (route === "animator") {
    return "animator";
  }

  if (route === "music") {
    return "music";
  }

  if (route === "sfx") {
    return "sfx";
  }

  if (route === "font" || route === "fonts") {
    return "font";
  }

  return null;
}

function modeToHashRoute(mode: AppMode): string {
  if (mode === "sprites") {
    return "sprite";
  }

  return mode;
}

function syncHashForMode(mode: AppMode): void {
  const route = modeToHashRoute(mode);

  if (window.location.hash.replace(/^#/, "") === route) {
    return;
  }

  isSyncingHash = true;
  window.location.hash = route;
  window.setTimeout(() => {
    isSyncingHash = false;
  }, 0);
}

function boot(): void {
  clearLegacyProjectStorage();
  resetProjectState({ emit: false });
  syncHashForMode(activeMode);
  render();
  if (activeMode === "music") {
    scheduleMusicPreviewRender("fast", 220);
  }
  markCurrentModeSaved();
}

function exportJsonForMode(mode: AppMode): void {
  if (mode === "font") {
    const currentFont = getCurrentFont();
    const source = exportFontJson(currentFont);

    if (source === null) {
      showStatus("Font validation failed. Fix invalid metadata or glyph data before exporting.", "error");
      return;
    }

    downloadFile(`${currentFont.id}.font.json`, source, "application/json;charset=utf-8");
    markCurrentModeSaved();
    showStatus(`Exported ${currentFont.id}.font.json`, "success");
    return;
  }
  if (mode === "animator") {
    if (exportCurrentAnimatorJson()) {
      markCurrentModeSaved();
      showStatus("Exported animation JSON.", "success");
    }
    return;
  }

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
    return;
  }

  markCurrentModeSaved();
}

function hasUnsavedChanges(): boolean {
  const savedSnapshot = savedModeSnapshots.get(activeMode);
  return savedSnapshot !== undefined && savedSnapshot !== getModeSnapshot(activeMode);
}

function markCurrentModeSaved(): void {
  savedModeSnapshots.set(activeMode, getModeSnapshot(activeMode));
}

function ensureCurrentModeSnapshot(): void {
  if (!savedModeSnapshots.has(activeMode)) {
    markCurrentModeSaved();
  }
}

function getModeSnapshot(mode: AppMode): string {
  if (mode === "sprites") {
    return JSON.stringify(getCurrentSpriteEditorAsset());
  }

  if (mode === "animator") {
    return getCurrentAnimatorJson();
  }

  if (mode === "music") {
    return JSON.stringify(getCurrentMusicProject());
  }

  if (mode === "font") {
    return JSON.stringify(getCurrentFont());
  }

  return JSON.stringify(getCurrentProject());
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

function clearLegacyProjectStorage(): void {
  try {
    for (const key of legacyProjectStorageKeys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    return;
  }
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

  if (activeMode === "font" && !isTextEntryTarget(event.target) && handleFontEditorKeyboardShortcut(event)) {
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
  if (activeMode === "font") {
    return "The font file could not be imported.";
  }
  if (activeMode === "music") {
    return "The music file could not be imported.";
  }

  if (activeMode === "sprites") {
    return "The sprite file could not be imported.";
  }

  if (activeMode === "animator") {
    return "The animator JSON file could not be imported.";
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

window.addEventListener("hashchange", () => {
  if (isSyncingHash) {
    return;
  }

  const mode = getModeFromLocationHash() ?? "sprites";

  if (mode === activeMode) {
    return;
  }

  activeMode = mode;
  preview.stop();
  render();
  if (mode === "music" && musicPreviewState.dirty) {
    scheduleMusicPreviewRender("fast", 220);
  }
  ensureCurrentModeSnapshot();
});

document.addEventListener("keydown", handleKeyboardShortcut);

boot();
