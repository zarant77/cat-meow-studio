import { generateMusicSamples } from "../audio/musicGenerator.js";
import { isMusicWave, musicWaves } from "../model/musicProject.js";
import { getSelectedMusicNote, type MusicEditorState } from "../state/musicEditorState.js";
import { appendChildren, createElement, createField, createIconButton, createTextElement } from "./dom.js";
import { renderWaveformSamples } from "./renderWaveform.js";
import type { ModeSurface, MusicRenderActions, RenderActions } from "./appTypes.js";
import { renderAssetSidebarPanel, renderEditorArea, renderInspectorPanel, renderPreviewStatusArea } from "./renderShell.js";

export function renderMusicWorkspaceSurface(
  state: MusicEditorState,
  actions: MusicRenderActions,
  shellActions: RenderActions,
): Omit<ModeSurface, "previewStatusArea"> {
  return {
    assetPanel: renderMusicToolbar(actions, shellActions),
    editorArea: renderMusicTracker(state, actions),
    inspectorPanel: renderMusicInspectorWithProperties(state, actions),
  };
}

export function renderMusicPreview(state: MusicEditorState): HTMLElement {
  const preview = renderPreviewStatusArea("Music preview");

  const waveform = createElement("div", "waveform");
  waveform.append(renderWaveformSamples(generateMusicSamples(state.project)));

  const previewMeta = createElement("div", "preview-meta");
  previewMeta.append(
    createTextElement("span", "Music"),
    createTextElement("strong", `${state.project.id} - ${state.project.bpm} bpm - ${state.project.lengthTicks} ticks`),
  );
  preview.append(waveform, previewMeta);

  return preview;
}

function renderMusicProjectPanel(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const panel = createElement("section", "music-panel inspector-embedded-section");
  panel.append(createTextElement("h2", "Music"));
  panel.append(createTextField("ID", state.project.id, "musicId", (value) => actions.updateProject({ id: value })));

  const timingGrid = createElement("div", "field-grid");
  timingGrid.append(
    createNumberField("BPM", state.project.bpm, "musicBpm", (value) => actions.updateProject({ bpm: value })),
    createNumberField("Ticks/beat", state.project.ticksPerBeat, "musicTicksPerBeat", (value) =>
      actions.updateProject({ ticksPerBeat: value }),
    ),
    createNumberField("Length ticks", state.project.lengthTicks, "musicLengthTicks", (value) =>
      actions.updateProject({ lengthTicks: value }),
    ),
  );
  panel.append(timingGrid);

  const instrumentList = createElement("section", "music-instruments");
  const instrumentTitle = createElement("div", "panel-title compact-title");
  const addInstrumentButton = createIconButton("+", "Add instrument");
  addInstrumentButton.addEventListener("click", actions.addInstrument);
  instrumentTitle.append(createTextElement("h2", "Instruments"), addInstrumentButton);
  instrumentList.append(instrumentTitle);
  const instrumentRows = createElement("div", "panel-scroll music-instrument-list");
  state.project.instruments.forEach((instrument, index) => {
    const button = createTextElement(
      "button",
      `${index + 1}. ${instrument.id}`,
      `list-row music-list-button${index === state.selectedInstrumentIndex ? " is-selected" : ""}`,
    );
    button.type = "button";
    button.addEventListener("click", () => actions.selectInstrument(index));
    instrumentRows.append(button);
  });
  instrumentList.append(instrumentRows);
  panel.append(instrumentList);

  return panel;
}

function renderMusicToolbar(actions: MusicRenderActions, shellActions: RenderActions): HTMLElement {
  const panel = renderAssetSidebarPanel("music-toolbar-panel toolbar");
  const buttons: Array<[string, string, () => void]> = [
    ["↶", "Undo", shellActions.undo],
    ["↷", "Redo", shellActions.redo],
    ["▶", "Play preview", shellActions.playSound],
    ["■", "Stop preview", shellActions.stopSound],
    ["+", "Add note", actions.addNote],
    ["◉", "Add instrument", actions.addInstrument],
  ];

  for (const [label, title, onClick] of buttons) {
    const button = createTextElement("button", label, "tool-button");
    button.type = "button";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", onClick);
    panel.append(button);
  }

  return panel;
}

function renderMusicTracker(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const panel = renderEditorArea("music-notes");
  const title = createElement("div", "panel-title");
  const addButton = createIconButton("+", "Add note");
  addButton.addEventListener("click", actions.addNote);
  title.append(createTextElement("h2", "Notes"), addButton);
  panel.append(title);

  const grid = createElement("div", "panel-scroll tracker-grid music-note-grid");
  appendChildren(grid, [
    createTextElement("strong", "Tick"),
    createTextElement("strong", "Inst"),
    createTextElement("strong", "Note"),
    createTextElement("strong", "Len"),
    createTextElement("strong", "Vol"),
  ]);

  const notes = [...state.project.notes].sort((left, right) => left.startTick - right.startTick || left.note - right.note);
  for (const note of notes) {
    const isSelected = note.id === state.selectedNoteId;
    const rowClassName = `list-row tracker-row${isSelected ? " is-selected" : ""}`;
    const rowButton = createTextElement("button", String(note.startTick), rowClassName);
    rowButton.type = "button";
    rowButton.addEventListener("click", () => actions.selectNote(note.id));
    grid.append(
      rowButton,
      createTextElement("span", String(note.instrument + 1), rowClassName),
      createTextElement("span", getNoteName(note.note), rowClassName),
      createTextElement("span", String(note.durationTicks), rowClassName),
      createTextElement("span", String(note.volume), rowClassName),
    );
  }

  panel.append(grid);
  return panel;
}

