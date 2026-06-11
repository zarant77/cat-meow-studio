import type { SceneNode } from "../document/CatPaintDocument.js";
import { cloneNodes } from "../document/CatPaintDocument.js";
import type { ShapePrimitiveKind, ToolKind } from "../primitives/Primitive.js";

export type AppState = {
  spriteId: string;
  spriteWidth: number;
  spriteHeight: number;
  pivotX: number;
  pivotY: number;
  activeTool: ToolKind;
  activeKind: ShapePrimitiveKind;
  color: string;
  foregroundColor: string;
  backgroundColor: string;
  activeColorSlot: "foreground" | "background";
  nodes: SceneNode[];
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  selectedNodeIds: string[];
  collapsedGroupIds: string[];
  exampleImage: ExampleImageState;
  canvasZoom: number;
};

export type HistorySnapshot = {
  spriteId: string;
  spriteWidth: number;
  spriteHeight: number;
  pivotX: number;
  pivotY: number;
  nodes: SceneNode[];
  selectedNodeIds: string[];
};

export type ExampleImageState = {
  image: HTMLImageElement | null;
  name: string;
  opacity: number;
  offsetX: number;
  offsetY: number;
  scale: number;
};

export function createInitialState(): AppState {
  return {
    spriteId: "sprite",
    spriteWidth: 256,
    spriteHeight: 256,
    pivotX: 128,
    pivotY: 128,
    activeTool: null,
    activeKind: "rect",
    color: "111111ff",
    foregroundColor: "111111ff",
    backgroundColor: "ffffffff",
    activeColorSlot: "foreground",
    nodes: [],
    undoStack: [],
    redoStack: [],
    selectedNodeIds: [],
    collapsedGroupIds: [],
    canvasZoom: 1,
    exampleImage: {
      image: null,
      name: "",
      opacity: 0.5,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    },
  };
}

export function createHistorySnapshot(state: AppState): HistorySnapshot {
  return {
    spriteId: state.spriteId,
    spriteWidth: state.spriteWidth,
    spriteHeight: state.spriteHeight,
    pivotX: state.pivotX,
    pivotY: state.pivotY,
    nodes: cloneNodes(state.nodes),
    selectedNodeIds: [...state.selectedNodeIds],
  };
}

export function applyHistorySnapshot(state: AppState, snapshot: HistorySnapshot): void {
  state.spriteId = snapshot.spriteId;
  state.spriteWidth = snapshot.spriteWidth;
  state.spriteHeight = snapshot.spriteHeight;
  state.pivotX = snapshot.pivotX;
  state.pivotY = snapshot.pivotY;
  state.nodes = cloneNodes(snapshot.nodes);
  state.selectedNodeIds = [...snapshot.selectedNodeIds];
}
