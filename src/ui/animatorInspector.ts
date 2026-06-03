import { Plus } from "lucide";
import type { AnimationClip, AnimationEasing, AnimationKey, AnimationProperty, AnimationTrack } from "../animation/animationTypes.js";
import { animationEasings, animationProperties } from "../animation/animationTypes.js";
import { displayValueForProperty, formatDisplayValue, getValueInputConfig, storedValueForProperty } from "../animation/animationValueFormat.js";
import { createElement, createField, createIconButton, createTextElement } from "./dom.js";

export interface AnimatorInspectorSelection {
  track: AnimationTrack | null;
  key: AnimationKey | null;
}

export interface AnimatorInspectorActions {
  selectClip: (clipId: string) => void;
  updateClip: (patch: Partial<Pick<AnimationClip, "id" | "durationMs" | "loop">>) => void;
  updateSelectedTrack: (property: AnimationProperty) => void;
  updateSelectedKey: (patch: Partial<{ timeMs: number; value: number; easing: AnimationEasing }>) => void;
  applyPreset: (presetId: string) => void;
}

export function renderAnimatorInspector(input: {
  previewSpriteId: string | null;
  clip: AnimationClip;
  selectedClip: AnimationClip | null;
  selection: AnimatorInspectorSelection;
  presetOptions: ReadonlyArray<{ id: string; label: string }>;
  actions: AnimatorInspectorActions;
}): HTMLElement {
  const root = createElement("div", "animator-inspector");
  root.append(renderSpriteSummary(input.previewSpriteId));
  root.append(renderClipSection(input.clip, input.selectedClip, input.actions));
  root.append(renderPresetSection(input.presetOptions, input.actions));
  root.append(renderTrackSection(input.selection.track, input.actions));
  root.append(renderKeySection(input.selection.track, input.selection.key, input.actions));

  return root;
}

function renderSpriteSummary(spriteId: string | null): HTMLElement {
  const section = createElement("section", "animator-inspector-section");
  section.append(createTextElement("h2", "Preview Sprite"), createTextElement("p", spriteId ?? "No preview sprite imported", "animator-inspector-value"));

  return section;
}

function renderClipSection(
  clip: AnimationClip,
  selectedClip: AnimationClip | null,
  actions: AnimatorInspectorActions,
): HTMLElement {
  const section = createElement("section", "animator-inspector-section");
  section.append(createTextElement("h2", "Animation"));

  const clipSelect = createElement("select");
  clipSelect.disabled = true;
  const option = createElement("option");
  option.value = clip.id;
  option.textContent = clip.id;
  option.selected = true;
  clipSelect.append(option);
  clipSelect.addEventListener("change", () => actions.selectClip(clipSelect.value));
  section.append(createField("Clip", clipSelect));

  const idInput = createElement("input");
  idInput.type = "text";
  idInput.value = selectedClip?.id ?? "";
  idInput.disabled = selectedClip === null;
  idInput.addEventListener("change", () => actions.updateClip({ id: idInput.value.trim() || "animation" }));

  const durationInput = createElement("input");
  durationInput.type = "number";
  durationInput.min = "1";
  durationInput.step = "1";
  durationInput.value = String(selectedClip?.durationMs ?? 0);
  durationInput.disabled = selectedClip === null;
  durationInput.addEventListener("change", () => actions.updateClip({ durationMs: toInteger(durationInput.value, selectedClip?.durationMs ?? 0) }));

  const loopInput = createElement("input");
  loopInput.type = "checkbox";
  loopInput.checked = selectedClip?.loop ?? false;
  loopInput.disabled = selectedClip === null;
  loopInput.addEventListener("change", () => actions.updateClip({ loop: loopInput.checked }));

  section.append(createField("ID", idInput), createField("Duration ms", durationInput), createField("Loop", loopInput));

  return section;
}

function renderPresetSection(
  presetOptions: ReadonlyArray<{ id: string; label: string }>,
  actions: AnimatorInspectorActions,
): HTMLElement {
  const section = createElement("section", "animator-inspector-section");
  section.append(createTextElement("h2", "Presets"));

  const row = createElement("div", "animator-preset-row");
  const select = createElement("select");
  presetOptions.forEach((preset) => {
    const option = createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    select.append(option);
  });

  const button = createIconButton(Plus, "Create clip from preset", "icon-button");
  button.addEventListener("click", () => actions.applyPreset(select.value));
  row.append(select, button);
  section.append(row);

  return section;
}

function renderTrackSection(track: AnimationTrack | null, actions: AnimatorInspectorActions): HTMLElement {
  const section = createElement("section", "animator-inspector-section");
  section.append(createTextElement("h2", "Track"));

  const propertySelect = createElement("select");
  propertySelect.disabled = track === null;
  animationProperties.forEach((property) => {
    const option = createElement("option");
    option.value = property;
    option.textContent = property;
    option.selected = track?.property === property;
    propertySelect.append(option);
  });
  propertySelect.addEventListener("change", () => {
    if (isAnimationProperty(propertySelect.value)) {
      actions.updateSelectedTrack(propertySelect.value);
    }
  });
  section.append(createField("Property", propertySelect));

  return section;
}

function renderKeySection(track: AnimationTrack | null, key: AnimationKey | null, actions: AnimatorInspectorActions): HTMLElement {
  const section = createElement("section", "animator-inspector-section");
  section.append(createTextElement("h2", "Key"));
  const property = track?.property ?? "offset_x";
  const valueConfig = getValueInputConfig(property);

  const timeInput = createElement("input");
  timeInput.type = "number";
  timeInput.min = "0";
  timeInput.step = "1";
  timeInput.value = String(key?.timeMs ?? 0);
  timeInput.disabled = key === null;
  timeInput.addEventListener("change", () => actions.updateSelectedKey({ timeMs: toInteger(timeInput.value, key?.timeMs ?? 0) }));

  const valueInput = createElement("input");
  valueInput.type = "number";
  valueInput.min = String(valueConfig.min);
  valueInput.max = String(valueConfig.max);
  valueInput.step = String(valueConfig.step);
  valueInput.value = key === null ? "0" : formatDisplayValue(displayValueForProperty(property, key.value));
  valueInput.disabled = key === null;
  valueInput.addEventListener("change", () => {
    const fallback = key === null ? 0 : displayValueForProperty(property, key.value);
    actions.updateSelectedKey({ value: storedValueForProperty(property, toNumber(valueInput.value, fallback)) });
  });

  const easingSelect = createElement("select");
  easingSelect.disabled = key === null;
  animationEasings.forEach((easing) => {
    const option = createElement("option");
    option.value = easing;
    option.textContent = easing;
    option.selected = key?.easing === easing;
    easingSelect.append(option);
  });
  easingSelect.addEventListener("change", () => {
    if (isAnimationEasing(easingSelect.value)) {
      actions.updateSelectedKey({ easing: easingSelect.value });
    }
  });

  section.append(createField("timeMs", timeInput), createField(valueConfig.label, valueInput), createField("Easing", easingSelect));

  return section;
}

function toInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function isAnimationProperty(value: string): value is AnimationProperty {
  return animationProperties.includes(value as AnimationProperty);
}

function isAnimationEasing(value: string): value is AnimationEasing {
  return animationEasings.includes(value as AnimationEasing);
}
