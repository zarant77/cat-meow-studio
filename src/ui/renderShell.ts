import type { AssetExplorerItem } from "../state/assetExplorerState.js";
import type { AssetKind } from "../model/assets.js";
import type { AppMode, AppStatus, AssetExplorerActions, RenderActions } from "./appTypes.js";
import { appendChildren, createElement, createTextElement } from "./dom.js";

interface AppShellParts {
  mode: AppMode;
  status: AppStatus | null;
  toolbar: HTMLElement;
  assetExplorerItems: AssetExplorerItem[];
  assetExplorerActions: AssetExplorerActions;
  assetPanel: HTMLElement;
  editorArea: HTMLElement;
  inspectorPanel: HTMLElement;
  previewStatusArea: HTMLElement;
  setMode: (mode: AppMode) => void;
}

interface ModeOption {
  mode: AppMode;
  label: string;
}

const modeOptions: ModeOption[] = [
  { mode: "music", label: "Music" },
  { mode: "sfx", label: "SFX" },
  { mode: "sprites", label: "Sprites" },
];

export function renderAppShell(parts: AppShellParts): HTMLElement[] {
  return [
    renderHeader(parts.mode, parts.setMode),
    parts.toolbar,
    renderAssetExplorer(parts.assetExplorerItems, parts.mode, parts.assetExplorerActions),
    renderStatus(parts.status),
    renderWorkspace(parts.mode, parts.assetPanel, parts.editorArea, parts.inspectorPanel),
    parts.previewStatusArea,
  ];
}

export function renderModeSwitcher(mode: AppMode, setMode: (mode: AppMode) => void): HTMLElement {
  const modeTabs = createElement("nav", "mode-tabs");
  modeTabs.setAttribute("aria-label", "Editor mode");

  for (const option of modeOptions) {
    const tab = createTextElement("button", option.label, `mode-tab${mode === option.mode ? " is-active" : ""}`);
    tab.type = "button";
    tab.addEventListener("click", () => setMode(option.mode));
    modeTabs.append(tab);
  }

  return modeTabs;
}

export function renderAssetExplorer(
  items: readonly AssetExplorerItem[],
  mode: AppMode,
  actions: AssetExplorerActions,
): HTMLElement {
  const explorer = createElement("section", "asset-explorer");
  explorer.setAttribute("aria-label", "Project assets");

  const groups: Array<{ kind: AssetKind; label: string; mode: AppMode }> = [
    { kind: "sprite", label: "Sprites", mode: "sprites" },
    { kind: "music", label: "Music", mode: "music" },
    { kind: "sfx", label: "SFX", mode: "sfx" },
  ];

  for (const group of groups) {
    const groupElement = createElement("div", "asset-explorer-group");
    const heading = createTextElement("h2", group.label);
    const createButton = createTextElement("button", "+", "asset-explorer-create");
    createButton.type = "button";
    createButton.title = `Create ${group.label} asset`;
    createButton.setAttribute("aria-label", `Create ${group.label} asset`);
    createButton.addEventListener("click", () => actions.createAsset(group.kind));
    groupElement.append(heading, createButton);

    const list = createElement("div", "asset-explorer-list");
    const groupItems = items.filter((item) => item.kind === group.kind);

    if (groupItems.length === 0) {
      list.append(createTextElement("span", "None", "asset-explorer-empty"));
    } else {
      for (const item of groupItems) {
        const itemElement = createElement("div", `asset-explorer-row${item.isSelected ? " is-selected" : ""}`);
        const button = createTextElement(
          "button",
          item.name,
          `asset-explorer-item${mode === group.mode && item.isSelected ? " is-active" : ""}`,
        );
        button.type = "button";
        button.title = `${group.label}: ${item.name}`;
        button.addEventListener("click", () => actions.selectAsset(group.kind, item.id));
        const renameButton = createAssetActionButton("Rename", "Rename asset");
        const duplicateButton = createAssetActionButton("Duplicate", "Duplicate asset");
        const deleteButton = createAssetActionButton("Delete", "Delete asset", "asset-explorer-action danger");
        renameButton.addEventListener("click", () => {
          const name = window.prompt("Rename asset", item.name);

          if (name !== null) {
            actions.renameAsset(group.kind, item.id, name);
          }
        });
        duplicateButton.addEventListener("click", () => actions.duplicateAsset(group.kind, item.id));
        deleteButton.addEventListener("click", () => actions.deleteAsset(group.kind, item.id));
        itemElement.append(button, renameButton, duplicateButton, deleteButton);
        list.append(itemElement);
      }
    }

    groupElement.append(list);
    explorer.append(groupElement);
  }

  return explorer;
}

function createAssetActionButton(label: string, title: string, className = "asset-explorer-action"): HTMLButtonElement {
  const button = createTextElement("button", label, className);
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);

  return button;
}

