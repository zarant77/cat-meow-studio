import {
  BringToFront,
  Circle,
  ClipboardPaste,
  Copy,
  FlipHorizontal,
  FlipVertical,
  Frame,
  Group,
  Maximize2,
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
  ZoomIn,
  ZoomOut,
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
type SpriteInspectorTab = "primitives" | "properties" | "example";
let activeSpriteInspectorTab: SpriteInspectorTab = "primitives";

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
  canvasZoomInput: HTMLInputElement;
  primitiveList: HTMLOListElement;
  toolButtons: HTMLButtonElement[];
  spriteIdInput: HTMLInputElement;
  canvasWidthInput: HTMLInputElement;
  canvasHeightInput: HTMLInputElement;
  exampleImageInput: HTMLInputElement;
  exampleImageName: HTMLElement;
  exampleOpacityInput: HTMLInputElement;
  exampleOffsetXInput: HTMLInputElement;
  exampleOffsetYInput: HTMLInputElement;
  exampleScaleInput: HTMLInputElement;
  deleteExampleButton: HTMLButtonElement;
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
  scaleSpriteUpButton: HTMLButtonElement;
  scaleSpriteDownButton: HTMLButtonElement;
  groupButton: HTMLButtonElement;
  ungroupButton: HTMLButtonElement;
  copyPrimitiveButton: HTMLButtonElement;
  pastePrimitiveButton: HTMLButtonElement;
  deletePrimitiveButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
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
  const exampleImageInput = createSpriteInput("file");
  exampleImageInput.accept = "image/*";
  const exampleImageName = createTextElement("strong", "No example image", "sprite-example-name");
  const exampleOpacityInput = createExampleRangeInput("spriteExampleOpacity", "0", "1", "0.01");
  const exampleOffsetXInput = createExampleNumberInput("spriteExampleOffsetX", "-2048", "2048", "1");
  const exampleOffsetYInput = createExampleNumberInput("spriteExampleOffsetY", "-2048", "2048", "1");
  const exampleScaleInput = createExampleNumberInput("spriteExampleScale", "0.05", "16", "0.05");
  const deleteExampleButton = createSpriteButton(Trash2, "Remove example image", "sprite-icon-button danger");
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
    createToolButton("rect", Square, "Rectangle (1)"),
    createToolButton("circle", Circle, "Circle (2)"),
    createToolButton("triangle", Triangle, "Triangle (3)"),
  ];
  const editToolButtons = [
    createToolButton("fill", PaintBucket, "Fill (F)"),
    createToolButton("eyedropper", Pipette, "Pick color (I)"),
    createToolButton("rotate", RotateCw, "Rotate (R)"),
    createToolButton("transform", Maximize2, "Transform (T)"),
    createToolButton("scale", Scaling, "Scale (S)"),
    createToolButton("crop", Frame, "Crop canvas (C)"),
  ];
  const toolButtons = [...primitiveToolButtons, ...editToolButtons];

  const undoButton = createSpriteButton(Undo2, "Undo (Ctrl/Cmd+Z)");
  const redoButton = createSpriteButton(Redo2, "Redo (Ctrl/Cmd+Shift+Z)");

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
  const flipHorizontalButton = createSpriteButton(FlipHorizontal, "Flip horizontal (H)");
  const flipVerticalButton = createSpriteButton(FlipVertical, "Flip vertical (V)");
  const sendToBackButton = createSpriteButton(SendToBack, "Send to back (Shift+[)");
  const sendBackwardButton = createSpriteButton(StepBack, "Send backward ([)");
  const bringForwardButton = createSpriteButton(StepForward, "Bring forward (])");
  const bringToFrontButton = createSpriteButton(BringToFront, "Bring to front (Shift+])");
  const scaleSpriteUpButton = createSpriteButton(ZoomIn, "Scale Sprite Up");
  const scaleSpriteDownButton = createSpriteButton(ZoomOut, "Scale Sprite Down");
  const transformSection = createElement("section", "sprite-tool-section sprite-transform-section");
  const transformGrid = createElement("div", "sprite-action-grid");
  transformGrid.append(
    flipHorizontalButton,
    flipVerticalButton,
    sendToBackButton,
    bringToFrontButton,
    sendBackwardButton,
    bringForwardButton,
    scaleSpriteUpButton,
    scaleSpriteDownButton,
  );
  transformSection.append(selectionSummary, transformGrid);

  const historySection = createElement("section", "sprite-tool-section");
  const historyRow = createElement("div", "sprite-action-row");
  historyRow.append(undoButton, redoButton);
  historySection.append(createTextElement("h2", "Actions"), historyRow);

  assetPanel.append(primitiveToolSection, editToolSection, colorSection, transformSection, historySection);

  const canvasWrap = createElement("div", "sprite-canvas-wrap");
  const canvasZoomControl = createElement("label", "sprite-canvas-zoom");
  const canvasZoomInput = createSpriteInput("range");
  canvasZoomInput.min = "1";
  canvasZoomInput.max = "10";
  canvasZoomInput.step = "0.25";
  canvasZoomInput.value = "1";
  canvasZoomInput.title = "Canvas zoom";
  canvasZoomInput.setAttribute("aria-label", "Canvas zoom");
  canvasZoomControl.append(createTextElement("span", "Zoom"), canvasZoomInput);
  const canvas = createElement("canvas", "sprite-canvas");
  canvasWrap.append(canvas);
  editorArea.append(canvasWrap, canvasZoomControl);

  const groupButton = createSpriteButton(Group, "Group selected primitives", "sprite-icon-button");
  const ungroupButton = createSpriteButton(Ungroup, "Ungroup selected group", "sprite-icon-button");
  const copyPrimitiveButton = createSpriteButton(Copy, "Copy selected primitives (Ctrl/Cmd+C)", "sprite-icon-button");
  const pastePrimitiveButton = createSpriteButton(ClipboardPaste, "Paste primitives (Ctrl/Cmd+V)", "sprite-icon-button");
  const deletePrimitiveButton = createSpriteButton(Trash2, "Delete selected primitives (Delete)", "sprite-icon-button danger");

  const tabBar = createElement("div", "sprite-inspector-tabs");
  const primitivesTab = createSpriteTabButton("Primitives", "primitives");
  const propertiesTab = createSpriteTabButton("Properties", "properties");
  const exampleTab = createSpriteTabButton("Example", "example");
  tabBar.append(primitivesTab, propertiesTab, exampleTab);

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

  const examplePanel = createElement(
    "div",
    `sprite-inspector-tab-panel${activeSpriteInspectorTab === "example" ? " is-active" : ""}`,
  );
  const exampleSection = createElement("section", "sprite-inspector-section sprite-example-section");
  const exampleActions = createElement("div", "sprite-example-actions");
  exampleActions.append(exampleImageInput, deleteExampleButton);
  exampleSection.append(
    createTextElement("h2", "Example"),
    exampleImageName,
    exampleActions,
    createField("Opacity", exampleOpacityInput),
    createField("Offset X", exampleOffsetXInput),
    createField("Offset Y", exampleOffsetYInput),
    createField("Scale", exampleScaleInput),
  );
  examplePanel.append(exampleSection);
  inspectorPanel.append(tabBar, primitivesPanel, propertiesPanel, examplePanel);

  const statusElement = createTextElement("strong", "sprite - 256x256 - 0 primitives");
  previewStatusArea.append(createTextElement("span", "Sprite"), statusElement);

  return {
    assetPanel,
    editorArea,
    inspectorPanel,
    previewStatusArea,
    canvas,
    canvasZoomInput,
    primitiveList,
    toolButtons,
    spriteIdInput,
    canvasWidthInput,
    canvasHeightInput,
    exampleImageInput,
    exampleImageName,
    exampleOpacityInput,
    exampleOffsetXInput,
    exampleOffsetYInput,
    exampleScaleInput,
    deleteExampleButton,
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
    scaleSpriteUpButton,
    scaleSpriteDownButton,
    groupButton,
    ungroupButton,
    copyPrimitiveButton,
    pastePrimitiveButton,
    deletePrimitiveButton,
    undoButton,
    redoButton,
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

export function getCurrentSpriteEditorAsset(): SpriteAssetData {
  return spriteEditorController.getSpriteAssetData();
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

function createExampleNumberInput(field: string, min: string, max: string, step: string): HTMLInputElement {
  const input = createSpriteInput("number");
  input.dataset.field = field;
  input.min = min;
  input.max = max;
  input.step = step;

  return input;
}

function createExampleRangeInput(field: string, min: string, max: string, step: string): HTMLInputElement {
  const input = createSpriteInput("range");
  input.dataset.field = field;
  input.min = min;
  input.max = max;
  input.step = step;

  return input;
}

function createSpriteTabButton(label: string, tab: SpriteInspectorTab): HTMLButtonElement {
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
        (tab === "primitives" && index === 0) || (tab === "properties" && index === 1) || (tab === "example" && index === 2),
      );
    });
  });

  return button;
}
