import { CirclePlus, LocateFixed, Pause, Play, Plus, Repeat, Redo2, Square, Trash2, Undo2 } from "lucide";
import { isMusicWave, musicWaves, normalizeMusicLoop } from "../model/musicProject.js";
import { getTrackVolumeStats } from "../model/musicLoudness.js";
import { getSelectedMusicNote, type MusicEditorState } from "../state/musicEditorState.js";
import { appendChildren, createElement, createField, createIconButton, createTextElement } from "./dom.js";
import type { AppIcon } from "./icons.js";
import { renderWaveformSamples } from "./renderWaveform.js";
import type { ModeSurface, MusicRenderActions, RenderActions } from "./appTypes.js";
import { renderAssetSidebarPanel, renderEditorArea, renderInspectorPanel, renderPreviewStatusArea } from "./renderShell.js";

export function renderMusicWorkspaceSurface(
  state: MusicEditorState,
  actions: MusicRenderActions,
  shellActions: RenderActions,
): Omit<ModeSurface, "previewStatusArea"> {
  return {
    assetPanel: renderMusicSidebar(state, actions, shellActions),
    editorArea: renderMusicTracker(state, actions),
    inspectorPanel: renderMusicInspectorWithProperties(state, actions),
  };
}

export function renderMusicPreview(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const preview = renderPreviewStatusArea("Music preview");

  const waveform = createElement("div", "waveform music-waveform-preview");
  waveform.append(
    renderWaveformSamples(state.previewSamples),
    renderLoopOverlay(state.project.lengthTicks, state.project.loop),
    renderMusicPlayhead(state.project.lengthTicks, state.currentPlaybackTick),
  );
  bindSeekableTimeline(waveform, state.project.lengthTicks, actions);

  const previewMeta = createElement("div", "preview-meta");
  previewMeta.append(
    createTextElement("span", "Music"),
    createTextElement("strong", `${state.project.id} - ${state.project.bpm} bpm - ${state.project.lengthTicks} ticks`),
    createTextElement("span", state.isPreviewRendering ? `Rendering ${state.previewQuality}` : `Preview ${state.previewQuality}`),
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
  panel.append(renderMusicLoopControls(state, actions));
  panel.append(renderMusicLoudnessControls(state, actions));
  panel.append(renderMusicSelectionControls(state, actions));

  return panel;
}

function renderMusicLoudnessControls(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const section = createElement("section", "music-loudness-controls");
  const stats = getTrackVolumeStats(state.project);
  const normalizeToggle = createElement("input");
  normalizeToggle.type = "checkbox";
  normalizeToggle.checked = state.project.normalizeVolume;
  normalizeToggle.dataset.field = "musicNormalizeVolume";
  normalizeToggle.addEventListener("change", () => actions.updateProject({ normalizeVolume: normalizeToggle.checked }));

  section.append(createTextElement("h2", "Loudness"));
  section.append(createNumberField("Track volume", state.project.volume, "musicVolume", (value) => actions.updateProject({ volume: value }), {
    min: 0,
    max: 4,
    step: 0.05,
  }));
  section.append(createField("Normalize volume", normalizeToggle));

  if (state.project.normalizeVolume) {
    section.append(
      createNumberField(
        "Target avg volume",
        state.project.targetAverageVolume,
        "musicTargetAverageVolume",
        (value) => actions.updateProject({ targetAverageVolume: value }),
        { min: 0, max: 100, step: 1 },
      ),
    );
    section.append(
      createNumberField(
        "Max gain",
        state.project.maxVolumeGain,
        "musicMaxVolumeGain",
        (value) => actions.updateProject({ maxVolumeGain: value }),
        { min: 1, max: 8, step: 0.1 },
      ),
    );
  }

  section.append(
    createTextElement(
      "p",
      `Avg volume: ${stats.averageBefore.toFixed(1)} -> ${stats.averageAfter.toFixed(1)}. Applied gain: ${stats.normalizationGain.toFixed(2)}x`,
      "music-loudness-status",
    ),
  );

  return section;
}

function renderMusicSidebar(state: MusicEditorState, actions: MusicRenderActions, shellActions: RenderActions): HTMLElement {
  const panel = renderAssetSidebarPanel("music-sidebar-panel");
  panel.append(renderMusicToolbar(state, actions, shellActions), renderMusicInstrumentList(state, actions));

  return panel;
}

function renderMusicSelectionControls(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const section = createElement("section", "music-selection-controls");
  const title = createElement("div", "panel-title compact-title");
  const clearButton = createTextElement("button", "Clear", "secondary-button");
  clearButton.type = "button";
  clearButton.disabled = state.selectedNoteIds.length === 0;
  clearButton.addEventListener("click", actions.clearNoteSelection);
  title.append(createTextElement("h2", "Selection"), clearButton);

  const fields = createElement("div", "field-grid");
  fields.append(
    createNumberField("Start tick", state.selectionStartTick, "musicSelectionStart", (value) =>
      actions.updateSelectionRange(value, state.selectionEndTick),
    ),
    createNumberField("End tick", state.selectionEndTick, "musicSelectionEnd", (value) =>
      actions.updateSelectionRange(state.selectionStartTick, value),
    ),
  );

  const selectRangeButton = createTextElement("button", "Select notes in range", "primary-button");
  selectRangeButton.type = "button";
  selectRangeButton.addEventListener("click", actions.selectNotesInRange);

  const deleteSelectedButton = createTextElement("button", `Delete selected notes (${state.selectedNoteIds.length})`, "danger-button");
  deleteSelectedButton.type = "button";
  deleteSelectedButton.disabled = state.selectedNoteIds.length === 0;
  deleteSelectedButton.addEventListener("click", actions.deleteNote);

  const deleteRangeButton = createTextElement("button", "Delete notes in range", "danger-button");
  deleteRangeButton.type = "button";
  deleteRangeButton.addEventListener("click", actions.deleteNotesInRange);

  const emptyIntroTicks = getEmptyIntroTicks(state);
  const trimIntroButton = createTextElement("button", "Trim empty intro", "secondary-button");
  trimIntroButton.type = "button";
  trimIntroButton.title = "Shift all notes left so the first note starts at tick 0.";
  trimIntroButton.disabled = emptyIntroTicks <= 0;
  trimIntroButton.addEventListener("click", actions.trimEmptyIntro);

  const actionsRow = createElement("div", "music-selection-actions");
  actionsRow.append(selectRangeButton, deleteSelectedButton, deleteRangeButton, trimIntroButton);
  section.append(
    title,
    fields,
    actionsRow,
    createTextElement("p", `Selected notes: ${state.selectedNoteIds.length}`, "music-selection-status"),
    createTextElement("p", emptyIntroTicks > 0 ? `Empty intro: ${emptyIntroTicks} ticks` : "No empty intro detected.", "music-selection-status"),
  );

  return section;
}

function getEmptyIntroTicks(state: MusicEditorState): number {
  if (state.project.notes.length === 0) {
    return 0;
  }

  return Math.max(0, Math.min(...state.project.notes.map((note) => note.startTick)));
}

function renderMusicToolbar(state: MusicEditorState, actions: MusicRenderActions, shellActions: RenderActions): HTMLElement {
  const panel = createElement("section", "music-toolbar-panel toolbar");

  const buttons: Array<[AppIcon, string, () => void]> = [
    [Undo2, "Undo (Ctrl/Cmd+Z)", shellActions.undo],
    [Redo2, "Redo (Ctrl/Cmd+Shift+Z)", shellActions.redo],
    [
      state.isPreviewPlaying ? Pause : Play,
      state.isPreviewPlaying ? "Pause preview (Space)" : "Play preview (Space)",
      shellActions.playSound,
    ],
    [Repeat, "Play loop", shellActions.playMusicLoop],
    [LocateFixed, "Go to current playback position", shellActions.goToCurrentMusicPosition],
    [Square, "Stop preview", shellActions.stopSound],
    [Plus, "Add note", actions.addNote],
    [CirclePlus, "Add instrument", actions.addInstrument],
  ];

  for (const [icon, title, onClick] of buttons) {
    const button = createIconButton(icon, title, "tool-button");
    button.type = "button";
    button.addEventListener("click", onClick);
    panel.append(button);
  }

  return panel;
}

function renderMusicInstrumentList(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const instrumentList = createElement("section", "music-instruments");
  const instrumentTitle = createElement("div", "panel-title compact-title");
  const addInstrumentButton = createIconButton(Plus, "Add instrument");
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

  return instrumentList;
}

function renderMusicTracker(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const panel = renderEditorArea("music-notes");
  const title = createElement("div", "panel-title");
  const addButton = createIconButton(Plus, "Add note");
  addButton.addEventListener("click", actions.addNote);
  title.append(createTextElement("h2", "Notes"), addButton);
  panel.append(title, renderMusicTimeline(state, actions));

  const grid = createElement("div", "panel-scroll tracker-grid music-note-grid");
  appendChildren(grid, [
    createTextElement("strong", "Sel"),
    createTextElement("strong", "Tick"),
    createTextElement("strong", "Inst"),
    createTextElement("strong", "Note"),
    createTextElement("strong", "Len"),
    createTextElement("strong", "Vol"),
  ]);

  const notes = [...state.project.notes].sort(
    (left, right) => left.startTick - right.startTick || left.instrument - right.instrument || left.note - right.note || left.id.localeCompare(right.id),
  );
  for (const note of notes) {
    const isSelected = state.selectedNoteIds.includes(note.id);
    const isPlaying = state.playingNoteIds.includes(note.id);
    const rowClassName = `list-row tracker-row${isSelected ? " is-selected" : ""}${isPlaying ? " is-playing" : ""}`;
    grid.append(
      createNoteSelectButton(note, rowClassName, actions),
      createInlineNumberInput(note.id, "tick", note.startTick, rowClassName, actions, (value) => ({ startTick: value })),
      createInlineInstrumentSelect(state, note, rowClassName, actions),
      createInlineNoteInput(note, rowClassName, actions),
      createInlineNumberInput(note.id, "duration", note.durationTicks, rowClassName, actions, (value) => ({
        durationTicks: value,
      })),
      createInlineNumberInput(note.id, "volume", note.volume, rowClassName, actions, (value) => ({ volume: value })),
    );
  }

  panel.append(grid);
  return panel;
}

function renderMusicTimeline(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const timeline = createElement("section", "music-timeline");
  const ruler = createElement("div", "music-timeline-ruler");
  const lanes = createElement("div", "music-timeline-lanes");
  const lengthTicks = Math.max(1, state.project.lengthTicks);
  const beatStep = Math.max(1, state.project.ticksPerBeat);
  const loop = normalizeMusicLoop(state.project.loop, lengthTicks);

  for (let tick = 0; tick <= lengthTicks; tick += beatStep) {
    const isBar = tick % (beatStep * 4) === 0;
    const marker = createTextElement("span", isBar ? String(tick) : "", isBar ? "is-bar" : "");
    marker.style.left = `${(tick / lengthTicks) * 100}%`;
    ruler.append(marker);
  }

  ruler.append(renderLoopOverlay(lengthTicks, loop));
  lanes.append(
    renderLoopOverlay(lengthTicks, loop),
    renderMusicPlayhead(lengthTicks, state.currentPlaybackTick),
    renderLoopMarker("start", lengthTicks, loop, actions),
    renderLoopMarker("end", lengthTicks, loop, actions),
  );
  bindSeekableTimeline(lanes, lengthTicks, actions);

  state.project.instruments.forEach((instrument, instrumentIndex) => {
    const lane = createElement("div", "music-timeline-lane");
    const label = createTextElement("span", instrument.id, "music-timeline-lane-label");
    const notes = state.project.notes.filter((note) => note.instrument === instrumentIndex);

    lane.append(label);
    for (const note of notes) {
      const noteButton = createTextElement(
        "button",
        getNoteName(note.note),
        `music-timeline-note instrument-${instrumentIndex % 5}${state.selectedNoteIds.includes(note.id) ? " is-selected" : ""}${
          state.playingNoteIds.includes(note.id) ? " is-playing" : ""
        }`,
      );
      noteButton.type = "button";
      noteButton.style.left = `${(note.startTick / lengthTicks) * 100}%`;
      noteButton.style.width = `${Math.max(1.8, (note.durationTicks / lengthTicks) * 100)}%`;
      noteButton.addEventListener("click", (event) => actions.selectNote(note.id, getNoteSelectionOptions(event)));
      lane.append(noteButton);
    }
    lanes.append(lane);
  });

  timeline.append(ruler, lanes);
  return timeline;
}

function createNoteSelectButton(
  note: { id: string; startTick: number; note: number },
  className: string,
  actions: MusicRenderActions,
): HTMLButtonElement {
  const button = createTextElement("button", "•", `${className} tracker-select-button`);
  button.type = "button";
  button.title = `Select ${getNoteName(note.note)} at tick ${note.startTick}`;
  button.addEventListener("click", (event) => actions.selectNote(note.id, getNoteSelectionOptions(event)));

  return button;
}

function renderMusicPlayhead(lengthTicks: number, currentTick: number): HTMLElement {
  const playhead = createElement("div", "music-playhead");
  const tick = Math.max(0, Math.min(Math.max(1, lengthTicks), currentTick));

  playhead.style.left = "0";
  playhead.style.transform = "translateX(-1px)";
  playhead.title = `Playback tick ${Math.round(tick)}`;

  return playhead;
}

function bindSeekableTimeline(element: HTMLElement, lengthTicks: number, actions: MusicRenderActions): void {
  const seekFromClientX = (clientX: number): void => {
    const rect = element.getBoundingClientRect();
    const ratio = rect.width <= 0 ? 0 : Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    actions.seekPlayback(Math.round(ratio * Math.max(1, lengthTicks)));
  };

  element.addEventListener("pointerdown", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest("button")) {
      return;
    }

    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX);

    const onPointerMove = (moveEvent: PointerEvent): void => seekFromClientX(moveEvent.clientX);
    const onPointerUp = (upEvent: PointerEvent): void => {
      seekFromClientX(upEvent.clientX);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.releasePointerCapture(upEvent.pointerId);
    };

    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp, { once: true });
  });
}

