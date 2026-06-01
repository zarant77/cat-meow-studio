import { SpriteEditorController } from "../sprites/app/spriteEditorController.js";
import type { SpriteAssetData, SpritePaletteColor } from "../model/assets.js";
import { createSpriteProjectAsset } from "../model/assetAdapters.js";
import { getSpritePalette, isSpritePaletteColorUsed, upsertCurrentProjectAsset } from "../state/projectState.js";
import type { ModeSurface, SpritePaletteActions } from "./appTypes.js";
import { createElement, createField, createTextElement } from "./dom.js";
import { renderAssetSidebarPanel, renderEditorArea, renderInspectorPanel, renderPreviewStatusArea } from "./renderShell.js";

const spriteEditorController = new SpriteEditorController();
spriteEditorController.setAssetChangeListener(syncSpriteEditorAsset);
const canvasSizeOptions = [32, 64, 96, 128, 192, 256, 512, 768, 1024] as const;
let activeSpriteInspectorTab: "primitives" | "palette" | "properties" = "primitives";

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
  canvasWidthSelect: HTMLSelectElement;
  canvasHeightSelect: HTMLSelectElement;
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
  const assetPanel = renderAssetSidebarPanel("sprites-asset-panel toolbar");
  const editorArea = renderEditorArea("sprites-editor-area");
  const inspectorPanel = renderInspectorPanel("sprites-inspector-panel");
  const previewStatusArea = renderPreviewStatusArea("Sprite workspace status");

  const spriteIdInput = createSpriteInput("text");
  spriteIdInput.dataset.field = "spriteId";
  const canvasWidthSelect = createCanvasSizeSelect("spriteCanvasWidth");
  const canvasHeightSelect = createCanvasSizeSelect("spriteCanvasHeight");
  const colorInput = createSpriteInput("color");
  colorInput.hidden = true;
  const colorHexInput = createSpriteInput("text");
  colorHexInput.hidden = true;
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
  const clearButton = createSpriteButton("⌧", "Clear sprite");
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
    createField("Canvas width", canvasWidthSelect),
    createField("Canvas height", canvasHeightSelect),
  );

  const toolSection = createElement("section", "sprite-tool-section");
  const toolGrid = createElement("div", "sprite-tool-grid");
  toolGrid.append(...toolButtons);
  toolSection.append(createTextElement("h2", "Create"), toolGrid);

  const selectionSummary = createTextElement("h2", "Selected: none", "sprite-selection-summary");
  const flipHorizontalButton = createSpriteButton("⇋", "Flip horizontal");
  const flipVerticalButton = createSpriteButton("⇅", "Flip vertical");
  const sendToBackButton = createSpriteButton("⇤", "Send to back");
  const sendBackwardButton = createSpriteButton("←", "Send backward");
  const bringForwardButton = createSpriteButton("→", "Bring forward");
  const bringToFrontButton = createSpriteButton("⇥", "Bring to front");
  const transformSection = createElement("section", "sprite-tool-section");
  const transformGrid = createElement("div", "sprite-action-grid");
  transformGrid.append(flipHorizontalButton, flipVerticalButton, sendToBackButton, sendBackwardButton, bringForwardButton, bringToFrontButton);
  transformSection.append(selectionSummary, transformGrid);

  const historySection = createElement("section", "sprite-tool-section");
  const historyRow = createElement("div", "sprite-action-row");
  historyRow.append(undoButton, redoButton, clearButton);
  historySection.append(createTextElement("h2", "Actions"), historyRow);

  assetPanel.append(toolSection, historySection, clearDialog, colorInput, colorHexInput);

  const canvasWrap = createElement("div", "sprite-canvas-wrap");
  const canvas = createElement("canvas", "sprite-canvas");
  canvasWrap.append(canvas);
  editorArea.append(canvasWrap);

  const groupButton = createSpriteButton("⊞", "Group selected primitives", "sprite-icon-button");
  const ungroupButton = createSpriteButton("⊟", "Ungroup selected group", "sprite-icon-button");
  const copyPrimitiveButton = createSpriteButton("⧉", "Copy selected primitives", "sprite-icon-button");
  const pastePrimitiveButton = createSpriteButton("▣", "Paste primitives", "sprite-icon-button");
  const deletePrimitiveButton = createSpriteButton("×", "Delete selected primitives", "sprite-icon-button danger");

  const tabBar = createElement("div", "sprite-inspector-tabs");
  const primitivesTab = createSpriteTabButton("Primitives", "primitives");
  const paletteTab = createSpriteTabButton("Palette", "palette");
  const propertiesTab = createSpriteTabButton("Properties", "properties");
  tabBar.append(primitivesTab, paletteTab, propertiesTab);

  const primitiveActionsSection = createElement("section", "sprite-inspector-section");
  const primitiveActionsRow = createElement("div", "sprite-action-row sprite-primitive-actions-row");
  primitiveActionsRow.append(groupButton, ungroupButton, copyPrimitiveButton, pastePrimitiveButton, deletePrimitiveButton);
  primitiveActionsSection.append(createTextElement("h2", "Selection"), primitiveActionsRow);

  const primitiveListSection = createElement("section", "sprite-inspector-section sprite-primitive-list-section");
  const primitiveList = createElement("ol", "primitive-list");
  primitiveListSection.append(createTextElement("h2", "Primitives"), primitiveList);

  const primitivesPanel = createElement("div", `sprite-inspector-tab-panel${activeSpriteInspectorTab === "primitives" ? " is-active" : ""}`);
  primitivesPanel.append(primitiveActionsSection, primitiveListSection);
  const palettePanel = createElement("div", `sprite-inspector-tab-panel${activeSpriteInspectorTab === "palette" ? " is-active" : ""}`);
  palettePanel.append(renderPaletteSection(getSpritePalette(), paletteActions));
  const propertiesPanel = createElement("div", `sprite-inspector-tab-panel${activeSpriteInspectorTab === "properties" ? " is-active" : ""}`);
  propertiesPanel.append(spriteFields, transformSection);
  inspectorPanel.append(tabBar, primitivesPanel, palettePanel, propertiesPanel);

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
    canvasWidthSelect,
    canvasHeightSelect,
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

