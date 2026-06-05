import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  FlipHorizontal,
  FlipVertical,
  MousePointer2,
  Plus,
  Redo2,
  Slash,
  Trash2,
  Undo2,
  X,
} from "lucide";
import {
  clampFontCoordinate,
  cloneVectorFont,
  createVectorFont,
  decodeFontLine,
  encodeFontLine,
  FONT_LINE_PATTERN,
  type FontGlyph,
  type FontPoint,
  type VectorFont,
} from "../model/font.js";
import type { ModeSurface, RenderActions } from "./appTypes.js";
import { createElement, createField, createIconButton, createTextElement } from "./dom.js";
import { renderAssetSidebarPanel, renderEditorArea, renderInspectorPanel, renderPreviewStatusArea } from "./renderShell.js";

type FontTool = "line" | "select";
type FontInspectorTab = "glyph" | "settings";
type DragState = { kind: "draw"; start: FontPoint; current: FontPoint } | { kind: "endpoint"; endpoint: 0 | 1 } | null;
interface FontHistorySnapshot {
  font: VectorFont;
  selectedGlyphChar: string | null;
  selectedLineIndex: number | null;
}

const PRESETS = ["LITTLE ONE", "TAP TO START", "SCORE 123", "BEST 999", "GAME OVER", "PAUSED"];
const CANVAS_SIZE = 520;
const GRID_ORIGIN = 42;
const GRID_CELL_SIZE = 29;
let font = createVectorFont();
let selectedGlyphChar = font.glyphs[0]?.char ?? null;
let selectedLineIndex: number | null = null;
let activeTool: FontTool = "line";
let activeInspectorTab: FontInspectorTab = "glyph";
let previewText = PRESETS[0] ?? "";
let dragState: DragState = null;
let dragHistorySnapshot: FontHistorySnapshot | null = null;
let undoStack: FontHistorySnapshot[] = [];
let redoStack: FontHistorySnapshot[] = [];
let changeListener: (() => void) | null = null;

export function setFontEditorChangeListener(listener: () => void): void {
  changeListener = listener;
}

export function getCurrentFont(): VectorFont {
  return cloneVectorFont(font);
}

export function createNewFont(): void {
  font = createVectorFont();
  selectedGlyphChar = font.glyphs[0]?.char ?? null;
  selectedLineIndex = null;
  clearHistory();
  notifyChange();
}

export function replaceCurrentFont(nextFont: VectorFont): void {
  font = cloneVectorFont(nextFont);
  selectedGlyphChar = font.glyphs[0]?.char ?? null;
  selectedLineIndex = null;
  clearHistory();
  notifyChange();
}

export function canUndoFontEditor(): boolean {
  return undoStack.length > 0;
}

export function canRedoFontEditor(): boolean {
  return redoStack.length > 0;
}

export function undoFontEditor(): boolean {
  const snapshot = undoStack.pop();
  if (snapshot === undefined) return false;
  redoStack.push(createHistorySnapshot());
  restoreHistorySnapshot(snapshot);
  notifyChange();
  return true;
}

export function redoFontEditor(): boolean {
  const snapshot = redoStack.pop();
  if (snapshot === undefined) return false;
  undoStack.push(createHistorySnapshot());
  restoreHistorySnapshot(snapshot);
  notifyChange();
  return true;
}

export function handleFontEditorKeyboardShortcut(event: KeyboardEvent): boolean {
  if (event.key !== "Delete" && event.key !== "Backspace") return false;
  if (selectedLineIndex === null) return false;
  deleteSelectedLine();
  event.preventDefault();
  return true;
}

export function renderFontEditorSurface(shellActions: RenderActions): ModeSurface {
  const assetPanel = renderAssetSidebarPanel("font-glyph-panel");
  const editorArea = renderEditorArea("font-editor-area");
  const inspectorPanel = renderInspectorPanel("font-inspector-panel");
  const previewStatusArea = renderPreviewStatusArea("Font text preview");
  renderGlyphList(assetPanel);
  renderCanvasArea(editorArea);
  renderInspector(inspectorPanel, shellActions);
  renderPreview(previewStatusArea);
  return { assetPanel, editorArea, inspectorPanel, previewStatusArea };
}