function renderMusicInspector(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const panel = renderInspectorPanel("music-inspector");
  const selectedNote = getSelectedMusicNote(state);
  const selectedInstrument = state.selectedInstrumentIndex === null ? undefined : state.project.instruments[state.selectedInstrumentIndex];
  const title = createElement("div", "panel-title");
  const deleteButton = createIconButton(Trash2, "Delete selected notes (Delete)", "icon-button danger");
  deleteButton.disabled = state.selectedNoteIds.length === 0;
  deleteButton.addEventListener("click", actions.deleteNote);
  title.append(createTextElement("h2", "Music edit"), deleteButton);
  panel.append(title);

  if (selectedNote !== null) {
    panel.append(createTextElement("h2", "Note"));
    panel.append(
      createNumberField("Start tick", selectedNote.startTick, "noteStart", (value) =>
        actions.updateNote(selectedNote.id, { startTick: value }),
      ),
    );
    panel.append(
      createTextField("Pitch", getNoteName(selectedNote.note), "notePitch", (value) => {
        const note = parseNoteValue(value);

        if (note !== null) {
          actions.updateNote(selectedNote.id, { note });
        }
      }),
    );
    panel.append(
      createNumberField("Duration", selectedNote.durationTicks, "noteDuration", (value) =>
        actions.updateNote(selectedNote.id, { durationTicks: value }),
      ),
    );
    panel.append(
      createNumberField("Volume", selectedNote.volume, "noteVolume", (value) => actions.updateNote(selectedNote.id, { volume: value })),
    );
    panel.append(renderNoteInstrumentField(state, selectedNote.id, selectedNote.instrument, actions));
  } else if (state.selectedNoteIds.length > 1) {
    panel.append(createTextElement("h2", "Notes"));
    panel.append(createTextElement("p", `Selected notes: ${state.selectedNoteIds.length}`, "empty-state"));
    const deleteSelectedButton = createTextElement("button", "Delete selected notes", "danger-button");
    deleteSelectedButton.type = "button";
    deleteSelectedButton.addEventListener("click", actions.deleteNote);
    panel.append(deleteSelectedButton);
  } else {
    panel.append(createTextElement("p", "Select or add a note.", "empty-state"));
  }

  if (selectedInstrument !== undefined) {
    const instrumentTitle = createElement("div", "panel-title compact-title");
    const deleteInstrumentButton = createIconButton(Trash2, "Delete selected instrument", "icon-button danger");
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
    panel.append(
      createNumberField("Inst volume", selectedInstrument.volume, "instVolume", (value) => actions.updateInstrument({ volume: value })),
    );
    panel.append(
      createNumberField("Attack ms", selectedInstrument.attackMs, "instAttack", (value) => actions.updateInstrument({ attackMs: value })),
    );
    panel.append(
      createNumberField("Decay ms", selectedInstrument.decayMs, "instDecay", (value) => actions.updateInstrument({ decayMs: value })),
    );
  }

  return panel;
}