function createCanvasSizeSelect(field: string): HTMLSelectElement {
  const select = createElement("select");
  select.dataset.field = field;

  for (const size of canvasSizeOptions) {
    const option = createElement("option");
    option.value = String(size);
    option.textContent = String(size);
    select.append(option);
  }

  return select;
}

function createSpriteTabButton(label: string, tab: "primitives" | "palette" | "properties"): HTMLButtonElement {
  const button = createSpriteButton(label, `Show ${label.toLowerCase()}`, `sprite-tab-button${activeSpriteInspectorTab === tab ? " is-active" : ""}`);
  button.addEventListener("click", () => {
    activeSpriteInspectorTab = tab;
    document.querySelectorAll<HTMLElement>(".sprite-tab-button").forEach((candidate) => {
      candidate.classList.toggle("is-active", candidate === button);
    });
    document.querySelectorAll<HTMLElement>(".sprite-inspector-tab-panel").forEach((panel, index) => {
      panel.classList.toggle(
        "is-active",
        (tab === "primitives" && index === 0) || (tab === "palette" && index === 1) || (tab === "properties" && index === 2),
      );
    });
  });

  return button;
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
    const editColorButton = createSpriteButton("◈", "Edit palette color", "sprite-icon-button");
    const colorPicker = createSpriteInput("color");
    const nameInput = createSpriteInput("text");
    const rgbaInput = createSpriteInput("text");
    const deleteButton = createSpriteButton("×", "Delete palette color", "sprite-icon-button danger");

    swatch.style.backgroundColor = rgbaToCss(color.rgba);
    colorPicker.value = rgbHexFromRgba(color.rgba);
    colorPicker.disabled = index === 0;
    colorPicker.className = "sprite-palette-color-picker";
    editColorButton.disabled = index === 0;
    swatch.addEventListener("click", () => actions.selectColor(index));
    editColorButton.addEventListener("click", () => {
      if (index !== 0) {
        colorPicker.click();
      }
    });
    nameInput.value = color.name;
    nameInput.disabled = index === 0;
    nameInput.addEventListener("change", () => actions.renameColor(index, nameInput.value));
    rgbaInput.value = color.rgba;
    rgbaInput.disabled = index === 0;
    rgbaInput.addEventListener("change", () => actions.updateColor(index, rgbaInput.value));
    colorPicker.addEventListener("change", () => {
      const nextRgba = `${colorPicker.value}${alphaHexFromRgba(rgbaInput.value)}`;
      rgbaInput.value = nextRgba;
      actions.updateColor(index, nextRgba);
    });
    deleteButton.disabled = index === 0 || isSpritePaletteColorUsed(index);
    deleteButton.addEventListener("click", () => actions.deleteColor(index));

    row.append(swatch, nameInput, rgbaInput, editColorButton, deleteButton, colorPicker);
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

function rgbHexFromRgba(rgba: string): string {
  return rgba.slice(0, 7);
}

function alphaHexFromRgba(rgba: string): string {
  return rgba.slice(7, 9) || "ff";
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
