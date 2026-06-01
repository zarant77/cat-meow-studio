import { SpriteEditorController } from "../sprites/app/spriteEditorController.js";
import type { SpriteAssetData, SpritePaletteColor } from "../model/assets.js";
import { createSpriteProjectAsset } from "../model/assetAdapters.js";
import { getSpritePalette, isSpritePaletteColorUsed, upsertCurrentProjectAsset } from "../state/projectState.js";
import type { ModeSurface, SpritePaletteActions } from "./appTypes.js";
import { createElement, createField, createTextElement } from "./dom.js";
import { renderAssetSidebarPanel, renderEditorArea, renderInspectorPanel, renderPreviewStatusArea } from "./renderShell.js";

const spriteEditorController = new SpriteEditorController();
spriteEditorController.setAssetChangeListener(syncSpriteEditorAsset);

export function renderSpriteEditorSurface(paletteActions: SpritePaletteActions): ModeSurface {
  const mount = createSpriteMount(paletteActions);

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

function createSpriteMount(paletteActions: SpritePaletteActions): {
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
  colorFields.append(renderPaletteSection(getSpritePalette(), paletteActions));

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

export function selectSpritePaletteColor(rgba: string): void {
  spriteEditorController.setPaletteColor(rgba);
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

function renderPaletteSection(palette: readonly SpritePaletteColor[], actions: SpritePaletteActions): HTMLElement {
  const paletteSection = createElement("div", "sprite-palette");
  const header = createElement("div", "sprite-palette-header");
  const addButton = createSpriteButton("+", "Add palette color", "sprite-icon-button");
  addButton.disabled = palette.length >= 256;
  addButton.addEventListener("click", actions.addColor);
  header.append(createTextElement("h3", "Palette"), addButton);
  paletteSection.append(header);

  const list = createElement("div", "sprite-palette-list");

  palette.forEach((color, index) => {
    const row = createElement("div", "sprite-palette-row");
    const swatch = createSpriteButton(String(index), `Use ${color.name}`, "sprite-palette-swatch");
    const nameInput = createSpriteInput("text");
    const rgbaInput = createSpriteInput("text");
    const deleteButton = createSpriteButton("×", "Delete palette color", "sprite-icon-button danger");

    swatch.style.backgroundColor = rgbaToCss(color.rgba);
    swatch.addEventListener("click", () => actions.selectColor(index));
    nameInput.value = color.name;
    nameInput.disabled = index === 0;
    nameInput.addEventListener("change", () => actions.renameColor(index, nameInput.value));
    rgbaInput.value = color.rgba;
    rgbaInput.disabled = index === 0;
    rgbaInput.addEventListener("change", () => actions.updateColor(index, rgbaInput.value));
    deleteButton.disabled = index === 0 || isSpritePaletteColorUsed(index);
    deleteButton.addEventListener("click", () => actions.deleteColor(index));

    row.append(swatch, nameInput, rgbaInput, deleteButton);
    list.append(row);
  });

  paletteSection.append(list);

  return paletteSection;
}

function rgbaToCss(rgba: string): string {
  const red = Number.parseInt(rgba.slice(1, 3), 16);
  const green = Number.parseInt(rgba.slice(3, 5), 16);
  const blue = Number.parseInt(rgba.slice(5, 7), 16);
  const alpha = Number.parseInt(rgba.slice(7, 9), 16) / 255;

  return `rgb(${red} ${green} ${blue} / ${alpha})`;
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
