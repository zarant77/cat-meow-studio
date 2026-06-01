import { formatPresetName, soundPresets } from "../model/soundPresets.js";
import type { EditorState } from "../state/editorState.js";
import type { RenderActions } from "./appTypes.js";
import { createElement, createIconButton, createTextElement } from "./dom.js";

export function renderPresetPanel(state: EditorState, actions: RenderActions): HTMLElement {
  const panel = createElement("section", "preset-panel");
  panel.append(createTextElement("h2", "Presets"));

  const presetRow = createElement("div", "preset-row");
  const presetSelect = createElement("select");
  presetSelect.className = "preset-select";
  presetSelect.setAttribute("aria-label", "Preset");

  for (const preset of soundPresets) {
    const option = createElement("option");
    option.value = preset.id;
    option.textContent = formatPresetName(preset.id);
    option.selected = preset.id === state.selectedPresetId;
    presetSelect.append(option);
  }

  if (state.selectedPresetId === null) {
    presetSelect.selectedIndex = -1;
  } else {
    presetSelect.value = state.selectedPresetId;
  }

  presetSelect.addEventListener("change", () => actions.createFromPreset(presetSelect.value));

  const resetButton = createIconButton("↺", "Reset to selected preset");
  resetButton.disabled = state.selectedPresetId === null;
  resetButton.addEventListener("click", actions.resetToPreset);
  presetRow.append(presetSelect, resetButton);

  panel.append(presetRow);
  return panel;
}
