import type { EditorState } from "../state/editorState.js";
import type { MusicEditorState } from "../state/musicEditorState.js";
import type { AppActions, AppMode, AppStatus, ModeSurface, MusicRenderActions, RenderActions } from "./appTypes.js";
import { renderMusicPreview, renderMusicWorkspaceSurface } from "./renderMusicEditor.js";
import { renderAppShell } from "./renderShell.js";
import { renderSfxSurface } from "./renderSfxEditor.js";
import { destroyAnimatorWorkspace, renderAnimatorSurface } from "./animatorView.js";
import { destroySpritesWorkspace, renderSpriteEditorSurface } from "./renderSpriteEditor.js";
import { renderFontEditorSurface } from "./renderFontEditor.js";

export type { AppActions, AppMode, AppStatus, MusicRenderActions, RenderActions };

interface FocusSnapshot {
  field: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

export function renderApp(
  root: HTMLElement,
  mode: AppMode,
  state: EditorState,
  musicState: MusicEditorState,
  status: AppStatus | null,
  actions: AppActions,
): void {
  const focusSnapshot = captureFocus(root);
  const surface = renderModeSurface(mode, state, musicState, actions);
  root.className = `app app-${mode}`;
  root.replaceChildren(
    ...renderAppShell({
      mode,
      status,
      toolbar: surface.assetPanel,
      editorArea: surface.editorArea,
      inspectorPanel: surface.inspectorPanel,
      previewStatusArea: surface.previewStatusArea,
      shellActions: actions.shell,
    }),
  );

  restoreFocus(root, focusSnapshot);
}

function renderModeSurface(
  mode: AppMode,
  state: EditorState,
  musicState: MusicEditorState,
  actions: AppActions,
): ModeSurface {
  if (mode === "music") {
    destroySpritesWorkspace();
    destroyAnimatorWorkspace();
    return {
      ...renderMusicWorkspaceSurface(musicState, actions.music, actions.shell),
      previewStatusArea: renderMusicPreview(musicState, actions.music),
    };
  }

  if (mode === "sprites") {
    destroyAnimatorWorkspace();
    return renderSpriteEditorSurface();
  }

  if (mode === "animator") {
    destroySpritesWorkspace();
    return renderAnimatorSurface();
  }

  if (mode === "font") {
    destroySpritesWorkspace();
    destroyAnimatorWorkspace();
    return renderFontEditorSurface(actions.shell);
  }

  destroySpritesWorkspace();
  destroyAnimatorWorkspace();
  return renderSfxSurface(state, actions.shell);
}

function captureFocus(root: HTMLElement): FocusSnapshot | null {
  const activeElement = document.activeElement;

  if (!(activeElement instanceof HTMLElement) || !root.contains(activeElement)) {
    return null;
  }

  const field = activeElement.dataset.field;

  if (field === undefined) {
    return null;
  }

  const canReadSelection = activeElement instanceof HTMLInputElement && activeElement.type === "text";
  const selectionStart = canReadSelection ? activeElement.selectionStart : null;
  const selectionEnd = canReadSelection ? activeElement.selectionEnd : null;

  return {
    field,
    selectionStart,
    selectionEnd,
  };
}

function restoreFocus(root: HTMLElement, focusSnapshot: FocusSnapshot | null): void {
  if (focusSnapshot === null) {
    return;
  }

  const target = root.querySelector<HTMLElement>(`[data-field="${focusSnapshot.field}"]`);

  if (target === null) {
    return;
  }

  target.focus();

  if (
    target instanceof HTMLInputElement &&
    typeof target.setSelectionRange === "function" &&
    focusSnapshot.selectionStart !== null &&
    focusSnapshot.selectionEnd !== null &&
    target.type === "text"
  ) {
    target.setSelectionRange(focusSnapshot.selectionStart, focusSnapshot.selectionEnd);
  }
}
