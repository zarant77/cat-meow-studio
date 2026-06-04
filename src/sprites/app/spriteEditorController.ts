import { CanvasView } from "../canvas/CanvasView.js";
import type { SpriteAssetData } from "../../model/assets.js";
import type { GroupNode, SceneNode, SceneNodeEntry } from "../document/CatPaintDocument.js";
import {
  cloneNodes,
  cloneNodesWithNewIds,
  createGroupNode,
  getEditablePrimitiveNodeEntries,
  getPrimitiveCommandsForNode,
  getSceneNodeEntries,
} from "../document/CatPaintDocument.js";
import type { Primitive, ToolKind } from "../primitives/Primitive.js";
import { bindPrimitiveList } from "../ui/primitiveList.js";
import type { AppElements } from "../ui/elements.js";
import { applyHistorySnapshot, createHistorySnapshot, createInitialState, type AppState } from "./AppState.js";

type LayerMoveTarget = "back" | "backward" | "forward" | "front";
type ColorSlot = "foreground" | "background";

type PrimitiveBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type SelectedPrimitive = {
  primitive: Primitive;
};

type SpriteEditorControls = {
  toolButtons: HTMLButtonElement[];
  spriteIdInput: HTMLInputElement;
  canvasWidthInput: HTMLInputElement;
  canvasHeightInput: HTMLInputElement;
  foregroundColorButton: HTMLButtonElement;
  backgroundColorButton: HTMLButtonElement;
  colorInput: HTMLInputElement;
  colorHexInput: HTMLInputElement;
  selectionSummary: HTMLElement;
  flipHorizontalButton: HTMLButtonElement;
  flipVerticalButton: HTMLButtonElement;
  sendToBackButton: HTMLButtonElement;
  sendBackwardButton: HTMLButtonElement;
  bringForwardButton: HTMLButtonElement;
  bringToFrontButton: HTMLButtonElement;
  scaleSpriteUpButton: HTMLButtonElement;
  scaleSpriteDownButton: HTMLButtonElement;
  groupButton: HTMLButtonElement;
  ungroupButton: HTMLButtonElement;
  copyPrimitiveButton: HTMLButtonElement;
  pastePrimitiveButton: HTMLButtonElement;
  deletePrimitiveButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  statusElement: HTMLElement;
};

type SpriteEditorMount = AppElements & SpriteEditorControls;
type SpriteAssetChangeListener = (sprite: SpriteAssetData) => void;

const PASTE_OFFSET = 8;
const spriteScaleStep = 1.1;
const maximumCanvasSize = 1020;

export class SpriteEditorController {
  private readonly state: AppState = createInitialState();
  private nodeClipboard: SceneNode[] = [];
  private renderPrimitiveList = (): void => {};
  private canvasView: CanvasView | null = null;
  private mount: SpriteEditorMount | null = null;
  private assetChangeListener: SpriteAssetChangeListener | null = null;

  bind(mount: SpriteEditorMount): void {
    this.canvasView?.destroy();
    this.mount = mount;

    this.canvasView = new CanvasView(mount, this.state, {
      onRender: () => this.syncUi(),
      onPickColor: (color) => this.applyPickedColor(color),
    });

    this.renderPrimitiveList = bindPrimitiveList(mount, this.state, {
      onSelectNode: (nodeId, options) => this.selectNodeFromList(nodeId, options),
      onToggleGroup: (nodeId) => this.toggleGroupCollapsed(nodeId),
      onToggleNodeVisibility: (nodeId) => this.toggleNodeVisibility(nodeId),
      onToggleNodeLocked: (nodeId) => this.toggleNodeLocked(nodeId),
      onMoveNode: (nodeId, direction) => this.moveNodeFromList(nodeId, direction),
      onRenameNode: (nodeId, name) => this.renameNode(nodeId, name),
    }).render;

    this.bindControls(mount);
    this.syncInputs();
    this.syncUi();
    this.canvasView.setupCanvas();
    this.canvasView.bind();
    this.canvasView.render();
  }

  destroy(): void {
    this.canvasView?.destroy();
    this.canvasView = null;
    this.mount = null;
  }

  getSpriteAssetData(): SpriteAssetData {
    return {
      spriteId: this.state.spriteId,
      width: this.state.spriteWidth,
      height: this.state.spriteHeight,
      pivotX: this.state.pivotX,
      pivotY: this.state.pivotY,
      nodes: cloneNodes(this.state.nodes),
    };
  }

  setAssetChangeListener(listener: SpriteAssetChangeListener): void {
    this.assetChangeListener = listener;
  }

  replaceSpriteAssetData(sprite: SpriteAssetData): void {
    const width = normalizeCanvasDimension(sprite.width);
    const height = normalizeCanvasDimension(sprite.height);
    this.state.spriteId = sprite.spriteId;
    this.state.spriteWidth = width;
    this.state.spriteHeight = height;
    this.state.pivotX = Math.round(sprite.pivotX);
    this.state.pivotY = Math.round(sprite.pivotY);
    this.state.nodes = cloneNodes(sprite.nodes);
    this.state.undoStack = [];
    this.state.redoStack = [];
    this.state.selectedNodeIds = [];
    this.state.collapsedGroupIds = [];
    this.syncInputs();
    this.canvasView?.setupCanvas();
    this.canvasView?.render();
    this.syncUi();
  }