function renderGlyphList(panel: HTMLElement): void {
  const heading = createElement("div", "font-panel-heading");
  const add = createIconButton(Plus, "Add glyph", "icon-button");
  const remove = createIconButton(Trash2, "Delete selected glyph", "icon-button danger");
  add.addEventListener("click", addGlyph);
  remove.addEventListener("click", deleteSelectedGlyph);
  heading.append(createTextElement("h2", "Glyphs"), add, remove);
  const list = createElement("div", "font-glyph-list");

  for (const glyph of font.glyphs) {
    const button = createElement("button", `font-glyph-item${glyph.char === selectedGlyphChar ? " is-active" : ""}`);
    button.type = "button";
    button.title = glyph.char === " " ? "space" : glyph.char;
    const canvas = createElement("canvas", "font-glyph-thumb");
    canvas.width = 40;
    canvas.height = 40;
    drawGlyph(canvas, glyph, 3, "#ffc71c");
    button.append(canvas, createTextElement("strong", glyph.char === " " ? "SP" : glyph.char));
    button.addEventListener("click", () => {
      selectedGlyphChar = glyph.char;
      selectedLineIndex = null;
      notifyChange();
    });
    list.append(button);
  }

  panel.append(heading, list);
}

function renderCanvasArea(area: HTMLElement): void {
  const toolRow = createElement("div", "font-tool-row");
  toolRow.append(
    toolButton(Undo2, "Undo font edit", false, undoFontEditor, !canUndoFontEditor()),
    toolButton(Redo2, "Redo font edit", false, redoFontEditor, !canRedoFontEditor()),
    toolButton(Slash, "Line tool", activeTool === "line", () => setTool("line")),
    toolButton(MousePointer2, "Select tool", activeTool === "select", () => setTool("select")),
    toolButton(Trash2, "Delete selected line", false, deleteSelectedLine, selectedLineIndex === null),
    toolButton(X, "Clear glyph", false, clearGlyph),
    toolButton(ArrowLeft, "Move glyph left", false, () => moveGlyph(-1, 0)),
    toolButton(ArrowRight, "Move glyph right", false, () => moveGlyph(1, 0)),
    toolButton(ArrowUp, "Move glyph up", false, () => moveGlyph(0, -1)),
    toolButton(ArrowDown, "Move glyph down", false, () => moveGlyph(0, 1)),
    toolButton(FlipHorizontal, "Mirror glyph horizontally", false, () => mirrorGlyph(true)),
    toolButton(FlipVertical, "Mirror glyph vertically", false, () => mirrorGlyph(false)),
  );
  const canvas = createElement("canvas", "font-canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  bindCanvas(canvas);
  drawEditorCanvas(canvas);
  const wrap = createElement("div", "font-canvas-wrap");
  const editorMain = createElement("div", "font-editor-main");
  wrap.append(canvas);
  editorMain.append(toolRow, wrap);
  area.append(editorMain);
}

function renderInspector(panel: HTMLElement, shellActions: RenderActions): void {
  const tabBar = createElement("div", "font-inspector-tabs");
  const glyphTab = createFontTabButton("Glyph inspector", "glyph");
  const settingsTab = createFontTabButton("Font settings", "settings");
  tabBar.append(glyphTab, settingsTab);

  const glyphPanel = createElement("div", `font-inspector-tab-panel${activeInspectorTab === "glyph" ? " is-active" : ""}`);
  renderGlyphInspector(glyphPanel);

  const settingsPanel = createElement("div", `font-inspector-tab-panel${activeInspectorTab === "settings" ? " is-active" : ""}`);
  renderFontSettings(settingsPanel, shellActions);

  panel.append(tabBar, glyphPanel, settingsPanel);
}

function renderGlyphInspector(panel: HTMLElement): void {
  const glyph = getSelectedGlyph();
  if (glyph === null) {
    panel.append(createTextElement("p", "Select a glyph.", "empty-state"));
    return;
  }

  const char = textInput(glyph.char === " " ? " " : glyph.char, "fontGlyphChar");
  char.maxLength = 2;
  char.addEventListener("change", () => updateGlyphChar(char.value));
  const name = textInput(glyph.name ?? "", "fontGlyphName");
  name.addEventListener("change", () => {
    commitFontChange(() => {
      if (name.value.trim() === "") delete glyph.name;
      else glyph.name = name.value.trim();
    });
  });
  const advance = numberInput(glyph.advance ?? font.defaultAdvance);
  advance.addEventListener("change", () => {
    commitFontChange(() => {
      glyph.advance = integerValue(advance, font.defaultAdvance);
    });
  });
  panel.append(createField("Char", char), createField("Optional name", name), createField("Advance", advance));

  const lineHeading = createElement("div", "font-panel-heading");
  lineHeading.append(createTextElement("h2", "Lines"), createTextElement("span", `${glyph.lines.length}`));
  const list = createElement("div", "font-line-list");
  glyph.lines.forEach((line, index) => list.append(renderLineRow(glyph, line, index)));
  panel.append(lineHeading, list);

  if (selectedLineIndex !== null && glyph.lines[selectedLineIndex] !== undefined) {
    const points = decodeFontLine(glyph.lines[selectedLineIndex] ?? "");
    if (points !== null) panel.append(renderEndpointFields(points));
  }
}

function renderFontSettings(panel: HTMLElement, shellActions: RenderActions): void {
  const id = textInput(font.id, "fontId");
  id.addEventListener("change", () => {
    commitFontChange(() => {
      font.id = id.value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
    });
  });

  const advance = numberInput(font.defaultAdvance);
  advance.addEventListener("change", () => {
    commitFontChange(() => {
      font.defaultAdvance = integerValue(advance, font.defaultAdvance);
    });
  });

  const thickness = numberInput(font.lineThickness);
  thickness.min = "1";
  thickness.addEventListener("change", () => {
    commitFontChange(() => {
      font.lineThickness = Math.max(1, integerValue(thickness, font.lineThickness));
    });
  });

  const actions = createElement("div", "font-settings-actions");
  const newButton = createIconButton(Plus, "Create new font", "icon-button");
  const openButton = createIconButton(ArrowUp, "Open/import font JSON", "icon-button");
  const saveButton = createIconButton(ArrowDown, "Save/export font JSON", "icon-button");
  newButton.addEventListener("click", createNewFont);
  openButton.addEventListener("click", shellActions.importJson);
  saveButton.addEventListener("click", shellActions.exportCurrentJson);
  actions.append(newButton, openButton, saveButton);

  panel.append(
    createField("Font id", id),
    createField("Grid", disabledInput("16")),
    createField("Default advance", advance),
    createField("Line thickness", thickness),
    actions,
  );
}

function renderLineRow(glyph: FontGlyph, line: string, index: number): HTMLElement {
  const row = createElement("div", `font-line-row${selectedLineIndex === index ? " is-active" : ""}`);
  const input = textInput(line, `fontLine${index}`);
  input.maxLength = 4;
  input.addEventListener("click", () => {
    if (selectedLineIndex !== index) {
      selectedLineIndex = index;
      notifyChange();
    }
  });
  input.addEventListener("change", () => {
    const value = input.value.toUpperCase();
    if (FONT_LINE_PATTERN.test(value)) {
      commitFontChange(() => {
        glyph.lines[index] = value;
        selectedLineIndex = index;
      });
      return;
    }
    notifyChange();
  });
  const remove = createIconButton(Trash2, `Delete line ${line}`, "icon-button danger");
  remove.addEventListener("click", () => deleteLine(index));
  row.append(input, remove);
  return row;
}

function renderEndpointFields(points: [FontPoint, FontPoint]): HTMLElement {
  const section = createElement("section", "font-endpoint-section");
  section.append(createTextElement("h2", "Selected endpoints"));
  const grid = createElement("div", "font-endpoint-grid");
  const labels = ["x1", "y1", "x2", "y2"] as const;
  const values = [points[0].x, points[0].y, points[1].x, points[1].y];
  labels.forEach((label, index) => {
    const input = textInput(values[index]?.toString(16).toUpperCase() ?? "0", `font${label}`);
    input.maxLength = 1;
    input.addEventListener("change", () => updateEndpoint(index, input.value));
    grid.append(createField(label, input));
  });
  section.append(grid);
  return section;
}

function renderPreview(panel: HTMLElement): void {
  const controls = createElement("div", "font-preview-controls");
  const input = textInput(previewText, "fontPreview");
  input.addEventListener("input", () => {
    previewText = input.value;
    const canvas = panel.querySelector<HTMLCanvasElement>(".font-preview-canvas");
    if (canvas !== null) drawTextPreview(canvas);
  });
  const presets = createElement("select");
  for (const preset of PRESETS) {
    const option = createElement("option");
    option.value = preset;
    option.textContent = preset;
    presets.append(option);
  }
  presets.value = PRESETS.includes(previewText) ? previewText : (PRESETS[0] ?? "");
  presets.addEventListener("change", () => {
    previewText = presets.value;
    notifyChange();
  });
  controls.append(input, presets);
  const canvas = createElement("canvas", "font-preview-canvas");
  canvas.width = 1000;
  canvas.height = 92;
  drawTextPreview(canvas);
  panel.append(controls, canvas);
}

function bindCanvas(canvas: HTMLCanvasElement): void {
  canvas.addEventListener("pointerdown", (event) => {
    const point = canvasPoint(canvas, event);
    const glyph = getSelectedGlyph();
    if (glyph === null) return;
    if (activeTool === "line") {
      dragState = { kind: "draw", start: point, current: point };
      dragHistorySnapshot = createHistorySnapshot();
    } else {
      const endpoint = hitEndpoint(point, glyph);
      if (endpoint !== null) {
        dragState = { kind: "endpoint", endpoint };
        dragHistorySnapshot = createHistorySnapshot();
      } else {
        selectedLineIndex = hitLine(point, glyph);
      }
    }
    canvas.setPointerCapture(event.pointerId);
    drawEditorCanvas(canvas);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (dragState === null) return;
    const point = canvasPoint(canvas, event);
    if (dragState.kind === "draw") dragState.current = point;
    else setSelectedEndpoint(dragState.endpoint, point);
    drawEditorCanvas(canvas);
  });
  canvas.addEventListener("pointerup", (event) => {
    const glyph = getSelectedGlyph();
    if (glyph !== null && dragState?.kind === "draw") {
      const line = encodeFontLine(dragState.start, dragState.current);
      glyph.lines.push(line);
      selectedLineIndex = glyph.lines.length - 1;
    }
    commitDragHistory();
    dragState = null;
    dragHistorySnapshot = null;
    canvas.releasePointerCapture(event.pointerId);
    notifyChange();
  });
}

function drawEditorCanvas(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");
  if (context === null) return;
  const size = GRID_CELL_SIZE;
  const origin = GRID_ORIGIN;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#15110c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,.12)";
  context.lineWidth = 1;
  context.font = "11px monospace";
  context.fillStyle = "#a89e8e";
  for (let index = 0; index < 16; index += 1) {
    const p = origin + index * size;
    context.beginPath();
    context.moveTo(origin, p);
    context.lineTo(origin + 15 * size, p);
    context.moveTo(p, origin);
    context.lineTo(p, origin + 15 * size);
    context.stroke();
    context.fillText(index.toString(16).toUpperCase(), p - 3, 27);
    context.fillText(index.toString(16).toUpperCase(), 18, p + 4);
  }
  const glyph = getSelectedGlyph();
  if (glyph !== null) {
    glyph.lines.forEach((line, index) => drawCanvasLine(context, line, index === selectedLineIndex));
  }
  if (dragState?.kind === "draw") {
    drawCanvasLine(context, encodeFontLine(dragState.start, dragState.current), true);
  }
}

function drawCanvasLine(context: CanvasRenderingContext2D, line: string, selected: boolean): void {
  const points = decodeFontLine(line);
  if (points === null) return;
  const origin = GRID_ORIGIN;
  const size = GRID_CELL_SIZE;
  context.strokeStyle = selected ? "#fff4bb" : "#ffc71c";
  context.lineWidth = selected ? 5 : 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(origin + points[0].x * size, origin + points[0].y * size);
  context.lineTo(origin + points[1].x * size, origin + points[1].y * size);
  context.stroke();
  if (selected) {
    for (const point of points) {
      context.fillStyle = "#15110c";
      context.strokeStyle = "#fff4bb";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(origin + point.x * size, origin + point.y * size, 7, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  }
}

function drawGlyph(canvas: HTMLCanvasElement, glyph: FontGlyph, padding: number, color: string): void {
  const context = canvas.getContext("2d");
  if (context === null) return;
  const scale = (canvas.width - padding * 2) / 15;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.lineCap = "round";
  for (const line of glyph.lines) {
    const points = decodeFontLine(line);
    if (points === null) continue;
    context.beginPath();
    context.moveTo(padding + points[0].x * scale, padding + points[0].y * scale);
    context.lineTo(padding + points[1].x * scale, padding + points[1].y * scale);
    context.stroke();
  }
}

function drawTextPreview(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");
  if (context === null) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#15110c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#ffc71c";
  context.lineWidth = Math.max(1, font.lineThickness * 2);
  context.lineCap = "round";
  const scale = 3.3;
  let cursor = 18;
  for (const char of previewText) {
    const glyph = font.glyphs.find((candidate) => candidate.char === char) ?? font.glyphs.find((candidate) => candidate.char === "?");
    if (glyph === undefined) continue;
    for (const line of glyph.lines) {
      const points = decodeFontLine(line);
      if (points === null) continue;
      context.beginPath();
      context.moveTo(cursor + points[0].x * scale, 18 + points[0].y * scale);
      context.lineTo(cursor + points[1].x * scale, 18 + points[1].y * scale);
      context.stroke();
    }
    cursor += (glyph.advance ?? font.defaultAdvance) * scale;
  }
}

function addGlyph(): void {
  const value = window.prompt("Character for the new glyph:", "");
  if (value === null || value.length !== 1 || font.glyphs.some((glyph) => glyph.char === value)) return;
  commitFontChange(() => {
    font.glyphs.push({
      char: value,
      ...(value === " " ? { name: "space", advance: 6 } : {}),
      lines: [],
    });
    selectedGlyphChar = value;
    selectedLineIndex = null;
  });
}

function updateGlyphChar(value: string): void {
  const glyph = getSelectedGlyph();
  if (glyph === null || value.length !== 1 || font.glyphs.some((candidate) => candidate !== glyph && candidate.char === value)) {
    notifyChange();
    return;
  }
  commitFontChange(() => {
    glyph.char = value;
    selectedGlyphChar = value;
  });
}

function deleteSelectedGlyph(): void {
  const index = font.glyphs.findIndex((glyph) => glyph.char === selectedGlyphChar);
  if (index === -1 || !window.confirm("Delete the selected glyph?")) return;
  commitFontChange(() => {
    font.glyphs.splice(index, 1);
    selectedGlyphChar = font.glyphs[Math.min(index, font.glyphs.length - 1)]?.char ?? null;
    selectedLineIndex = null;
  });
}

function deleteSelectedLine(): void {
  if (selectedLineIndex !== null) deleteLine(selectedLineIndex);
}

function deleteLine(index: number): void {
  const glyph = getSelectedGlyph();
  if (glyph === null) return;
  commitFontChange(() => {
    glyph.lines.splice(index, 1);
    selectedLineIndex = null;
  });
}

function clearGlyph(): void {
  const glyph = getSelectedGlyph();
  if (glyph === null || glyph.lines.length === 0 || !window.confirm("Clear every line in this glyph?")) return;
  commitFontChange(() => {
    glyph.lines = [];
    selectedLineIndex = null;
  });
}

function moveGlyph(dx: number, dy: number): void {
  const glyph = getSelectedGlyph();
  if (glyph === null) return;
  const decoded = glyph.lines.map(decodeFontLine);
  if (
    decoded.some(
      (points) => points === null || points.some((point) => point.x + dx < 0 || point.x + dx > 15 || point.y + dy < 0 || point.y + dy > 15),
    )
  ) {
    return;
  }
  commitFontChange(() => {
    glyph.lines = decoded.map((points) =>
      encodeFontLine(
        { x: (points?.[0].x ?? 0) + dx, y: (points?.[0].y ?? 0) + dy },
        { x: (points?.[1].x ?? 0) + dx, y: (points?.[1].y ?? 0) + dy },
      ),
    );
  });
}

function mirrorGlyph(horizontal: boolean): void {
  const glyph = getSelectedGlyph();
  if (glyph === null) return;
  commitFontChange(() => {
    glyph.lines = glyph.lines.map((line) => {
      const points = decodeFontLine(line);
      if (points === null) return line;
      return encodeFontLine(
        { x: horizontal ? 15 - points[0].x : points[0].x, y: horizontal ? points[0].y : 15 - points[0].y },
        { x: horizontal ? 15 - points[1].x : points[1].x, y: horizontal ? points[1].y : 15 - points[1].y },
      );
    });
  });
}

function updateEndpoint(index: number, value: string): void {
  if (!/^[0-9A-Fa-f]$/.test(value)) {
    notifyChange();
    return;
  }
  const glyph = getSelectedGlyph();
  if (glyph === null || selectedLineIndex === null) return;
  const lineIndex = selectedLineIndex;
  const points = decodeFontLine(glyph.lines[selectedLineIndex] ?? "");
  if (points === null) return;
  const coordinate = parseInt(value, 16);
  commitFontChange(() => {
    if (index === 0) points[0].x = coordinate;
    if (index === 1) points[0].y = coordinate;
    if (index === 2) points[1].x = coordinate;
    if (index === 3) points[1].y = coordinate;
    glyph.lines[lineIndex] = encodeFontLine(points[0], points[1]);
  });
}

function setSelectedEndpoint(endpoint: 0 | 1, point: FontPoint): void {
  const glyph = getSelectedGlyph();
  if (glyph === null || selectedLineIndex === null) return;
  const points = decodeFontLine(glyph.lines[selectedLineIndex] ?? "");
  if (points === null) return;
  points[endpoint] = point;
  glyph.lines[selectedLineIndex] = encodeFontLine(points[0], points[1]);
}

function hitEndpoint(point: FontPoint, glyph: FontGlyph): 0 | 1 | null {
  if (selectedLineIndex === null) return null;
  const points = decodeFontLine(glyph.lines[selectedLineIndex] ?? "");
  if (points === null) return null;
  if (samePoint(point, points[0])) return 0;
  if (samePoint(point, points[1])) return 1;
  return null;
}

function hitLine(point: FontPoint, glyph: FontGlyph): number | null {
  let best: { index: number; distance: number } | null = null;
  for (const [index, line] of glyph.lines.entries()) {
    const points = decodeFontLine(line);
    if (points === null) continue;
    const distance = pointLineDistance(point, points[0], points[1]);
    if (distance <= 0.55 && (best === null || distance < best.distance)) best = { index, distance };
  }
  return best?.index ?? null;
}

function pointLineDistance(point: FontPoint, start: FontPoint, end: FontPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function canvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): FontPoint {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: clampFontCoordinate(((event.clientX - rect.left) * scaleX - GRID_ORIGIN) / GRID_CELL_SIZE),
    y: clampFontCoordinate(((event.clientY - rect.top) * scaleY - GRID_ORIGIN) / GRID_CELL_SIZE),
  };
}

function getSelectedGlyph(): FontGlyph | null {
  return font.glyphs.find((glyph) => glyph.char === selectedGlyphChar) ?? null;
}

function setTool(tool: FontTool): void {
  activeTool = tool;
  notifyChange();
}

function createFontTabButton(label: string, tab: FontInspectorTab): HTMLButtonElement {
  const button = createElement("button", `font-tab-button${activeInspectorTab === tab ? " is-active" : ""}`);
  button.type = "button";
  button.textContent = label;
  button.title = `Show ${label}`;
  button.setAttribute("aria-label", `Show ${label}`);
  button.addEventListener("click", () => {
    activeInspectorTab = tab;
    document.querySelectorAll<HTMLElement>(".font-tab-button").forEach((candidate) => {
      candidate.classList.toggle("is-active", candidate === button);
    });
    document.querySelectorAll<HTMLElement>(".font-inspector-tab-panel").forEach((candidate, index) => {
      candidate.classList.toggle("is-active", (tab === "glyph" && index === 0) || (tab === "settings" && index === 1));
    });
  });

  return button;
}

function toolButton(
  icon: Parameters<typeof createIconButton>[0],
  title: string,
  active: boolean,
  action: () => void,
  disabled = false,
): HTMLButtonElement {
  const button = createIconButton(icon, title, `tool-button${active ? " primary" : ""}`);
  button.disabled = disabled;
  button.addEventListener("click", action);
  return button;
}

function textInput(value: string, field: string): HTMLInputElement {
  const input = createElement("input");
  input.type = "text";
  input.value = value;
  input.dataset.field = field;
  return input;
}

function numberInput(value: number): HTMLInputElement {
  const input = createElement("input");
  input.type = "number";
  input.step = "1";
  input.value = String(value);
  return input;
}

function disabledInput(value: string): HTMLInputElement {
  const input = textInput(value, "fontGrid");
  input.disabled = true;
  return input;
}

function integerValue(input: HTMLInputElement, fallback: number): number {
  const value = Number(input.value);
  return Number.isInteger(value) ? value : fallback;
}

function samePoint(a: FontPoint, b: FontPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

function notifyChange(): void {
  changeListener?.();
}

function createHistorySnapshot(): FontHistorySnapshot {
  return {
    font: cloneVectorFont(font),
    selectedGlyphChar,
    selectedLineIndex,
  };
}

function restoreHistorySnapshot(snapshot: FontHistorySnapshot): void {
  font = cloneVectorFont(snapshot.font);
  selectedGlyphChar = snapshot.selectedGlyphChar || "";
  selectedLineIndex = snapshot.selectedLineIndex;
  dragState = null;
  dragHistorySnapshot = null;
}

function commitFontChange(mutator: () => void): void {
  const before = createHistorySnapshot();
  const beforeKey = historyKey(before);
  mutator();

  if (beforeKey !== historyKey(createHistorySnapshot())) {
    undoStack.push(before);
    redoStack = [];
  }

  notifyChange();
}

function commitDragHistory(): void {
  if (dragHistorySnapshot === null) return;

  if (historyKey(dragHistorySnapshot) !== historyKey(createHistorySnapshot())) {
    undoStack.push(dragHistorySnapshot);
    redoStack = [];
  }
}

function clearHistory(): void {
  undoStack = [];
  redoStack = [];
  dragHistorySnapshot = null;
}

function historyKey(snapshot: FontHistorySnapshot): string {
  return JSON.stringify(snapshot);
}