export function renderToolbar(mode: AppMode, actions: RenderActions): HTMLElement {
  const toolbar = createElement("section", "toolbar");
  toolbar.setAttribute("aria-label", "Editor toolbar");

  const undoButton = createToolbarButton("↶", "Undo");
  const redoButton = createToolbarButton("↷", "Redo");
  const playButton = createToolbarButton("▶", "Play preview", "tool-button primary");
  const stopButton = createToolbarButton("■", "Stop preview");
  const fullscreenButton = createToolbarButton("⛶", "Fullscreen mode");
  const newButton = createToolbarButton("New", getNewTitle(mode));
  const addButton = createToolbarButton("+", getAddTitle(mode));
  const jsonButton = createToolbarButton("{}", "Export JSON");
  const importButton = createToolbarButton("↥", getImportTitle(mode));
  const clearSavedButton = createToolbarButton("⌫", "Clear saved project");
  const cButton = createToolbarButton("C", "Export C source");
  const projectButtons = [newButton, addButton, jsonButton, importButton, cButton];
  undoButton.dataset.shellAction = "undo";
  redoButton.dataset.shellAction = "redo";

  undoButton.disabled = !actions.canUndo();
  redoButton.disabled = !actions.canRedo();

  if (mode === "sprites") {
    playButton.disabled = true;
    stopButton.disabled = true;
    projectButtons.forEach((button) => {
      button.disabled = true;
    });
  }

  undoButton.addEventListener("click", actions.undo);
  redoButton.addEventListener("click", actions.redo);
  playButton.addEventListener("click", actions.playSound);
  stopButton.addEventListener("click", actions.stopSound);
  fullscreenButton.addEventListener("click", actions.toggleFullscreen);
  newButton.addEventListener("click", actions.createNewProject);
  addButton.addEventListener("click", actions.addCommand);
  jsonButton.addEventListener("click", actions.exportSoundJson);
  importButton.addEventListener("click", actions.importSoundJson);
  clearSavedButton.addEventListener("click", actions.clearSavedProject);
  cButton.addEventListener("click", actions.exportSoundC);

  toolbar.append(
    undoButton,
    redoButton,
    playButton,
    stopButton,
    fullscreenButton,
    newButton,
    addButton,
    jsonButton,
    importButton,
    clearSavedButton,
    cButton,
  );
  return toolbar;
}

export function renderAssetSidebarPanel(className = ""): HTMLElement {
  return createElement("aside", `panel project-panel asset-sidebar-panel${className === "" ? "" : ` ${className}`}`);
}

export function renderEditorArea(className = ""): HTMLElement {
  return createElement("section", `panel command-list editor-area${className === "" ? "" : ` ${className}`}`);
}

export function renderInspectorPanel(className = ""): HTMLElement {
  return createElement("aside", `panel inspector-panel${className === "" ? "" : ` ${className}`}`);
}

export function renderPreviewStatusArea(ariaLabel: string): HTMLElement {
  const preview = createElement("section", "panel preview-panel preview-status-area");
  preview.setAttribute("aria-label", ariaLabel);

  return preview;
}

function renderHeader(mode: AppMode, setMode: (mode: AppMode) => void): HTMLElement {
  const header = createElement("header", "app-header");
  const brand = createElement("div", "brand");
  const logo = createElement("img", "brand-logo");
  logo.src = "/favicon.png";
  logo.alt = "Cat Meow Studio";

  const brandText = createElement("div", "brand-text");
  brandText.append(
    createTextElement("h1", "Cat Meow Studio"),
    createTextElement("p", "Procedural sprite, music, and sound effect generator for tiny .kkrieger-inspired games."),
  );
  brand.append(logo, brandText);

  header.append(brand, renderModeSwitcher(mode, setMode));
  return header;
}

function renderStatus(status: AppStatus | null): HTMLElement {
  const element = createElement("section", `status-bar${status === null ? "" : ` is-${status.tone}`}`);
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");

  if (status !== null) {
    element.textContent = status.message;
  }

  return element;
}

function renderWorkspace(mode: AppMode, assetPanel: HTMLElement, editorArea: HTMLElement, inspectorPanel: HTMLElement): HTMLElement {
  const workspace = createElement("section", `workspace mode-workspace ${mode}-workspace`);
  appendChildren(workspace, [assetPanel, editorArea, inspectorPanel]);

  return workspace;
}

function createToolbarButton(label: string, title: string, className = "tool-button"): HTMLButtonElement {
  const button = createTextElement("button", label, className);
  button.type = "button";
  button.title = title;

  return button;
}

function getNewTitle(mode: AppMode): string {
  if (mode === "music") {
    return "New music";
  }

  if (mode === "sprites") {
    return "New sprite project";
  }

  return "New sound";
}

function getAddTitle(mode: AppMode): string {
  if (mode === "music") {
    return "Add note";
  }

  if (mode === "sprites") {
    return "Add sprite asset";
  }

  return "Add command";
}

function getImportTitle(mode: AppMode): string {
  if (mode === "music") {
    return "Import music JSON";
  }

  if (mode === "sprites") {
    return "Import sprite project";
  }

  return "Import sound JSON";
}
