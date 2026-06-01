import {
  BringToFront,
  Circle,
  ClipboardPaste,
  Copy,
  FlipHorizontal,
  FlipVertical,
  Group,
  PaintBucket,
  Palette,
  Pipette,
  Plus,
  Redo2,
  RotateCw,
  Scaling,
  SendToBack,
  Square,
  StepBack,
  StepForward,
  Trash2,
  Triangle,
  Undo2,
  Ungroup,
} from "lucide";
import { SpriteEditorController } from "../sprites/app/spriteEditorController.js";
import type { SpriteAssetData, SpritePaletteColor } from "../model/assets.js";
import { createSpriteProjectAsset } from "../model/assetAdapters.js";
import { getSpritePalette, isSpritePaletteColorUsed, upsertCurrentProjectAsset } from "../state/projectState.js";
import type { ModeSurface, SpritePaletteActions } from "./appTypes.js";
import { createElement, createField, createTextElement } from "./dom.js";
import { createIcon, type AppIcon } from "./icons.js";
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

  const primitiveToolButtons = [
    createToolButton("rect", Square, "Rectangle"),
    createToolButton("circle", Circle, "Circle"),
    createToolButton("triangle", Triangle, "Triangle"),
  ];
  const editToolButtons = [
    createToolButton("fill", PaintBucket, "Fill"),
    createToolButton("eyedropper", Pipette, "Pick color"),
    createToolButton("rotate", RotateCw, "Rotate"),
    createToolButton("scale", Scaling, "Scale"),
  ];
  const toolButtons = [...primitiveToolButtons, ...editToolButtons];

  const undoButton = createSpriteButton(Undo2, "Undo");
  const redoButton = createSpriteButton(Redo2, "Redo");
  const clearButton = createSpriteButton(Trash2, "Clear sprite");
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

  const primitiveToolSection = createElement("section", "sprite-tool-section");
  const primitiveToolGrid = createElement("div", "sprite-tool-grid");
  primitiveToolGrid.append(...primitiveToolButtons);
  primitiveToolSection.append(createTextElement("h2", "Primitives"), primitiveToolGrid);

  const editToolSection = createElement("section", "sprite-tool-section");
  const editToolGrid = createElement("div", "sprite-tool-grid");
  editToolGrid.append(...editToolButtons);
  editToolSection.append(createTextElement("h2", "Tools"), editToolGrid);

  const selectionSummary = createTextElement("h2", "Selected: none", "sprite-selection-summary");
  const flipHorizontalButton = createSpriteButton(FlipHorizontal, "Flip horizontal");
  const flipVerticalButton = createSpriteButton(FlipVertical, "Flip vertical");
  const sendToBackButton = createSpriteButton(SendToBack, "Send to back");
  const sendBackwardButton = createSpriteButton(StepBack, "Send backward");
  const bringForwardButton = createSpriteButton(StepForward, "Bring forward");
  const bringToFrontButton = createSpriteButton(BringToFront, "Bring to front");
  const transformSection = createElement("section", "sprite-tool-section sprite-transform-section");
  const transformGrid = createElement("div", "sprite-action-grid");
  transformGrid.append(
    flipHorizontalButton,
    flipVerticalButton,
    sendToBackButton,
    bringToFrontButton,
    sendBackwardButton,
    bringForwardButton,
  );
  transformSection.append(selectionSummary, transformGrid);

  const historySection = createElement("section", "sprite-tool-section");
  const historyRow = createElement("div", "sprite-action-row");
  historyRow.append(undoButton, redoButton, clearButton);
  historySection.append(createTextElement("h2", "Actions"), historyRow);

  assetPanel.append(primitiveToolSection, editToolSection, transformSection, historySection, clearDialog, colorInput, colorHexInput);

  const canvasWrap = createElement("div", "sprite-canvas-wrap");
  const canvas = createElement("canvas", "sprite-canvas");
  canvasWrap.append(canvas);
  editorArea.append(canvasWrap);

  const groupButton = createSpriteButton(Group, "Group selected primitives", "sprite-icon-button");
  const ungroupButton = createSpriteButton(Ungroup, "Ungroup selected group", "sprite-icon-button");
  const copyPrimitiveButton = createSpriteButton(Copy, "Copy selected primitives", "sprite-icon-button");
  const pastePrimitiveButton = createSpriteButton(ClipboardPaste, "Paste primitives", "sprite-icon-button");
  const deletePrimitiveButton = createSpriteButton(Trash2, "Delete selected primitives", "sprite-icon-button danger");

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

  const primitivesPanel = createElement(
    "div",
    `sprite-inspector-tab-panel${activeSpriteInspectorTab === "primitives" ? " is-active" : ""}`,
  );
  primitivesPanel.append(primitiveActionsSection, primitiveListSection);
  const palettePanel = createElement("div", `sprite-inspector-tab-panel${activeSpriteInspectorTab === "palette" ? " is-active" : ""}`);
  palettePanel.append(renderPaletteSection(getSpritePalette(), paletteActions));
  const propertiesPanel = createElement(
    "div",
    `sprite-inspector-tab-panel${activeSpriteInspectorTab === "properties" ? " is-active" : ""}`,
  );
  propertiesPanel.append(spriteFields);
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