function renderMusicInspector(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const panel = renderInspectorPanel("music-inspector");
  const selectedNote = getSelectedMusicNote(state);
  const selectedInstrument =
    state.selectedInstrumentIndex === null ? undefined : state.project.instruments[state.selectedInstrumentIndex];
  const title = createElement("div", "panel-title");
  const deleteButton = createIconButton("×", "Delete selected note", "icon-button danger");
  deleteButton.disabled = selectedNote === null;
  deleteButton.addEventListener("click", actions.deleteNote);
  title.append(createTextElement("h2", "Music edit"), deleteButton);
  panel.append(title);

  if (selectedNote !== null) {
    panel.append(createTextElement("h2", "Note"));
    panel.append(createNumberField("Start tick", selectedNote.startTick, "noteStart", (value) => actions.updateNote({ startTick: value })));
    panel.append(createNumberField("Pitch", selectedNote.note, "notePitch", (value) => actions.updateNote({ note: value })));
    panel.append(createNumberField("Duration", selectedNote.durationTicks, "noteDuration", (value) => actions.updateNote({ durationTicks: value })));
    panel.append(createNumberField("Volume", selectedNote.volume, "noteVolume", (value) => actions.updateNote({ volume: value })));
    panel.append(renderNoteInstrumentField(state, selectedNote.instrument, actions));
  } else {
    panel.append(createTextElement("p", "Select or add a note.", "empty-state"));
  }

  if (selectedInstrument !== undefined) {
    const instrumentTitle = createElement("div", "panel-title compact-title");
    const deleteInstrumentButton = createIconButton("×", "Delete selected instrument", "icon-button danger");
    deleteInstrumentButton.disabled = state.project.instruments.length <= 1;
    deleteInstrumentButton.addEventListener("click", actions.deleteInstrument);
    instrumentTitle.append(createTextElement("h2", "Instrument"), deleteInstrumentButton);
    panel.append(instrumentTitle);
    panel.append(createTextField("Inst ID", selectedInstrument.id, "instId", (value) => actions.updateInstrument({ id: value })));
    const waveSelect = createElement("select");
    for (const wave of musicWaves) {
      const option = createElement("option");
      option.value = wave;
      option.textContent = wave;
      option.selected = selectedInstrument.wave === wave;
      waveSelect.append(option);
    }
    waveSelect.addEventListener("change", () => {
      if (isMusicWave(waveSelect.value)) {
        actions.updateInstrument({ wave: waveSelect.value });
      }
    });
    panel.append(createField("Wave", waveSelect));
    panel.append(createNumberField("Inst volume", selectedInstrument.volume, "instVolume", (value) => actions.updateInstrument({ volume: value })));
    panel.append(createNumberField("Attack ms", selectedInstrument.attackMs, "instAttack", (value) => actions.updateInstrument({ attackMs: value })));
    panel.append(createNumberField("Decay ms", selectedInstrument.decayMs, "instDecay", (value) => actions.updateInstrument({ decayMs: value })));
  }

  return panel;
}

function renderMusicInspectorWithProperties(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const panel = renderMusicInspector(state, actions);
  panel.prepend(renderMusicProjectPanel(state, actions));

  return panel;
}

function renderNoteInstrumentField(state: MusicEditorState, selectedInstrumentIndex: number, actions: MusicRenderActions): HTMLLabelElement {
  const select = createElement("select");
  select.dataset.field = "noteInstrument";

  state.project.instruments.forEach((instrument, index) => {
    const option = createElement("option");
    option.value = String(index);
    option.textContent = `${index + 1}. ${instrument.id}`;
    option.selected = selectedInstrumentIndex === index;
    select.append(option);
  });

  select.addEventListener("change", () => actions.updateNote({ instrument: Number(select.value) }));

  return createField("Instrument", select);
}

function createTextField(label: string, value: string, field: string, onInput: (value: string) => void): HTMLLabelElement {
  const input = createElement("input");
  input.type = "text";
  input.value = value;
  input.dataset.field = field;
  input.addEventListener("input", () => onInput(input.value));

  return createField(label, input);
}

function createNumberField(label: string, value: number, field: string, onInput: (value: number) => void): HTMLLabelElement {
  const input = createElement("input");
  input.type = "number";
  input.value = String(value);
  input.dataset.field = field;
  input.addEventListener("input", () => onInput(Number(input.value)));

  return createField(label, input);
}

function getNoteName(note: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const name = names[((note % 12) + 12) % 12] ?? "C";
  const octave = Math.floor(note / 12) - 1;

  return `${name}${octave}`;
}
