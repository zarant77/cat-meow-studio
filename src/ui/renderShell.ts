import {
  Download,
  Image,
  Maximize2,
  Music,
  Upload,
  Volume2,
} from "lucide";
import type { AppMode, AppStatus, RenderActions } from "./appTypes.js";
import { appendChildren, createElement, createTextElement } from "./dom.js";
import { createIcon, type AppIcon } from "./icons.js";

interface AppShellParts {
  mode: AppMode;
  status: AppStatus | null;
  toolbar: HTMLElement;
  editorArea: HTMLElement;
  inspectorPanel: HTMLElement;
  previewStatusArea: HTMLElement;
  shellActions: RenderActions;
}

export function renderAppShell(parts: AppShellParts): HTMLElement[] {
  return [
    renderHeader(parts.mode, parts.shellActions),
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

function renderHeader(mode: AppMode, shellActions: RenderActions): HTMLElement {
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
    createModeButton(Image, "Sprites", "sprites", mode, shellActions),
    createModeButton(Music, "Music", "music", mode, shellActions),
    createModeButton(Volume2, "SFX", "sfx", mode, shellActions),
  );

  const actions = createElement("div", "header-actions");
  const importButton = createHeaderButton(Upload, "Import", "Import JSON asset");
  const exportButton = createHeaderButton(Download, "Export", "Export current asset JSON");
  const fullscreenButton = createHeaderButton(Maximize2, null, "Fullscreen", "header-action-button icon-only");
  importButton.type = "button";
  exportButton.type = "button";
  fullscreenButton.type = "button";
  importButton.addEventListener("click", shellActions.importJson);
  exportButton.addEventListener("click", shellActions.exportCurrentJson);
  fullscreenButton.addEventListener("click", shellActions.toggleFullscreen);
  actions.append(importButton, exportButton, fullscreenButton);

  header.append(brand, nav, actions);
  return header;
}

function createModeButton(icon: AppIcon, label: string, mode: AppMode, activeMode: AppMode, actions: RenderActions): HTMLButtonElement {
  const button = createHeaderButton(icon, label, `Open ${label}`, `header-mode-button${activeMode === mode ? " is-active" : ""}`);
  button.type = "button";
  button.addEventListener("click", () => actions.openMode(mode));

  return button;
}

function createHeaderButton(icon: AppIcon, label: string | null, title: string, className = "header-action-button"): HTMLButtonElement {
  const button = createElement("button", className);
  button.append(createIcon(icon));

  if (label !== null) {
    button.append(document.createTextNode(label));
  }

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
