import { SpriteEditorController } from "../sprites/app/spriteEditorController.js";
import type { SpriteAssetData } from "../model/assets.js";
import { createSpriteProjectAsset } from "../model/assetAdapters.js";
import { upsertCurrentProjectAsset } from "../state/projectState.js";
import type { ModeSurface } from "./appTypes.js";
import { createElement, createField, createTextElement } from "./dom.js";
import { renderAssetSidebarPanel, renderEditorArea, renderInspectorPanel, renderPreviewStatusArea } from "./renderShell.js";

const spriteEditorController = new SpriteEditorController();
spriteEditorController.setAssetChangeListener(syncSpriteEditorAsset);

export function renderSpriteEditorSurface(): ModeSurface {
  const mount = createSpriteMount();

  window.requestAnimationFrame(() => {
    if (mount.canvas.isConnected) {
      spriteEditorController.bind(mount);
    }
  });

  return {
    assetPanel: mount.assetPanel,
    editorArea: mount.editorArea,
    inspectorPanel: mount.inspectorPanel,
    previewStatusArea: mount.previewStatusArea,
  };
}

export function destroySpritesWorkspace(): void {
  spriteEditorController.destroy();
}

function createSpriteMount(): {
  assetPanel: HTMLElement;
  editorArea: HTMLElement;
  inspectorPanel: HTMLElement;
  previewStatusArea: HTMLElement;
  canvas: HTMLCanvasElement;
  primitiveList: HTMLOListElement;
  toolButtons: HTMLButtonElement[];
  spriteIdInput: HTMLInputElement;
  canvasSizeInput: HTMLInputElement;
  pivotXInput: HTMLInputElement;
  pivotYInput: HTMLInputElement;
  colorInput: HTMLInputElement;
  colorHexInput: HTMLInputElement;
  selectionSummary: HTMLElement;
  flipHorizontalButton: HTMLButtonElement;
  flipVerticalButton: HTMLButtonElement;
  sendToBackButton: HTMLButtonElement;
  sendBackwardButton: HTMLButtonElement;
  bringForwardButton: HTMLButtonElement;
  bringToFrontButton: HTMLButtonElement;
  groupButton: HTMLButtonElement;
  ungroupButton: HTMLButtonElement;
  copyPrimitiveButton: HTMLButtonElement;
  pastePrimitiveButton: HTMLButtonElement;
  deletePrimitiveButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  clearDialog: HTMLDialogElement;
  clearCancelButton: HTMLButtonElement;
  clearConfirmButton: HTMLButtonElement;
  statusElement: HTMLElement;
} {
  const assetPanel = renderAssetSidebarPanel("sprites-asset-panel");
  const editorArea = renderEditorArea("sprites-editor-area");
  const inspectorPanel = renderInspectorPanel("sprites-inspector-panel");
  const previewStatusArea = renderPreviewStatusArea("Sprite workspace status");

  const spriteIdInput = createSpriteInput("text");
  spriteIdInput.dataset.field = "spriteId";
  const canvasSizeInput = createSpriteInput("text");
  canvasSizeInput.dataset.field = "spriteCanvasSize";
  const pivotXInput = createSpriteInput("number");
  pivotXInput.dataset.field = "spritePivotX";
  const pivotYInput = createSpriteInput("number");
  pivotYInput.dataset.field = "spritePivotY";
  const colorInput = createSpriteInput("color");
  const colorHexInput = createSpriteInput("text");
  colorHexInput.dataset.field = "spriteColor";

  const toolButtons = [
    createToolButton("rect", "▭", "Rectangle"),
    createToolButton("circle", "○", "Circle"),
    createToolButton("triangle", "△", "Triangle"),
    createToolButton("fill", "▰", "Fill"),
    createToolButton("eyedropper", "⌕", "Pick color"),
    createToolButton("rotate", "↻", "Rotate"),
    createToolButton("scale", "□", "Scale"),
  ];

  const undoButton = createSpriteButton("↶", "Undo");
  const redoButton = createSpriteButton("↷", "Redo");
  const clearButton = createSpriteButton("Clear", "Clear sprite");
  const clearDialog = createClearDialog();
  const clearCancelButton = clearDialog.querySelector<HTMLButtonElement>("[data-clear-cancel]");
  const clearConfirmButton = clearDialog.querySelector<HTMLButtonElement>("[data-clear-confirm]");

  if (clearCancelButton === null || clearConfirmButton === null) {
    throw new Error("Sprite clear dialog controls were not found.");
  }

  const spriteFields = createElement("section", "sprite-tool-section");
  spriteFields.append(
    createTextElement("h2", "Sprite"),
    createField("ID", spriteIdInput),
    createField("Size", canvasSizeInput),
    createField("Pivot X", pivotXInput),
    createField("Pivot Y", pivotYInput),
  );

  const colorFields = createElement("section", "sprite-tool-section");
  const colorRow = createElement("div", "sprite-color-row");
  colorRow.append(colorInput, colorHexInput);
  colorFields.append(createTextElement("h2", "Paint"), createField("Color", colorRow));

  const toolSection = createElement("section", "sprite-tool-section");
  const toolGrid = createElement("div", "sprite-tool-grid");
  toolGrid.append(...toolButtons);
  toolSection.append(createTextElement("h2", "Tools"), toolGrid);

  const historySection = createElement("section", "sprite-tool-section");
  const historyRow = createElement("div", "sprite-action-row");
  historyRow.append(undoButton, redoButton, clearButton);
  historySection.append(createTextElement("h2", "Project"), historyRow);

  assetPanel.append(spriteFields, colorFields, toolSection, historySection, clearDialog);

  const canvasWrap = createElement("div", "sprite-canvas-wrap");
  const canvas = createElement("canvas", "sprite-canvas");
  canvasWrap.append(canvas);
  editorArea.append(canvasWrap);

  const selectionSummary = createTextElement("h2", "Selected: none", "sprite-selection-summary");
  const flipHorizontalButton = createSpriteButton("⇋", "Flip horizontal");
  const flipVerticalButton = createSpriteButton("⇅", "Flip vertical");
  const sendToBackButton = createSpriteButton("⇤", "Send to back");
  const sendBackwardButton = createSpriteButton("←", "Send backward");
  const bringForwardButton = createSpriteButton("→", "Bring forward");
  const bringToFrontButton = createSpriteButton("⇥", "Bring to front");
  const groupButton = createSpriteButton("Group", "Group selected primitives");
  const ungroupButton = createSpriteButton("Ungroup", "Ungroup selected group");
  const copyPrimitiveButton = createSpriteButton("Copy", "Copy selected primitives");
  const pastePrimitiveButton = createSpriteButton("Paste", "Paste primitives");
  const deletePrimitiveButton = createSpriteButton("×", "Delete selected primitives", "sprite-icon-button danger");

  const transformSection = createElement("section", "sprite-inspector-section");
  const transformGrid = createElement("div", "sprite-action-grid");
  transformGrid.append(flipHorizontalButton, flipVerticalButton, sendToBackButton, sendBackwardButton, bringForwardButton, bringToFrontButton);
  transformSection.append(selectionSummary, transformGrid);

  const groupSection = createElement("section", "sprite-inspector-section");
  const groupRow = createElement("div", "sprite-action-row");
  groupRow.append(groupButton, ungroupButton);
  groupSection.append(createTextElement("h2", "Structure"), groupRow);

  const clipboardSection = createElement("section", "sprite-inspector-section");
  const clipboardRow = createElement("div", "sprite-action-row");
  clipboardRow.append(copyPrimitiveButton, pastePrimitiveButton, deletePrimitiveButton);
  clipboardSection.append(createTextElement("h2", "Selection"), clipboardRow);

  const primitiveListSection = createElement("section", "sprite-inspector-section sprite-primitive-list-section");
  const primitiveList = createElement("ol", "primitive-list");
  primitiveListSection.append(createTextElement("h2", "Primitives"), primitiveList);

  inspectorPanel.append(transformSection, groupSection, clipboardSection, primitiveListSection);

  const statusElement = createTextElement("strong", "player - 64x64 - 0 primitives");
  previewStatusArea.append(createTextElement("span", "Sprite"), statusElement);

  return {
    assetPanel,
    editorArea,
    inspectorPanel,
    previewStatusArea,
    canvas,
    primitiveList,
    toolButtons,
    spriteIdInput,
    canvasSizeInput,
    pivotXInput,
    pivotYInput,
    colorInput,
    colorHexInput,
    selectionSummary,
    flipHorizontalButton,
    flipVerticalButton,
    sendToBackButton,
    sendBackwardButton,
    bringForwardButton,
    bringToFrontButton,
    groupButton,
    ungroupButton,
    copyPrimitiveButton,
    pastePrimitiveButton,
    deletePrimitiveButton,
    undoButton,
    redoButton,
    clearButton,
    clearDialog,
    clearCancelButton,
    clearConfirmButton,
    statusElement,
  };
}