  createNewSprite(spriteId: string): void {
    this.replaceSpriteAssetData({
      spriteId,
      width: 256,
      height: 256,
      pivotX: 128,
      pivotY: 128,
      nodes: [],
    });
  }

  private bindControls(mount: SpriteEditorMount): void {
    mount.toolButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tool = button.dataset.kind;

        if (isToolKind(tool)) {
          this.selectTool(tool);
        }
      });
    });

    mount.spriteIdInput.addEventListener("input", () => {
      this.state.spriteId = mount.spriteIdInput.value.trim() || "sprite";
      this.syncUi();
    });

    bindCommitInput(mount.canvasWidthInput, () => this.resizeCanvas(Number(mount.canvasWidthInput.value), this.state.spriteHeight));
    bindCommitInput(mount.canvasHeightInput, () => this.resizeCanvas(this.state.spriteWidth, Number(mount.canvasHeightInput.value)));

    mount.foregroundColorButton.addEventListener("click", () => this.selectColorSlot("foreground"));
    mount.backgroundColorButton.addEventListener("click", () => this.selectColorSlot("background"));
    mount.colorInput.addEventListener("input", () => this.applyPickerColor(mount.colorInput.value));
    bindCommitInput(mount.colorHexInput, () => this.applyColor(mount.colorHexInput.value));

    mount.flipHorizontalButton.addEventListener("click", () => this.flipHorizontalSelection());
    mount.flipVerticalButton.addEventListener("click", () => this.flipVerticalSelection());
    mount.sendToBackButton.addEventListener("click", () => this.moveSelectedLayer("back"));
    mount.sendBackwardButton.addEventListener("click", () => this.moveSelectedLayer("backward"));
    mount.bringForwardButton.addEventListener("click", () => this.moveSelectedLayer("forward"));
    mount.bringToFrontButton.addEventListener("click", () => this.moveSelectedLayer("front"));
    mount.scaleSpriteUpButton.addEventListener("click", () => this.scaleWholeSprite(spriteScaleStep));
    mount.scaleSpriteDownButton.addEventListener("click", () => this.scaleWholeSprite(1 / spriteScaleStep));
    mount.groupButton.addEventListener("click", () => this.groupSelection());
    mount.ungroupButton.addEventListener("click", () => this.ungroupSelection());
    mount.copyPrimitiveButton.addEventListener("click", () => this.copySelectedPrimitive());
    mount.pastePrimitiveButton.addEventListener("click", () => this.pastePrimitive());
    mount.deletePrimitiveButton.addEventListener("click", () => this.deleteSelectedPrimitive());
    mount.undoButton.addEventListener("click", () => this.undo());
    mount.redoButton.addEventListener("click", () => this.redo());
  }

  canUndo(): boolean {
    return this.state.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.state.redoStack.length > 0;
  }

  undo(): void {
    const snapshot = this.state.undoStack.pop();

    if (!snapshot) {
      return;
    }

    this.state.redoStack.push(createHistorySnapshot(this.state));
    applyHistorySnapshot(this.state, snapshot);

    this.syncInputs();
    this.clampSelection();
    this.canvasView?.setupCanvas();
    this.canvasView?.render();
  }

  redo(): void {
    const snapshot = this.state.redoStack.pop();

    if (!snapshot) {
      return;
    }

    this.state.undoStack.push(createHistorySnapshot(this.state));
    applyHistorySnapshot(this.state, snapshot);

    this.syncInputs();
    this.clampSelection();
    this.canvasView?.setupCanvas();
    this.canvasView?.render();
  }

  handleKeyboardShortcut(event: KeyboardEvent): boolean {
    if (isEditableTarget(event.target)) {
      return false;
    }

    if (matchesHotkey(event, "mod+z")) {
      event.preventDefault();
      this.undo();
      return true;
    }

    if (matchesHotkey(event, "mod+shift+z") || matchesHotkey(event, "mod+y")) {
      event.preventDefault();
      this.redo();
      return true;
    }

    if (matchesHotkey(event, "mod+c")) {
      event.preventDefault();
      this.copySelectedPrimitive();
      return true;
    }

    if (matchesHotkey(event, "mod+v")) {
      event.preventDefault();
      this.pastePrimitive();
      return true;
    }

    if (matchesHotkey(event, "delete") || matchesHotkey(event, "backspace")) {
      event.preventDefault();
      this.deleteSelectedPrimitive();
      return true;
    }

    if (matchesHotkey(event, "escape")) {
      event.preventDefault();
      this.clearSelectionOrTool();
      return true;
    }

    if (matchesHotkey(event, "h")) {
      event.preventDefault();
      this.flipHorizontalSelection();
      return true;
    }

    if (matchesHotkey(event, "v")) {
      event.preventDefault();
      this.flipVerticalSelection();
      return true;
    }

    if (matchesHotkey(event, "shift+[")) {
      event.preventDefault();
      this.moveSelectedLayer("back");
      return true;
    }

    if (matchesHotkey(event, "[")) {
      event.preventDefault();
      this.moveSelectedLayer("backward");
      return true;
    }

    if (matchesHotkey(event, "shift+]")) {
      event.preventDefault();
      this.moveSelectedLayer("front");
      return true;
    }

    if (matchesHotkey(event, "]")) {
      event.preventDefault();
      this.moveSelectedLayer("forward");
      return true;
    }

    if (matchesHotkey(event, "alt+arrowup")) {
      event.preventDefault();
      this.moveSelectedLayer("backward");
      return true;
    }

    if (matchesHotkey(event, "alt+arrowdown")) {
      event.preventDefault();
      this.moveSelectedLayer("forward");
      return true;
    }

    if (matchesHotkey(event, "1")) {
      event.preventDefault();
      this.selectTool("rect");
      return true;
    }

    if (matchesHotkey(event, "2")) {
      event.preventDefault();
      this.selectTool("circle");
      return true;
    }

    if (matchesHotkey(event, "3")) {
      event.preventDefault();
      this.selectTool("triangle");
      return true;
    }

    if (matchesHotkey(event, "f")) {
      event.preventDefault();
      this.selectTool("fill");
      return true;
    }

    if (matchesHotkey(event, "i")) {
      event.preventDefault();
      this.selectTool("eyedropper");
      return true;
    }

    if (matchesHotkey(event, "r")) {
      event.preventDefault();
      this.selectTool("rotate");
      return true;
    }

    if (matchesHotkey(event, "t")) {
      event.preventDefault();
      this.selectTool("transform");
      return true;
    }

    if (matchesHotkey(event, "s")) {
      event.preventDefault();
      this.selectTool("scale");
      return true;
    }

    return false;
  }

  private selectTool(tool: NonNullable<ToolKind>): void {
    this.state.activeTool = this.state.activeTool === tool ? null : tool;

    if (isCreateToolKind(tool)) {
      this.state.activeKind = tool;
    }

    this.syncToolButtons();
    this.canvasView?.refreshCursor();
  }

  private selectNodeFromList(nodeId: string, options: { shiftKey: boolean }): void {
    const entry = this.getNodeEntry(nodeId);

    if (!entry) {
      return;
    }

    if (options.shiftKey) {
      const selectedEntries = this.getSelectedEntries();
      const canMultiSelect = selectedEntries.every((selectedEntry) => selectedEntry.parent === entry.parent);
      const selectedIds = new Set(canMultiSelect ? this.state.selectedNodeIds : []);

      if (selectedIds.has(nodeId)) {
        selectedIds.delete(nodeId);
      } else {
        selectedIds.add(nodeId);
      }

      this.state.selectedNodeIds = this.sortNodeIdsByTreeOrder([...selectedIds]);
    } else {
      this.state.selectedNodeIds = [nodeId];
    }

    this.syncUi();
    this.canvasView?.render();
  }

  private renameNode(nodeId: string, name: string): void {
    const entry = this.getNodeEntry(nodeId);
    const trimmedName = name.trim();

    if (!entry || trimmedName === "" || entry.node.name === trimmedName) {
      return;
    }

    this.recordHistory();
    entry.node.name = trimmedName;
    this.state.redoStack = [];
    this.canvasView?.render();
  }

  private resizeCanvas(width: number, height: number): void {
    if (!this.mount || !isCanvasDimension(width) || !isCanvasDimension(height)) {
      this.syncInputs();
      return;
    }

    if (width === this.state.spriteWidth && height === this.state.spriteHeight) {
      this.syncInputs();
      return;
    }

    this.recordHistory();
    this.state.spriteWidth = width;
    this.state.spriteHeight = height;
    this.state.pivotX = Math.round(width / 2);
    this.state.pivotY = Math.round(height / 2);
    this.state.redoStack = [];

    this.syncInputs();
    this.canvasView?.setupCanvas();
    this.canvasView?.render();
  }

  private applyColor(value: string): void {
    const nextColor = this.parseColorInput(value);

    if (!nextColor || !this.mount) {
      this.mount?.colorHexInput.classList.add("is-invalid");
      return;
    }

    this.mount.colorHexInput.classList.remove("is-invalid");
    this.setActiveColor(nextColor);
    this.syncInputs();
    this.syncUi();
  }

  private applyPickedColor(color: string): void {
    this.setActiveColor(color);
    this.syncInputs();
    this.syncUi();
  }

  private applyPickerColor(value: string): void {
    const nextColor = this.parseColorInput(value);

    if (!nextColor || !this.mount) {
      return;
    }

    const alpha = this.state.color.slice(6, 8);
    this.setActiveColor(`${nextColor.slice(0, 6)}${alpha}`);
    this.syncInputs();
    this.syncUi();
  }

  private selectColorSlot(slot: ColorSlot): void {
    const wasActive = this.state.activeColorSlot === slot;
    this.state.activeColorSlot = slot;
    this.state.color = this.getColorSlotValue(slot);
    this.syncInputs();
    this.syncUi();

    if (wasActive) {
      this.openColorPicker();
    }
  }

  private setActiveColor(color: string): void {
    this.state.color = color;

    if (this.state.activeColorSlot === "foreground") {
      this.state.foregroundColor = color;
      return;
    }

    this.state.backgroundColor = color;
  }

  private getColorSlotValue(slot: ColorSlot): string {
    return slot === "foreground" ? this.state.foregroundColor : this.state.backgroundColor;
  }

  private openColorPicker(): void {
    if (!this.mount) {
      return;
    }

    try {
      this.mount.colorInput.showPicker();
    } catch {
      this.mount.colorInput.click();
    }
  }

  private copySelectedPrimitive(): void {
    const selectedNodes = this.getSelectedNodes();

    if (selectedNodes.length === 0) {
      return;
    }

    this.nodeClipboard = cloneNodes(selectedNodes);
    this.syncUi();
  }

  private pastePrimitive(): void {
    if (this.nodeClipboard.length === 0) {
      return;
    }

    this.recordHistory();

    const pastedNodes = cloneNodesWithNewIds(this.nodeClipboard, { x: PASTE_OFFSET, y: PASTE_OFFSET });

    this.state.nodes.push(...pastedNodes);
    this.state.selectedNodeIds = pastedNodes.map((node) => node.id);
    this.state.redoStack = [];

    this.canvasView?.render();
  }

  private deleteSelectedPrimitive(): void {
    const selectedIds = new Set(
      this.getSelectedEntries()
        .filter((entry) => !this.isNodeOrAncestorLocked(entry) && !this.hasLockedDescendant(entry.node))
        .map((entry) => entry.node.id),
    );

    if (this.state.selectedNodeIds.length === 0) {
      this.state.selectedNodeIds = [];
      this.syncUi();
      this.canvasView?.render();
      return;
    }

    if (selectedIds.size === 0) {
      this.syncUi();
      this.canvasView?.render();
      return;
    }

    this.recordHistory();
    this.state.nodes = removeSelectedNodes(this.state.nodes, selectedIds);
    this.state.selectedNodeIds = [];
    this.state.redoStack = [];

    this.canvasView?.render();
  }

  private toggleNodeVisibility(nodeId: string): void {
    const entry = this.getNodeEntry(nodeId);

    if (!entry) {
      return;
    }

    this.recordHistory();
    entry.node.visible = !entry.node.visible;
    this.state.redoStack = [];

    this.canvasView?.render();
  }

  private toggleNodeLocked(nodeId: string): void {
    const entry = this.getNodeEntry(nodeId);

    if (!entry) {
      return;
    }

    this.recordHistory();
    entry.node.locked = !entry.node.locked;
    this.state.redoStack = [];

    this.canvasView?.render();
  }

  private groupSelection(): void {
    const selectedEntries = this.getSelectedEntries();

    if (
      selectedEntries.length < 2 ||
      selectedEntries.some((entry) => this.isNodeOrAncestorLocked(entry)) ||
      !selectedEntries.every((entry) => entry.node.type === "primitive")
    ) {
      this.syncUi();
      return;
    }

    const firstEntry = selectedEntries[0];
    const parent = firstEntry.parent;

    if (!selectedEntries.every((entry) => entry.parent === parent)) {
      this.syncUi();
      return;
    }

    const selectedIds = new Set(selectedEntries.map((entry) => entry.node.id));
    const siblings = parent ? parent.children : this.state.nodes;
    const children = siblings.filter((node) => selectedIds.has(node.id));

    if (children.length < 2) {
      return;
    }

    const group = createGroupNode(children, this.countGroups(this.state.nodes));

    this.recordHistory();
    this.replaceSiblings(parent, this.groupSelectedSiblings(siblings, selectedIds, group));
    this.state.selectedNodeIds = [group.id];
    this.state.collapsedGroupIds = this.state.collapsedGroupIds.filter((id) => id !== group.id);
    this.state.redoStack = [];

    this.canvasView?.render();
  }

  private ungroupSelection(): void {
    const selectedEntries = this.getSelectedEntries();
    const selectedEntry = selectedEntries[0];

    if (
      selectedEntries.length !== 1 ||
      !selectedEntry ||
      this.isNodeOrAncestorLocked(selectedEntry) ||
      selectedEntry.node.type !== "group"
    ) {
      this.syncUi();
      return;
    }

    const group = selectedEntry.node;

    if (group.children.length === 0) {
      return;
    }

    this.recordHistory();
    this.replaceSiblings(selectedEntry.parent, this.ungroupSiblings(this.getSiblings(selectedEntry.parent), group));
    this.state.selectedNodeIds = group.children.map((node) => node.id);
    this.state.collapsedGroupIds = this.state.collapsedGroupIds.filter((id) => id !== group.id);
    this.state.redoStack = [];

    this.canvasView?.render();
  }

  private flipHorizontalSelection(): void {
    const selectedPrimitives = this.getSelectedPrimitives();

    if (selectedPrimitives.length === 0) {
      return;
    }

    const center = this.getSelectionCenter(selectedPrimitives);

    this.recordHistory();

    for (const { primitive } of selectedPrimitives) {
      primitive.x = Math.round(center.x - (primitive.x - center.x));
      primitive.rotation = -primitive.rotation;
    }

    this.state.redoStack = [];
    this.canvasView?.render();
  }

  private flipVerticalSelection(): void {
    const selectedPrimitives = this.getSelectedPrimitives();

    if (selectedPrimitives.length === 0) {
      return;
    }

    const center = this.getSelectionCenter(selectedPrimitives);

    this.recordHistory();

    for (const { primitive } of selectedPrimitives) {
      primitive.y = Math.round(center.y - (primitive.y - center.y));
      primitive.rotation = 180 - primitive.rotation;
    }

    this.state.redoStack = [];
    this.canvasView?.render();
  }

  private scaleWholeSprite(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      return;
    }

    const entries = getEditablePrimitiveNodeEntries(this.state.nodes).filter((entry) => !entry.locked);

    if (entries.length === 0) {
      return;
    }

    this.recordHistory();
    const center = {
      x: this.state.spriteWidth / 2,
      y: this.state.spriteHeight / 2,
    };

    for (const entry of entries) {
      scalePrimitiveAround(entry.command, center, factor);
    }

    this.state.redoStack = [];
    this.canvasView?.render();
  }

  private moveSelectedLayer(target: LayerMoveTarget): void {
    const selectedEntries = this.getSelectedEntries();

    if (selectedEntries.length === 0 || !this.isSameParentSelection(selectedEntries)) {
      this.syncUi();
      return;
    }

    const firstEntry = selectedEntries[0];

    if (!firstEntry) {
      return;
    }

    const parent = firstEntry.parent;
    const siblings = this.getSiblings(parent);

    if (siblings.length < 2) {
      this.syncUi();
      return;
    }

    const selectedIds = new Set(selectedEntries.map((entry) => entry.node.id));
    const selectedIndexes = selectedEntries.map((entry) => entry.index);
    const selectedNodes = siblings.filter((node) => selectedIds.has(node.id));
    const remainingNodes = siblings.filter((node) => !selectedIds.has(node.id));
    const nextIndex = this.getNextLayerIndex(selectedIndexes, remainingNodes.length, target);
    const nextNodes = insertNodes(remainingNodes, selectedNodes, nextIndex);

    if (arraysEqual(siblings, nextNodes)) {
      this.syncUi();
      return;
    }

    this.recordHistory();
    this.replaceSiblings(parent, nextNodes);
    this.state.selectedNodeIds = selectedNodes.map((node) => node.id);
    this.state.redoStack = [];

    this.canvasView?.render();
  }

  private moveNodeFromList(nodeId: string, direction: "up" | "down"): void {
    const entry = this.getNodeEntry(nodeId);

    if (!entry) {
      return;
    }

    const siblings = this.getSiblings(entry.parent);
    const offset = direction === "up" ? -1 : 1;
    const nextIndex = entry.index + offset;

    if (nextIndex < 0 || nextIndex >= siblings.length) {
      this.syncUi();
      return;
    }

    const nextSiblings = [...siblings];
    const currentNode = nextSiblings[entry.index];
    const swappedNode = nextSiblings[nextIndex];

    if (!currentNode || !swappedNode) {
      return;
    }

    nextSiblings[entry.index] = swappedNode;
    nextSiblings[nextIndex] = currentNode;

    this.recordHistory();
    this.replaceSiblings(entry.parent, nextSiblings);
    this.state.selectedNodeIds = this.sortNodeIdsByTreeOrder(this.state.selectedNodeIds);
    this.state.redoStack = [];

    this.canvasView?.render();
  }

  private syncUi(): void {
    this.renderPrimitiveList();
    this.syncSelectedControls();
    this.syncStatus();
    this.syncShellHistoryControls();
    this.assetChangeListener?.(this.getSpriteAssetData());
  }

  private syncInputs(): void {
    if (!this.mount) {
      return;
    }

    this.mount.spriteIdInput.value = this.state.spriteId;
    this.mount.canvasWidthInput.value = String(this.state.spriteWidth);
    this.mount.canvasHeightInput.value = String(this.state.spriteHeight);
    this.mount.colorInput.value = `#${this.state.color.slice(0, 6)}`;
    this.mount.colorHexInput.value = this.state.color;
    this.mount.colorHexInput.classList.remove("is-invalid");
    this.mount.foregroundColorButton.style.setProperty("--sprite-color", this.toCssColor(this.state.foregroundColor));
    this.mount.backgroundColorButton.style.setProperty("--sprite-color", this.toCssColor(this.state.backgroundColor));
    this.mount.foregroundColorButton.classList.toggle("is-active", this.state.activeColorSlot === "foreground");
    this.mount.backgroundColorButton.classList.toggle("is-active", this.state.activeColorSlot === "background");
  }

  private syncToolButtons(): void {
    this.mount?.toolButtons.forEach((button) => {
      button.classList.toggle("is-active", this.state.activeTool !== null && button.dataset.kind === this.state.activeTool);
    });
  }

  private syncSelectedControls(): void {
    if (!this.mount) {
      return;
    }

    const selectedPrimitives = this.getSelectedPrimitives();
    const selectedEntries = this.getSelectedEntries();
    const selectedIndexes = selectedEntries.map((entry) => entry.index);
    const firstEntry = selectedEntries[0];
    const siblings = firstEntry && this.isSameParentSelection(selectedEntries) ? this.getSiblings(firstEntry.parent) : [];
    const hasSelection = selectedPrimitives.length > 0;
    const isAtBack = selectedIndexes.every((index, position) => index === position);
    const frontStartIndex = siblings.length - selectedIndexes.length;
    const isAtFront = selectedIndexes.every((index, position) => index === frontStartIndex + position);
    const selectedGroupCount = selectedEntries.filter((entry) => entry.node.type === "group").length;
    const canEditSelectedEntries = selectedEntries.every((entry) => !this.isNodeOrAncestorLocked(entry));
    const canDelete = selectedEntries.some((entry) => !this.isNodeOrAncestorLocked(entry) && !this.hasLockedDescendant(entry.node));
    const canGroup =
      selectedEntries.length > 1 &&
      canEditSelectedEntries &&
      this.isSameParentSelection(selectedEntries) &&
      selectedEntries.every((entry) => entry.node.type === "primitive");
    const canUngroup = selectedEntries.length === 1 && canEditSelectedEntries && firstEntry?.node.type === "group";

    this.mount.flipHorizontalButton.disabled = !hasSelection;
    this.mount.flipVerticalButton.disabled = !hasSelection;
    this.mount.sendToBackButton.disabled = selectedEntries.length === 0 || !this.isSameParentSelection(selectedEntries) || isAtBack;
    this.mount.sendBackwardButton.disabled = selectedEntries.length === 0 || !this.isSameParentSelection(selectedEntries) || isAtBack;
    this.mount.bringForwardButton.disabled = selectedEntries.length === 0 || !this.isSameParentSelection(selectedEntries) || isAtFront;
    this.mount.bringToFrontButton.disabled = selectedEntries.length === 0 || !this.isSameParentSelection(selectedEntries) || isAtFront;
    this.mount.scaleSpriteUpButton.disabled = getEditablePrimitiveNodeEntries(this.state.nodes).every((entry) => entry.locked);
    this.mount.scaleSpriteDownButton.disabled = getEditablePrimitiveNodeEntries(this.state.nodes).every((entry) => entry.locked);
    this.mount.groupButton.disabled = !canGroup;
    this.mount.ungroupButton.disabled = !canUngroup;
    this.mount.copyPrimitiveButton.disabled = selectedEntries.length === 0;
    this.mount.deletePrimitiveButton.disabled = !canDelete;
    this.mount.pastePrimitiveButton.disabled = this.nodeClipboard.length === 0;
    this.mount.undoButton.disabled = this.state.undoStack.length === 0;
    this.mount.redoButton.disabled = this.state.redoStack.length === 0;
    if (selectedEntries.length === 0) {
      this.mount.selectionSummary.textContent = "Selected: none";
    } else if (selectedEntries.length === 1 && selectedGroupCount === 1) {
      this.mount.selectionSummary.textContent = "Selected: 1 group";
    } else if (selectedEntries.length === 1) {
      this.mount.selectionSummary.textContent = "Selected: 1 node";
    } else {
      this.mount.selectionSummary.textContent = `Selected: ${selectedEntries.length} nodes`;
    }
  }

  private syncStatus(): void {
    if (!this.mount) {
      return;
    }

    const primitiveCount = getEditablePrimitiveNodeEntries(this.state.nodes).length;
    this.mount.statusElement.textContent = `${this.state.spriteId} - ${this.state.spriteWidth}x${this.state.spriteHeight} - ${primitiveCount} primitive${
      primitiveCount === 1 ? "" : "s"
    }`;
  }

  private syncShellHistoryControls(): void {
    const undoButton = document.querySelector<HTMLButtonElement>('[data-shell-action="undo"]');
    const redoButton = document.querySelector<HTMLButtonElement>('[data-shell-action="redo"]');

    if (undoButton !== null) {
      undoButton.disabled = !this.canUndo();
    }

    if (redoButton !== null) {
      redoButton.disabled = !this.canRedo();
    }
  }

  private clearSelectionOrTool(): void {
    if (this.canvasView?.cancelInteraction()) {
      this.state.activeTool = null;
      this.syncToolButtons();
      return;
    }

    if (this.state.activeTool !== null) {
      this.state.activeTool = null;
      this.syncToolButtons();
      this.canvasView?.render();
      return;
    }

    this.state.selectedNodeIds = [];
    this.canvasView?.render();
  }

  private recordHistory(): void {
    this.state.undoStack.push(createHistorySnapshot(this.state));
  }

  private parseColorInput(value: string): string | null {
    const trimmedValue = value.trim();
    const match = /^(?:#|0x)?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/i.exec(trimmedValue);

    if (!match) {
      return null;
    }

    return `${match[1].toLowerCase()}${(match[2] ?? "ff").toLowerCase()}`;
  }

  private toCssColor(color: string): string {
    const red = Number.parseInt(color.slice(0, 2), 16);
    const green = Number.parseInt(color.slice(2, 4), 16);
    const blue = Number.parseInt(color.slice(4, 6), 16);
    const alpha = Number.parseInt(color.slice(6, 8), 16) / 255;

    return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
  }

  private getSelectedPrimitives(): SelectedPrimitive[] {
    const editableCommands = new Set(
      getEditablePrimitiveNodeEntries(this.state.nodes)
        .filter((entry) => !entry.locked)
        .map((entry) => entry.command),
    );
    const selectedCommands = new Set<Primitive>();

    return this.getSelectedEditableNodes().flatMap((node) => {
      return getPrimitiveCommandsForNode(node).flatMap((primitive) => {
        if (!editableCommands.has(primitive) || selectedCommands.has(primitive)) {
          return [];
        }

        selectedCommands.add(primitive);
        return [{ primitive }];
      });
    });
  }

  private getSelectionCenter(selectedPrimitives: SelectedPrimitive[]): { x: number; y: number } {
    const bounds = this.getSelectionBounds(selectedPrimitives);

    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
  }

  private getSelectionBounds(selectedPrimitives: SelectedPrimitive[]): PrimitiveBounds {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const { primitive } of selectedPrimitives) {
      const bounds = this.getPrimitiveBounds(primitive);

      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }

    return { minX, minY, maxX, maxY };
  }

  private getPrimitiveBounds(primitive: Primitive): PrimitiveBounds {
    const height = primitive.kind === "circle" && primitive.h <= 0 ? primitive.w : primitive.h;

    return {
      minX: primitive.x - primitive.w / 2,
      minY: primitive.y - height / 2,
      maxX: primitive.x + primitive.w / 2,
      maxY: primitive.y + height / 2,
    };
  }

  private getNextLayerIndex(selectedIndexes: number[], remainingLength: number, target: LayerMoveTarget): number {
    const minSelectedIndex = Math.min(...selectedIndexes);

    if (target === "back") {
      return 0;
    }

    if (target === "backward") {
      return Math.max(0, minSelectedIndex - 1);
    }

    if (target === "forward") {
      return Math.min(remainingLength, minSelectedIndex + 1);
    }

    return remainingLength;
  }

  private clampSelection(): void {
    const nodeIds = new Set(getSceneNodeEntries(this.state.nodes).map((entry) => entry.node.id));

    this.state.selectedNodeIds = this.state.selectedNodeIds.filter((nodeId) => nodeIds.has(nodeId));
  }

  private getSelectedNodes(): SceneNode[] {
    return this.getSelectedEntries().map((entry) => entry.node);
  }

  private getSelectedEditableNodes(): SceneNode[] {
    return this.getSelectedEntries().filter((entry) => !this.isNodeOrAncestorLocked(entry)).map((entry) => entry.node);
  }

  private getSelectedEntries(): SceneNodeEntry[] {
    const selectedIds = new Set(this.state.selectedNodeIds);

    return getSceneNodeEntries(this.state.nodes).filter((entry) => selectedIds.has(entry.node.id));
  }

  private getNodeEntry(nodeId: string): SceneNodeEntry | null {
    return getSceneNodeEntries(this.state.nodes).find((entry) => entry.node.id === nodeId) ?? null;
  }

  private sortNodeIdsByTreeOrder(nodeIds: string[]): string[] {
    const selectedIds = new Set(nodeIds);

    return getSceneNodeEntries(this.state.nodes).flatMap((entry) => (selectedIds.has(entry.node.id) ? [entry.node.id] : []));
  }

  private toggleGroupCollapsed(nodeId: string): void {
    const collapsedIds = new Set(this.state.collapsedGroupIds);

    if (collapsedIds.has(nodeId)) {
      collapsedIds.delete(nodeId);
    } else {
      collapsedIds.add(nodeId);
    }

    this.state.collapsedGroupIds = [...collapsedIds];
    this.renderPrimitiveList();
  }

  private isSameParentSelection(entries: readonly SceneNodeEntry[]): boolean {
    const firstEntry = entries[0];

    return firstEntry !== undefined && entries.every((entry) => entry.parent === firstEntry.parent);
  }

  private getSiblings(parent: GroupNode | null): SceneNode[] {
    return parent ? parent.children : this.state.nodes;
  }

  private replaceSiblings(parent: GroupNode | null, nextSiblings: SceneNode[]): void {
    if (parent) {
      parent.children = nextSiblings;
    } else {
      this.state.nodes = nextSiblings;
    }
  }

  private groupSelectedSiblings(siblings: readonly SceneNode[], selectedIds: ReadonlySet<string>, group: GroupNode): SceneNode[] {
    const groupedSiblings: SceneNode[] = [];
    let didInsertGroup = false;

    for (const node of siblings) {
      if (!selectedIds.has(node.id)) {
        groupedSiblings.push(node);
        continue;
      }

      if (!didInsertGroup) {
        groupedSiblings.push(group);
        didInsertGroup = true;
      }
    }

    return groupedSiblings;
  }

  private ungroupSiblings(siblings: readonly SceneNode[], group: GroupNode): SceneNode[] {
    return siblings.flatMap((node) => (node.id === group.id ? group.children : [node]));
  }

  private countGroups(nodes: readonly SceneNode[]): number {
    return nodes.reduce((count, node) => {
      return count + (node.type === "group" ? 1 + this.countGroups(node.children) : 0);
    }, 0);
  }

  private isNodeOrAncestorLocked(entry: SceneNodeEntry): boolean {
    if (entry.node.locked) {
      return true;
    }

    let parent = entry.parent;

    while (parent) {
      if (parent.locked) {
        return true;
      }

      const parentEntry = this.getNodeEntry(parent.id);
      parent = parentEntry?.parent ?? null;
    }

    return false;
  }

  private hasLockedDescendant(node: SceneNode): boolean {
    if (node.type === "primitive") {
      return false;
    }

    return node.children.some((child) => child.locked || this.hasLockedDescendant(child));
  }
}

