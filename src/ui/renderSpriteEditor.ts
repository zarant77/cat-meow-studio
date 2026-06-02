import {
  BringToFront,
  Circle,
  ClipboardPaste,
  Copy,
  FlipHorizontal,
  FlipVertical,
  Group,
  PaintBucket,
  Pipette,
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
import type { SpriteAssetData } from "../model/assets.js";
import { createSpriteProjectAsset } from "../model/assetAdapters.js";
import { upsertCurrentProjectAsset } from "../state/projectState.js";
import type { ModeSurface } from "./appTypes.js";
import { createElement, createField, createTextElement } from "./dom.js";
import { createIcon, type AppIcon } from "./icons.js";
import { renderAssetSidebarPanel, renderEditorArea, renderInspectorPanel, renderPreviewStatusArea } from "./renderShell.js";

const spriteEditorController = new SpriteEditorController();
spriteEditorController.setAssetChangeListener(syncSpriteEditorAsset);
let activeSpriteInspectorTab: "primitives" | "properties" = "primitives";

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
  canvasWidthInput: HTMLInputElement;
  canvasHeightInput: HTMLInputElement;
  foregroundColorButton: HTMLButtonElement;
  backgroundColorButton: HTMLButtonElement;
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
  const canvasWidthInput = createCanvasSizeInput("spriteCanvasWidth");
  const canvasHeightInput = createCanvasSizeInput("spriteCanvasHeight");
  const colorInput = createSpriteInput("color");
  colorInput.className = "sprite-color-picker-input";
  colorInput.tabIndex = -1;
  const colorHexInput = createSpriteInput("text");
  colorHexInput.dataset.field = "spriteColor";
  colorHexInput.className = "sprite-color-hex-input";
  colorHexInput.maxLength = 10;
  colorHexInput.title = "Edit active color as RRGGBBAA";
  colorHexInput.setAttribute("aria-label", "Edit active color as RRGGBBAA");
  const foregroundColorButton = createColorSwatch("foreground", "Foreground color. Click to select; click again to edit.");
  const backgroundColorButton = createColorSwatch("background", "Background color. Click to select; click again to edit.");

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
    createField("Canvas width", canvasWidthInput),
    createField("Canvas height", canvasHeightInput),
  );

  const primitiveToolSection = createElement("section", "sprite-tool-section");
  const primitiveToolGrid = createElement("div", "sprite-tool-grid");
  primitiveToolGrid.append(...primitiveToolButtons);
  primitiveToolSection.append(createTextElement("h2", "Primitives"), primitiveToolGrid);

  const editToolSection = createElement("section", "sprite-tool-section");
  const editToolGrid = createElement("div", "sprite-tool-grid");
  editToolGrid.append(...editToolButtons);
  editToolSection.append(createTextElement("h2", "Tools"), editToolGrid);

  const colorSection = createElement("section", "sprite-tool-section sprite-color-tool-section");
  const colorControl = createElement("div", "sprite-color-control");
  colorControl.append(foregroundColorButton, backgroundColorButton, colorInput, colorHexInput);
  colorSection.append(createTextElement("h2", "Color"), colorControl);

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

  assetPanel.append(primitiveToolSection, editToolSection, colorSection, transformSection, historySection, clearDialog);

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
  const propertiesTab = createSpriteTabButton("Properties", "properties");
  tabBar.append(primitivesTab, propertiesTab);

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
  const propertiesPanel = createElement(
    "div",
    `sprite-inspector-tab-panel${activeSpriteInspectorTab === "properties" ? " is-active" : ""}`,
  );
  propertiesPanel.append(spriteFields);
  inspectorPanel.append(tabBar, primitivesPanel, propertiesPanel);

  const statusElement = createTextElement("strong", "sprite - 256x256 - 0 primitives");
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
    canvasWidthInput,
    canvasHeightInput,
    foregroundColorButton,
    backgroundColorButton,
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

function createColorSwatch(slot: "foreground" | "background", title: string): HTMLButtonElement {
  const button = createElement("button", `sprite-color-swatch ${slot}`);
  button.type = "button";
  button.dataset.colorSlot = slot;
  button.title = title;
  button.setAttribute("aria-label", title);

  return button;
}

function createCanvasSizeInput(field: string): HTMLInputElement {
  const input = createSpriteInput("number");
  input.dataset.field = field;
  input.min = "1";
  input.max = "1020";
  input.step = "1";

  return input;
}

function createSpriteTabButton(label: string, tab: "primitives" | "properties"): HTMLButtonElement {
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
        (tab === "primitives" && index === 0) || (tab === "properties" && index === 1),
      );
    });
  });

  return button;
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