function renderMusicInspectorWithProperties(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const panel = renderMusicInspector(state, actions);
  panel.prepend(renderMusicProjectPanel(state, actions));

  return panel;
}

function renderNoteInstrumentField(
  state: MusicEditorState,
  noteId: string,
  selectedInstrumentIndex: number,
  actions: MusicRenderActions,
): HTMLLabelElement {
  const select = createElement("select");
  select.dataset.field = "noteInstrument";

  state.project.instruments.forEach((instrument, index) => {
    const option = createElement("option");
    option.value = String(index);
    option.textContent = `${index + 1}. ${instrument.id}`;
    option.selected = selectedInstrumentIndex === index;
    select.append(option);
  });

  select.addEventListener("change", () => actions.updateNote(noteId, { instrument: Number(select.value) }));

  return createField("Instrument", select);
}

function renderMusicLoopControls(state: MusicEditorState, actions: MusicRenderActions): HTMLElement {
  const loop = normalizeMusicLoop(state.project.loop, state.project.lengthTicks);
  const section = createElement("section", "music-loop-controls");
  const title = createElement("div", "panel-title compact-title");
  const toggle = createElement("input");
  toggle.type = "checkbox";
  toggle.checked = loop.enabled;
  toggle.dataset.field = "musicLoopEnabled";
  toggle.addEventListener("change", () => actions.updateProject({ loop: { enabled: toggle.checked } }));
  title.append(createTextElement("h2", "Loop"), createField("Enabled", toggle));

  const fields = createElement("div", "field-grid");
  fields.append(
    createNumberField("Start tick", loop.startTick, "musicLoopStart", (value) => actions.updateProject({ loop: { startTick: value } })),
    createNumberField("End tick", loop.endTick, "musicLoopEnd", (value) => actions.updateProject({ loop: { endTick: value } })),
  );

  const status = createTextElement("p", "Loop ticks are clamped to the song length; end auto-moves after start.", "music-loop-status");
  section.append(title, fields, status);

  return section;
}

