import { Plus, Trash2 } from "lucide";
import type { AnimationClip, AnimationEasing, AnimationProperty } from "../animation/animationTypes.js";
import { animationEasings, animationProperties } from "../animation/animationTypes.js";
import { displayValueForProperty, formatDisplayValue, getValueInputConfig, storedValueForProperty } from "../animation/animationValueFormat.js";
import { createElement, createIconButton, createTextElement } from "./dom.js";

export interface AnimatorTimelineSelection {
  trackIndex: number | null;
  keyIndex: number | null;
}

export interface AnimatorTimelineActions {
  addTrack: () => void;
  deleteTrack: (trackIndex: number) => void;
  updateTrackProperty: (trackIndex: number, property: AnimationProperty) => void;
  addKey: (trackIndex: number) => void;
  deleteKey: (trackIndex: number, keyIndex: number) => void;
  selectKey: (trackIndex: number, keyIndex: number) => void;
  updateKey: (trackIndex: number, keyIndex: number, patch: Partial<{ timeMs: number; value: number; easing: AnimationEasing }>) => void;
}

export function renderAnimatorTimeline(
  clip: AnimationClip | null,
  selection: AnimatorTimelineSelection,
  actions: AnimatorTimelineActions,
): HTMLElement {
  const root = createElement("section", "animator-timeline");
  const header = createElement("div", "animator-section-header");
  header.append(createTextElement("h2", "Timeline"));

  const addTrackButton = createIconButton(Plus, "Add track", "icon-button");
  addTrackButton.disabled = clip === null;
  addTrackButton.addEventListener("click", actions.addTrack);
  header.append(addTrackButton);
  root.append(header);

  if (clip === null) {
    root.append(createTextElement("p", "Create or import an animation clip.", "animator-empty"));
    return root;
  }

  if (clip.tracks.length === 0) {
    root.append(createTextElement("p", "No tracks yet.", "animator-empty"));
    return root;
  }

  const table = createElement("table", "animator-key-table");
  const thead = createElement("thead");
  const headerRow = createElement("tr");
  ["property", "timeMs", "value", "easing", "actions"].forEach((label) => {
    headerRow.append(createTextElement("th", label));
  });
  thead.append(headerRow);

  const tbody = createElement("tbody");
  clip.tracks.forEach((track, trackIndex) => {
    if (track.keys.length === 0) {
      const row = createElement("tr");
      row.append(
        createPropertyCell(track.property, (property) => actions.updateTrackProperty(trackIndex, property)),
        createEmptyCell("No keys"),
        createEmptyCell(""),
        createEmptyCell(""),
        createTrackActionsCell(trackIndex, actions),
      );
      tbody.append(row);
      return;
    }

    track.keys.forEach((key, keyIndex) => {
      const row = createElement("tr", selection.trackIndex === trackIndex && selection.keyIndex === keyIndex ? "is-selected" : "");
      row.addEventListener("click", () => actions.selectKey(trackIndex, keyIndex));
      row.append(
        createPropertyCell(track.property, (property) => actions.updateTrackProperty(trackIndex, property)),
        createNumberCell(key.timeMs, 0, 100000, (timeMs) => actions.updateKey(trackIndex, keyIndex, { timeMs })),
        createValueCell(track.property, key.value, (value) => actions.updateKey(trackIndex, keyIndex, { value })),
        createEasingCell(key.easing, (easing) => actions.updateKey(trackIndex, keyIndex, { easing })),
        createKeyActionsCell(trackIndex, keyIndex, actions),
      );
      tbody.append(row);
    });
  });
  table.append(thead, tbody);
  root.append(table);

  return root;
}

function createPropertyCell(value: AnimationProperty, onChange: (value: AnimationProperty) => void): HTMLTableCellElement {
  const cell = createElement("td");
  const select = createElement("select");
  animationProperties.forEach((property) => {
    const option = createElement("option");
    option.value = property;
    option.textContent = property;
    option.selected = property === value;
    select.append(option);
  });
  select.addEventListener("change", () => {
    if (isAnimationProperty(select.value)) {
      onChange(select.value);
    }
  });
  cell.append(select);

  return cell;
}

function createNumberCell(value: number, min: number, max: number, onChange: (value: number) => void): HTMLTableCellElement {
  const cell = createElement("td");
  const input = createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  input.value = String(value);
  input.addEventListener("change", () => onChange(toInteger(input.value, value)));
  cell.append(input);

  return cell;
}

function createValueCell(property: AnimationProperty, value: number, onChange: (value: number) => void): HTMLTableCellElement {
  const cell = createElement("td");
  const input = createElement("input");
  const config = getValueInputConfig(property);
  input.type = "number";
  input.min = String(config.min);
  input.max = String(config.max);
  input.step = String(config.step);
  input.title = config.label;
  input.value = formatDisplayValue(displayValueForProperty(property, value));
  input.addEventListener("change", () => onChange(storedValueForProperty(property, toNumber(input.value, displayValueForProperty(property, value)))));
  cell.append(input);

  return cell;
}

function createEasingCell(value: AnimationEasing, onChange: (value: AnimationEasing) => void): HTMLTableCellElement {
  const cell = createElement("td");
  const select = createElement("select");
  animationEasings.forEach((easing) => {
    const option = createElement("option");
    option.value = easing;
    option.textContent = easing;
    option.selected = easing === value;
    select.append(option);
  });
  select.addEventListener("change", () => {
    if (isAnimationEasing(select.value)) {
      onChange(select.value);
    }
  });
  cell.append(select);

  return cell;
}

function createTrackActionsCell(trackIndex: number, actions: AnimatorTimelineActions): HTMLTableCellElement {
  const cell = createElement("td", "animator-table-actions");
  const addButton = createIconButton(Plus, "Add key", "icon-button");
  const deleteButton = createIconButton(Trash2, "Delete track", "icon-button danger");
  addButton.addEventListener("click", (event) => {
    event.stopPropagation();
    actions.addKey(trackIndex);
  });
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    actions.deleteTrack(trackIndex);
  });
  cell.append(addButton, deleteButton);

  return cell;
}

function createKeyActionsCell(trackIndex: number, keyIndex: number, actions: AnimatorTimelineActions): HTMLTableCellElement {
  const cell = createTrackActionsCell(trackIndex, actions);
  const deleteKeyButton = createIconButton(Trash2, "Delete key", "icon-button danger");
  deleteKeyButton.addEventListener("click", (event) => {
    event.stopPropagation();
    actions.deleteKey(trackIndex, keyIndex);
  });
  cell.append(deleteKeyButton);

  return cell;
}

function createEmptyCell(text: string): HTMLTableCellElement {
  return createTextElement("td", text, "animator-muted-cell");
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