function bindCommitInput(input: HTMLInputElement, commit: () => void): void {
  input.addEventListener("blur", commit);
  input.addEventListener("change", commit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  });
}

function isCanvasDimension(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= maximumCanvasSize;
}

function normalizeCanvasDimension(value: number): number {
  if (!Number.isFinite(value)) {
    return 256;
  }

  return Math.min(maximumCanvasSize, Math.max(1, Math.round(value)));
}

function removeSelectedNodes(nodes: readonly SceneNode[], selectedIds: ReadonlySet<string>): SceneNode[] {
  const visit = (node: SceneNode): SceneNode | null => {
    if (selectedIds.has(node.id)) {
      return null;
    }

    if (node.type === "primitive") {
      return node;
    }

    const children = node.children.flatMap((child) => {
      const nextChild = visit(child);

      return nextChild ? [nextChild] : [];
    });

    if (children.length === 0) {
      return null;
    }

    return {
      ...node,
      children,
    };
  };

  return nodes.flatMap((node) => {
    const nextNode = visit(node);

    return nextNode ? [nextNode] : [];
  });
}

function isToolKind(value: string | undefined): value is NonNullable<ToolKind> {
  return (
    value === "rect" ||
    value === "circle" ||
    value === "triangle" ||
    value === "fill" ||
    value === "eyedropper" ||
    value === "rotate" ||
    value === "transform" ||
    value === "scale"
  );
}