function createInlineNumberInput(
  noteId: string,
  fieldName: string,
  value: number,
  className: string,
  actions: MusicRenderActions,
  toPatch: (value: number) => Parameters<MusicRenderActions["updateNote"]>[1],
): HTMLInputElement {
  const input = createElement("input", `${className} tracker-inline-input`);
  input.type = "number";
  input.value = String(value);
  input.dataset.field = `note-${noteId}-${fieldName}`;
  input.addEventListener("input", () => actions.updateNote(noteId, toPatch(Number(input.value))));
  bindInlineEditKeys(input, String(value), (initialValue) => actions.updateNote(noteId, toPatch(Number(initialValue))));

  return input;
}

function createInlineInstrumentSelect(
  state: MusicEditorState,
  note: { id: string; instrument: number },
  className: string,
  actions: MusicRenderActions,
): HTMLSelectElement {
  const select = createElement("select", `${className} tracker-inline-input`);
  select.dataset.field = `note-${note.id}-instrument`;

  state.project.instruments.forEach((instrument, index) => {
    const option = createElement("option");
    option.value = String(index);
    option.textContent = `${index + 1}. ${instrument.id}`;
    option.selected = note.instrument === index;
    select.append(option);
  });

  select.addEventListener("change", () => actions.updateNote(note.id, { instrument: Number(select.value) }));
  bindInlineEditKeys(select, String(note.instrument), (initialValue) => actions.updateNote(note.id, { instrument: Number(initialValue) }));

  return select;
}

