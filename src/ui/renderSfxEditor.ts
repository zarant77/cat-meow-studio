import { getSoundExportReadiness } from "../export/soundReadiness.js";
import type { SoundProject } from "../model/soundProject.js";
import type { EditorState } from "../state/editorState.js";
import { sanitizeSoundId } from "../utils/validation.js";
import type { ModeSurface, RenderActions } from "./appTypes.js";
import { createElement, createField, createTextElement } from "./dom.js";
import { renderCommands } from "./renderCommands.js";
import { renderInspector } from "./renderInspector.js";
import { renderPresetPanel } from "./renderPresets.js";
import { renderReadiness } from "./renderReadiness.js";
import { renderAssetSidebarPanel, renderPreviewStatusArea } from "./renderShell.js";
import { renderWaveform } from "./renderWaveform.js";

export function renderSfxSurface(state: EditorState, actions: RenderActions): ModeSurface {
  return {
    assetPanel: renderSfxAssetPanel(state, actions),
    editorArea: renderSfxEditorArea(state, actions),
    inspectorPanel: renderSfxInspectorPanel(state, actions),
    previewStatusArea: renderSfxPreview(getProjectFromState(state)),
  };
}

function renderSfxAssetPanel(state: EditorState, actions: RenderActions): HTMLElement {
  const panel = renderAssetSidebarPanel("sfx-asset-panel");
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
  return renderInspector(state, actions);
}

function renderSfxPreview(project: SoundProject): HTMLElement {
  const preview = renderPreviewStatusArea("Audio preview");

  const waveform = createElement("div", "waveform");
  waveform.append(renderWaveform(project));

  const previewMeta = createElement("div", "preview-meta");
  previewMeta.append(createTextElement("span", "Preview"), createTextElement("strong", `${project.id}.sound`));
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