function createToolButton(kind: string, icon: AppIcon, title: string): HTMLButtonElement {
  const button = createSpriteButton(icon, title, "sprite-icon-button tool-button");
  button.dataset.kind = kind;

  return button;
}

function createSpriteButton(content: AppIcon | string, title: string, className = "sprite-button"): HTMLButtonElement {
  const button = createElement("button", className);
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);

  if (typeof content === "string") {
    button.textContent = content;
  } else {
    button.append(createIcon(content));
  }

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
  const button = createSpriteButton(
    label,
    `Show ${label.toLowerCase()}`,
    `sprite-tab-button${activeSpriteInspectorTab === tab ? " is-active" : ""}`,
  );
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
  const addButton = createSpriteButton(Plus, "Add palette color", "sprite-icon-button");
  addButton.disabled = palette.length >= 256;
  addButton.addEventListener("click", actions.addColor);
  header.append(createTextElement("h3", "Palette"), addButton);
  paletteSection.append(header);

  const list = createElement("div", "sprite-palette-list");

  palette.forEach((color, index) => {
    const row = createElement("div", "sprite-palette-row");
    const swatch = createSpriteButton(String(index), `Use ${color.name}`, "sprite-palette-swatch");
    const editColorButton = createSpriteButton(Palette, "Edit palette color", "sprite-icon-button");
    const colorPicker = createSpriteInput("color");
    const nameInput = createSpriteInput("text");
    const rgbaInput = createSpriteInput("text");
    const deleteButton = createSpriteButton(Trash2, "Delete palette color", "sprite-icon-button danger");

    swatch.style.backgroundColor = rgbaToCss(color.rgba);
    colorPicker.value = rgbHexFromRgba(color.rgba);
    colorPicker.className = "sprite-palette-color-picker";
    rgbaInput.className = "sprite-palette-rgba-input";
    swatch.addEventListener("click", () => actions.selectColor(index));
    editColorButton.addEventListener("click", () => {
      colorPicker.click();
    });
    nameInput.value = color.name;
    nameInput.addEventListener("change", () => actions.renameColor(index, nameInput.value));
    rgbaInput.value = color.rgba.toUpperCase();
    rgbaInput.addEventListener("change", () => actions.updateColor(index, rgbaInput.value));
    colorPicker.addEventListener("change", () => {
      const nextRgba = `${colorPicker.value}${alphaHexFromRgba(rgbaInput.value)}`.toUpperCase();
      rgbaInput.value = nextRgba;
      actions.updateColor(index, nextRgba);
    });
    deleteButton.disabled = isSpritePaletteColorUsed(index);
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
  const confirmButton = createSpriteButton(Trash2, "Clear sprite", "sprite-button danger");
  cancelButton.dataset.clearCancel = "true";
  confirmButton.dataset.clearConfirm = "true";
  actions.append(cancelButton, confirmButton);
  panel.append(actions);
  dialog.append(panel);

  return dialog;
}