function createInlineNoteInput(note: { id: string; note: number }, className: string, actions: MusicRenderActions): HTMLInputElement {
  const input = createElement("input", `${className} tracker-inline-input`);
  input.type = "text";
  input.value = getNoteName(note.note);
  input.dataset.field = `note-${note.id}-note`;
  input.addEventListener("input", () => {
    const parsedNote = parseNoteValue(input.value);

    if (parsedNote !== null) {
      actions.updateNote(note.id, { note: parsedNote });
    }
  });
  bindInlineEditKeys(input, getNoteName(note.note), (initialValue) => {
    const parsedNote = parseNoteValue(initialValue);

    if (parsedNote !== null) {
      actions.updateNote(note.id, { note: parsedNote });
    }
  });

  return input;
}

function getNoteSelectionOptions(event: MouseEvent | PointerEvent): { extendRange: boolean; toggle: boolean } {
  return {
    extendRange: event.shiftKey,
    toggle: event.metaKey || event.ctrlKey,
  };
}

function bindInlineEditKeys(
  element: HTMLInputElement | HTMLSelectElement,
  initialValue: string,
  onCancel: (initialValue: string) => void,
): void {
  const handleKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    if (event.key === "Enter") {
      element.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      element.value = initialValue;
      onCancel(initialValue);
      element.blur();
    }
  };

  element.addEventListener("keydown", handleKeyDown);
}