function isCreateToolKind(tool: ToolKind): tool is "rect" | "circle" | "triangle" {
  return tool === "rect" || tool === "circle" || tool === "triangle";
}

function insertNodes(nodes: SceneNode[], insertedNodes: SceneNode[], index: number): SceneNode[] {
  return [...nodes.slice(0, index), ...insertedNodes, ...nodes.slice(index)];
}

function arraysEqual(left: SceneNode[], right: SceneNode[]): boolean {
  return left.length === right.length && left.every((node, index) => node === right[index]);
}

function scalePrimitiveAround(primitive: Primitive, center: { x: number; y: number }, factor: number): void {
  const x = center.x + (primitive.x - center.x) * factor;
  const y = center.y + (primitive.y - center.y) * factor;
  const w = primitive.w * factor;

  primitive.x = toFiniteInteger(x, primitive.x);
  primitive.y = toFiniteInteger(y, primitive.y);
  primitive.w = toPositiveInteger(w, primitive.w);
  primitive.h = getScaledPrimitiveHeight(primitive, factor);
}

function getScaledPrimitiveHeight(primitive: Primitive, factor: number): number {
  if (primitive.kind === "circle" && primitive.h === 0) {
    return 0;
  }

  return toPositiveInteger(primitive.h * factor, primitive.h);
}

function toFiniteInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.round(value) : Math.round(fallback);
}

function toPositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return Math.max(1, Math.round(fallback));
  }

  return Math.max(1, Math.round(value));
}

function matchesHotkey(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const wantsShift = parts.includes("shift");
  const wantsMod = parts.includes("mod");
  const wantsAlt = parts.includes("alt");
  const isMod = event.metaKey || event.ctrlKey;

  if (event.shiftKey !== wantsShift) {
    return false;
  }

  if (isMod !== wantsMod) {
    return false;
  }

  if (event.altKey !== wantsAlt) {
    return false;
  }

  return normalizeKey(event) === key;
}

function normalizeKey(event: KeyboardEvent): string {
  if (event.code === "BracketLeft") {
    return "[";
  }

  if (event.code === "BracketRight") {
    return "]";
  }

  if (event.key === " ") {
    return "space";
  }

  return event.key.toLowerCase();
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
