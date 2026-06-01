import { RotateCcw } from "lucide";
import { soundWaves } from "../model/soundProject.js";
import { getSelectedCommand, type EditorState } from "../state/editorState.js";
import {
  formatWaveLabel,
  isSoundWave,
  parseClampedInteger,
  parseMinimumInteger,
} from "../utils/validation.js";
import { createElement, createField, createIconButton, createTextElement } from "./dom.js";
import type { RenderActions } from "./appTypes.js";

export function renderInspector(state: EditorState, actions: RenderActions): HTMLElement {
  const inspector = createElement("aside", "panel inspector-panel sfx-inspector-panel");
  const panelTitle = createElement("div", "panel-title");
  const resetButton = createIconButton(RotateCcw, "Reset command to defaults");
  resetButton.disabled = state.selectedCommandId === null;
  resetButton.addEventListener("click", actions.resetSelectedCommand);
  panelTitle.append(createTextElement("h2", "Command"), resetButton);
  inspector.append(panelTitle);

  const command = getSelectedCommand(state);

  if (command === null) {
    inspector.append(createTextElement("p", "Select or add a command.", "empty-state"));
    return inspector;
  }

  const waveSelect = createElement("select");
  waveSelect.dataset.field = "wave";
  for (const wave of soundWaves) {
    const option = createElement("option");
    option.value = wave;
    option.textContent = formatWaveLabel(wave);
    option.selected = command.wave === wave;
    waveSelect.append(option);
  }
  waveSelect.addEventListener("change", () => {
    if (isSoundWave(waveSelect.value)) {
      actions.updateSelectedCommand({ wave: waveSelect.value });
    }
  });

  inspector.append(createField("Wave", waveSelect));
  inspector.append(
    createNumberField("Frequency start", "frequencyStart", command.frequencyStart, (value) =>
      actions.updateSelectedCommand({
        frequencyStart: parseMinimumInteger(value, 1, command.frequencyStart),
      }),
    ),
  );
  inspector.append(
    createNumberField("Frequency end", "frequencyEnd", command.frequencyEnd, (value) =>
      actions.updateSelectedCommand({
        frequencyEnd: parseMinimumInteger(value, 1, command.frequencyEnd),
      }),
    ),
  );
  inspector.append(
    createNumberField("Duration, ms", "durationMs", command.durationMs, (value) =>
      actions.updateSelectedCommand({
        durationMs: parseMinimumInteger(value, 1, command.durationMs),
      }),
    ),
  );
  inspector.append(createVolumeField(command.volume, actions));

  return inspector;
}

function createNumberField(
  label: string,
  fieldName: string,
  value: number,
  onInput: (value: string) => void,
): HTMLLabelElement {
  const input = createElement("input");
  input.type = "number";
  input.min = "1";
  input.value = String(value);
  input.dataset.field = fieldName;
  input.addEventListener("input", () => onInput(input.value));

  return createField(label, input);
}

function createVolumeField(value: number, actions: RenderActions): HTMLLabelElement {
  const wrapper = createElement("div", "range-field");
  const input = createElement("input");
  const output = createTextElement("strong", String(value));
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.value = String(value);
  input.dataset.field = "volume";
  input.addEventListener("input", () => {
    const volume = parseClampedInteger(input.value, 0, 100, value);
    output.textContent = String(volume);
    actions.updateSelectedCommand({ volume });
  });

  wrapper.append(input, output);

  return createField("Volume", wrapper);
}