function renderLoopOverlay(lengthTicks: number, loop: { enabled: boolean; startTick: number; endTick: number }): HTMLElement {
  const overlay = createElement("div", `music-loop-overlay${loop.enabled ? " is-enabled" : ""}`);
  const intro = createElement("div", "music-loop-intro");
  const region = createElement("div", "music-loop-region");
  const startPercent = (loop.startTick / lengthTicks) * 100;
  const endPercent = (loop.endTick / lengthTicks) * 100;

  intro.title = `Intro before loop start: 0 to ${loop.startTick} ticks`;
  region.title = `Loop region: ${loop.startTick} to ${loop.endTick} ticks`;
  intro.style.left = "0%";
  intro.style.width = `${startPercent}%`;
  region.style.left = `${startPercent}%`;
  region.style.width = `${Math.max(0, endPercent - startPercent)}%`;
  overlay.append(intro, region);

  return overlay;
}

function renderLoopMarker(
  markerType: "start" | "end",
  lengthTicks: number,
  loop: { startTick: number; endTick: number },
  actions: MusicRenderActions,
): HTMLElement {
  const marker = createTextElement("button", markerType === "start" ? "S" : "E", `music-loop-marker is-${markerType}`);
  const tick = markerType === "start" ? loop.startTick : loop.endTick;
  marker.type = "button";
  marker.title = markerType === "start" ? `Loop start: ${tick} ticks` : `Loop end: ${tick} ticks`;
  marker.setAttribute("aria-label", marker.title);
  marker.style.left = `${(tick / lengthTicks) * 100}%`;
  marker.addEventListener("pointerdown", (event) => {
    const parent = marker.parentElement;

    if (parent === null) {
      return;
    }

    event.preventDefault();
    marker.setPointerCapture(event.pointerId);
    const updateFromClientX = (clientX: number): void => {
      const rect = parent.getBoundingClientRect();
      const ratio = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
      const nextTick = Math.round(Math.max(0, Math.min(1, ratio)) * lengthTicks);
      actions.updateProject({ loop: markerType === "start" ? { startTick: nextTick } : { endTick: nextTick } });
    };
    const onPointerMove = (moveEvent: PointerEvent): void => updateFromClientX(moveEvent.clientX);
    const onPointerUp = (upEvent: PointerEvent): void => {
      updateFromClientX(upEvent.clientX);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp, { once: true });
  });

  return marker;
}

function createTextField(label: string, value: string, field: string, onInput: (value: string) => void): HTMLLabelElement {
  const input = createElement("input");
  input.type = "text";
  input.value = value;
  input.dataset.field = field;
  input.addEventListener("input", () => onInput(input.value));

  return createField(label, input);
}

function createNumberField(
  label: string,
  value: number,
  field: string,
  onInput: (value: number) => void,
  options: { min?: number; max?: number; step?: number } = {},
): HTMLLabelElement {
  const input = createElement("input");
  input.type = "number";
  input.value = String(value);
  input.dataset.field = field;
  if (options.min !== undefined) {
    input.min = String(options.min);
  }
  if (options.max !== undefined) {
    input.max = String(options.max);
  }
  if (options.step !== undefined) {
    input.step = String(options.step);
  }
  input.addEventListener("input", () => onInput(Number(input.value)));

  return createField(label, input);
}

function getNoteName(note: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const name = names[((note % 12) + 12) % 12] ?? "C";
  const octave = Math.floor(note / 12) - 1;

  return `${name}${octave}`;
}

function parseNoteValue(value: string): number | null {
  const trimmed = value.trim();

  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(trimmed);

  if (match === null) {
    return null;
  }

  const pitchClasses: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const pitchClass = pitchClasses[match[1]?.toUpperCase() ?? "C"] ?? 0;
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  const octave = Number(match[3]);

  return (octave + 1) * 12 + pitchClass + accidental;
}
