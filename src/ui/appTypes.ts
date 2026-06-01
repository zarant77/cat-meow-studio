import type { SoundCommandPatch } from "../state/editorState.js";
import type { AssetId, AssetKind } from "../model/assets.js";
import type { MusicInstrumentPatch, MusicNotePatch, MusicProjectPatch } from "../state/musicEditorState.js";

export type AppMode = "music" | "sfx" | "sprites";

export interface RenderActions {
  playSound: () => void;
  stopSound: () => void;
  toggleFullscreen: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  createNewProject: () => void;
  clearSavedProject: () => void;
  exportSoundJson: () => void;
  importSoundJson: () => void;
  exportSoundC: () => void;
  exportAllC: () => void;
  createFromPreset: (presetId: string) => void;
  resetToPreset: () => void;
  selectCommand: (commandId: string) => void;
  addCommand: () => void;
  duplicateCommand: (commandId?: string) => void;
  resetSelectedCommand: () => void;
  deleteCommand: (commandId: string) => void;
  moveCommand: (commandId: string, direction: -1 | 1) => void;
  updateSelectedCommand: (patch: SoundCommandPatch) => void;
  updateProjectId: (projectId: string) => void;
}

export interface MusicRenderActions {
  updateProject: (patch: MusicProjectPatch) => void;
  selectNote: (noteId: string) => void;
  addNote: () => void;
  deleteNote: () => void;
  updateNote: (patch: MusicNotePatch) => void;
  selectInstrument: (index: number) => void;
  addInstrument: () => void;
  deleteInstrument: () => void;
  updateInstrument: (patch: MusicInstrumentPatch) => void;
}

export interface AppActions {
  shell: RenderActions;
  music: MusicRenderActions;
  assets: AssetExplorerActions;
  spritePalette: SpritePaletteActions;
  setMode: (mode: AppMode) => void;
}

export interface AssetExplorerActions {
  createAsset: (kind: AssetKind) => void;
  selectAsset: (kind: AssetKind, id: AssetId) => void;
  renameAsset: (kind: AssetKind, id: AssetId, name: string) => void;
  duplicateAsset: (kind: AssetKind, id: AssetId) => void;
  deleteAsset: (kind: AssetKind, id: AssetId) => void;
}

export interface SpritePaletteActions {
  selectColor: (index: number) => void;
  addColor: () => void;
  renameColor: (index: number, name: string) => void;
  updateColor: (index: number, rgba: string) => void;
  deleteColor: (index: number) => void;
}

export interface AppStatus {
  message: string;
  tone: "success" | "error";
}

export interface ModeSurface {
  assetPanel: HTMLElement;
  editorArea: HTMLElement;
  inspectorPanel: HTMLElement;
  previewStatusArea: HTMLElement;
}
