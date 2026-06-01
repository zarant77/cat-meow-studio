import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide";
import type { EditorState } from "../state/editorState.js";
import { formatWaveLabel } from "../utils/validation.js";
import { appendChildren, createElement, createIconButton, createTextElement } from "./dom.js";
import type { RenderActions } from "./appTypes.js";

export function renderCommands(state: EditorState, actions: RenderActions): HTMLElement {
  const commandList = createElement("section", "panel command-list editor-area sfx-editor-area");
  const panelTitle = createElement("div", "panel-title");
  const addButton = createIconButton(Plus, "Add command");
  addButton.addEventListener("click", actions.addCommand);
  panelTitle.append(createTextElement("h2", "Commands"), addButton);
  commandList.append(panelTitle);

  if (state.commands.length === 0) {
    const emptyState = createElement("div", "empty-state command-empty-state");
    const addEmptyButton = createTextElement("button", "Add Command", "preset-action-button primary");
    addEmptyButton.type = "button";
    addEmptyButton.addEventListener("click", actions.addCommand);
    emptyState.append(
      createTextElement("strong", "No commands yet."),
      createTextElement("span", "Add a command to start shaping a sound, or choose a preset on the left."),
      addEmptyButton,
    );
    commandList.append(emptyState);
    return commandList;
  }

  const commandRows = createElement("div", "panel-scroll command-list-items");
  state.commands.forEach((command, index) => {
    const isSelected = command.id === state.selectedCommandId;
    const card = createElement("article", `list-row command-card${isSelected ? " is-selected" : ""}`);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-pressed", String(isSelected));
    card.addEventListener("click", () => actions.selectCommand(command.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        actions.selectCommand(command.id);
      }
    });

    const main = createElement("div", "sfx-command-row");
    appendChildren(main, [
      createTextElement("strong", `#${index + 1}`),
      createTextElement("span", formatWaveLabel(command.wave)),
      createTextElement("span", `${command.frequencyStart} -> ${command.frequencyEnd} Hz`),
      createTextElement("span", `${command.durationMs} ms`),
      createTextElement("span", `Vol ${command.volume}`),
    ]);

    const actionsElement = createElement("div", "command-actions");
    const moveUpButton = createIconButton(ArrowUp, "Move up");
    const moveDownButton = createIconButton(ArrowDown, "Move down");
    const duplicateButton = createIconButton(Copy, "Duplicate");
    const deleteButton = createIconButton(Trash2, "Delete", "icon-button danger");

    moveUpButton.disabled = index === 0;
    moveDownButton.disabled = index === state.commands.length - 1;

    moveUpButton.addEventListener("click", (event) => {
      event.stopPropagation();
      actions.moveCommand(command.id, -1);
    });
    moveDownButton.addEventListener("click", (event) => {
      event.stopPropagation();
      actions.moveCommand(command.id, 1);
    });
    duplicateButton.addEventListener("click", (event) => {
      event.stopPropagation();
      actions.duplicateCommand(command.id);
    });
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      actions.deleteCommand(command.id);
    });

    actionsElement.append(moveUpButton, moveDownButton, duplicateButton, deleteButton);
    card.append(main, actionsElement);
    commandRows.append(card);
  });
  commandList.append(commandRows);

  return commandList;
}
