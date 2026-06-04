import { Play, Plus, Redo2, Square, Undo2 } from "lucide";
import { getSoundExportReadiness } from "../export/soundReadiness.js";
import type { SoundProject } from "../model/soundProject.js";
import type { EditorState } from "../state/editorState.js";
import { sanitizeSoundId } from "../utils/validation.js";
import type { ModeSurface, RenderActions } from "./appTypes.js";
import { createElement, createField, createIconButton, createTextElement } from "./dom.js";
import type { AppIcon } from "./icons.js";
import { renderCommands } from "./renderCommands.js";
import { renderInspector } from "./renderInspector.js";
import { renderPresetPanel } from "./renderPresets.js";
import { renderReadiness } from "./renderReadiness.js";
import { renderAssetSidebarPanel, renderPreviewStatusArea } from "./renderShell.js";
import { renderWaveform } from "./renderWaveform.js";

export function renderSfxSurface(state: EditorState, actions: RenderActions): ModeSurface {
  return {
    assetPanel: renderSfxToolbar(actions),
    editorArea: renderSfxEditorArea(state, actions),
    inspectorPanel: renderSfxInspectorPanel(state, actions),
    previewStatusArea: renderSfxPreview(getProjectFromState(state)),
  };
}

function renderSfxToolbar(actions: RenderActions): HTMLElement {
  const panel = renderAssetSidebarPanel("sfx-toolbar-panel toolbar");
  const buttons: Array<[AppIcon, string, () => void]> = [
    [Undo2, "Undo (Ctrl/Cmd+Z)", actions.undo],
    [Redo2, "Redo (Ctrl/Cmd+Shift+Z)", actions.redo],
    [Play, "Play preview (Space)", actions.playSound],
    [Square, "Stop preview", actions.stopSound],
    [Plus, "Add command", actions.addCommand],
  ];

  for (const [icon, title, onClick] of buttons) {
    const button = createIconButton(icon, title, "tool-button");
    button.type = "button";
    button.addEventListener("click", onClick);
    panel.append(button);
  }

  return panel;
}

function renderSfxProjectProperties(state: EditorState, actions: RenderActions): HTMLElement {
  const panel = createElement("section", "sfx-asset-panel inspector-embedded-section");
  panel.append(createTextElement("h2", "Sound"));

  const idInput = createElement("input");
  idInput.type = "text";
  idInput.value = state.currentProjectId;
  idInput.spellcheck = false;
  idInput.dataset.field = "projectId";
  idInput.addEventListener("input", () => {
    const sanitizedId = sanitizeSoundId(idInput.value);
    actions.updateProjectId(sanitizedId);
  });

  const sampleRateInput = createDisabledInput("22050 Hz");
  const formatInput = createDisabledInput("16-bit mono PCM");

  panel.append(createField("ID", idInput), createField("Sample rate", sampleRateInput), createField("Format", formatInput));
  panel.append(renderPresetPanel(state, actions));
  panel.append(renderReadiness(getSoundExportReadiness(getProjectFromState(state))));
  return panel;
}

function renderSfxEditorArea(state: EditorState, actions: RenderActions): HTMLElement {
  return renderCommands(state, actions);
}

function renderSfxInspectorPanel(state: EditorState, actions: RenderActions): HTMLElement {
  const panel = renderInspectorPanelWithProperties(state, actions);
  return panel;
}

function renderInspectorPanelWithProperties(state: EditorState, actions: RenderActions): HTMLElement {
  const panel = renderInspector(state, actions);
  panel.prepend(renderSfxProjectProperties(state, actions));
  return panel;
}

function renderSfxPreview(project: SoundProject): HTMLElement {
  const preview = renderPreviewStatusArea("Audio preview");

  const waveform = createElement("div", "waveform");
  waveform.append(renderWaveform(project));

  const previewMeta = createElement("div", "preview-meta");
  previewMeta.append(createTextElement("span", "SFX"), createTextElement("strong", `${project.id} - ${project.commands.length} commands`));
  preview.append(waveform, previewMeta);

  return preview;
}

function getProjectFromState(state: EditorState): SoundProject {
  return {
    id: state.currentProjectId,
    commands: state.commands,
  };
}

function createDisabledInput(value: string): HTMLInputElement {
  const input = createElement("input");
  input.type = "text";
  input.value = value;
  input.disabled = true;

  return input;
}