export function canUndoSpriteEditor(): boolean {
  return spriteEditorController.canUndo();
}

export function canRedoSpriteEditor(): boolean {
  return spriteEditorController.canRedo();
}

export function undoSpriteEditor(): void {
  spriteEditorController.undo();
}

export function redoSpriteEditor(): void {
  spriteEditorController.redo();
}

export function handleSpriteEditorKeyboardShortcut(event: KeyboardEvent): boolean {
  return spriteEditorController.handleKeyboardShortcut(event);
}

export function syncSpriteEditorAsset(): void {
  upsertCurrentProjectAsset(createSpriteProjectAsset(spriteEditorController.getSpriteAssetData()));
}

export function createNewSpriteEditorAsset(spriteId: string): void {
  spriteEditorController.createNewSprite(spriteId);
  syncSpriteEditorAsset();
}

export function replaceSpriteEditorAsset(sprite: SpriteAssetData): void {
  spriteEditorController.replaceSpriteAssetData(sprite);
  syncSpriteEditorAsset();
}

function createToolButton(kind: string, label: string, title: string): HTMLButtonElement {
  const button = createSpriteButton(label, title, "sprite-icon-button tool-button");
  button.dataset.kind = kind;

  return button;
}

function createSpriteButton(label: string, title: string, className = "sprite-button"): HTMLButtonElement {
  const button = createTextElement("button", label, className);
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);

  return button;
}

function createSpriteInput(type: string): HTMLInputElement {
  const input = createElement("input");
  input.type = type;

  return input;
}

function createClearDialog(): HTMLDialogElement {
  const dialog = createElement("dialog", "sprite-clear-dialog");
  const panel = createElement("form", "sprite-clear-dialog-panel");
  panel.method = "dialog";
  panel.append(
    createTextElement("h2", "Clear sprite?"),
    createTextElement("p", "This will remove all primitives from the current sprite."),
  );

  const actions = createElement("div", "sprite-clear-dialog-actions");
  const cancelButton = createSpriteButton("Cancel", "Cancel clear");
  const confirmButton = createSpriteButton("Clear", "Clear sprite", "sprite-button danger");
  cancelButton.dataset.clearCancel = "true";
  confirmButton.dataset.clearConfirm = "true";
  actions.append(cancelButton, confirmButton);
  panel.append(actions);
  dialog.append(panel);

  return dialog;
}
