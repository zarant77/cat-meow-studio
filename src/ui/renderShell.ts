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
  editorArea: HTMLElement;
  inspectorPanel: HTMLElement;
  previewStatusArea: HTMLElement;
  shellActions: RenderActions;
}

export function renderAppShell(parts: AppShellParts): HTMLElement[] {
  return [
    renderHeader(parts.assetExplorerItems, parts.assetExplorerActions, parts.shellActions),
    renderWorkspace(
      parts.mode,
      parts.toolbar,
      parts.editorArea,
      parts.inspectorPanel,
    ),
    renderFooter(parts.status, parts.previewStatusArea),
  ];
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

function renderHeader(
  assetExplorerItems: readonly AssetExplorerItem[],
  assetExplorerActions: AssetExplorerActions,
  shellActions: RenderActions,
): HTMLElement {
  const header = createElement("header", "app-header");
  const brand = createElement("div", "brand");
  const logo = createElement("img", "brand-logo");
  logo.src = "/favicon.png";
  logo.alt = "Cat Meow Studio";

  const brandText = createElement("div", "brand-text");
  brandText.append(createTextElement("h1", "Cat Meow Studio"));
  brand.append(logo, brandText);

  const nav = createElement("nav", "asset-nav");
  nav.append(
    renderAssetMenu("▦ Sprites", "sprite", "+ New Sprite", assetExplorerItems, assetExplorerActions),
    renderAssetMenu("♪ Music", "music", "+ New Music", assetExplorerItems, assetExplorerActions),
    renderAssetMenu("◒ SFX", "sfx", "+ New SFX", assetExplorerItems, assetExplorerActions),
  );

  const actions = createElement("div", "header-actions");
  const exportButton = createTextElement("button", "⇩ Export", "header-action-button");
  const fullscreenButton = createTextElement("button", "⛶", "header-action-button icon-only");
  exportButton.type = "button";
  fullscreenButton.type = "button";
  exportButton.title = "Export Little One assets";
  fullscreenButton.title = "Fullscreen";
  fullscreenButton.setAttribute("aria-label", "Fullscreen");
  exportButton.addEventListener("click", shellActions.exportAllC);
  fullscreenButton.addEventListener("click", shellActions.toggleFullscreen);
  actions.append(exportButton, fullscreenButton);

  header.append(brand, nav, actions);
  return header;
}

function renderAssetMenu(
  label: string,
  kind: AssetKind,
  createLabel: string,
  items: readonly AssetExplorerItem[],
  actions: AssetExplorerActions,
): HTMLElement {
  const menu = createElement("details", "asset-menu");
  const summary = createTextElement("summary", `${label} ▼`, "asset-menu-summary");
  const body = createElement("div", "asset-menu-body");
  const createButton = createTextElement("button", createLabel, "asset-menu-item create");
  createButton.type = "button";
  menu.addEventListener("toggle", () => {
    if (!menu.open) {
      return;
    }

    document.querySelectorAll<HTMLDetailsElement>(".asset-menu[open]").forEach((otherMenu) => {
      if (otherMenu !== menu) {
        otherMenu.open = false;
      }
    });
  });
  createButton.addEventListener("click", () => {
    actions.createAsset(kind);
    menu.open = false;
  });
  body.append(createButton, createElement("hr"));

  const groupItems = items.filter((item) => item.kind === kind);
  if (groupItems.length === 0) {
    body.append(createTextElement("span", "No assets", "asset-menu-empty"));
  } else {
    for (const item of groupItems) {
      const row = createElement("div", "asset-menu-row");
      const button = createTextElement("button", item.name, `asset-menu-item${item.isSelected ? " is-selected" : ""}`);
      const renameButton = createAssetMenuActionButton("R", "Rename asset");
      const duplicateButton = createAssetMenuActionButton("D", "Duplicate asset");
      const deleteButton = createAssetMenuActionButton("×", "Delete asset", "asset-menu-action danger");
      button.type = "button";
      button.title = item.name;
      button.addEventListener("click", () => {
        actions.selectAsset(kind, item.id);
        menu.open = false;
      });
      renameButton.addEventListener("click", () => {
        const name = window.prompt("Rename asset", item.name);

        if (name !== null) {
          actions.renameAsset(kind, item.id, name);
          menu.open = false;
        }
      });
      duplicateButton.addEventListener("click", () => {
        actions.duplicateAsset(kind, item.id);
        menu.open = false;
      });
      deleteButton.addEventListener("click", () => {
        actions.deleteAsset(kind, item.id);
        menu.open = false;
      });
      row.append(button, renameButton, duplicateButton, deleteButton);
      body.append(row);
    }
  }
  menu.append(summary, body);
  return menu;
}

function createAssetMenuActionButton(label: string, title: string, className = "asset-menu-action"): HTMLButtonElement {
  const button = createTextElement("button", label, className);
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);

  return button;
}

function renderFooter(status: AppStatus | null, previewStatusArea: HTMLElement): HTMLElement {
  const footer = createElement("footer", "app-footer");
  const element = createElement("section", `status-bar${status === null ? "" : ` is-${status.tone}`}`);
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");

  if (status !== null) {
    element.textContent = status.message;
  }

  footer.append(previewStatusArea, element);
  return footer;
}

function renderWorkspace(
  mode: AppMode,
  toolbar: HTMLElement,
  editorArea: HTMLElement,
  inspectorPanel: HTMLElement,
): HTMLElement {
  const workspace = createElement("section", `workspace mode-workspace ${mode}-workspace`);
  appendChildren(workspace, [toolbar, editorArea, inspectorPanel]);

  return workspace;
}
