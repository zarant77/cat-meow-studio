import type { SpriteAssetData } from "../model/assets.js";
import type { SceneNode } from "../sprites/document/CatPaintDocument.js";
import type { Primitive } from "../sprites/primitives/Primitive.js";
import { normalizePathPrimitive } from "../sprites/primitives/pathPrimitive.js";
import { isValidSoundId } from "../utils/symbolName.js";

type ExportedSpritePrimitive = ExportedSpriteShapePrimitive | ExportedSpritePathPrimitive;

interface ExportedSpriteShapePrimitive {
  kind: "rect" | "circle" | "triangle";
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
}

interface ExportedSpritePathPrimitive {
  kind: "path";
  points: [number, number][];
  thickness: number;
  cap: "butt" | "round";
  join: "round";
  smoothing: "none" | "quadratic";
  segments: number;
  color: string;
}

type ExportedSpriteNode = ExportedPrimitiveNode | ExportedGroupNode;

interface ExportedPrimitiveNode {
  type: "primitive";
  id: string;
  name?: string;
  visible?: boolean;
  locked?: boolean;
  primitive: ExportedSpritePrimitive;
}

interface ExportedGroupNode {
  type: "group";
  id: string;
  name?: string;
  visible?: boolean;
  locked?: boolean;
  children: ExportedSpriteNode[];
}

interface ExportedSpriteJson {
  version: 2;
  id: string;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
  nodes: ExportedSpriteNode[];
}

export function exportSpriteJson(sprite: SpriteAssetData): string | null {
  if (!isValidSoundId(sprite.spriteId)) {
    return null;
  }

  const exportedSprite: ExportedSpriteJson = {
    version: 2,
    id: sprite.spriteId,
    width: toInteger(sprite.width),
    height: toInteger(sprite.height),
    pivotX: toInteger(sprite.pivotX),
    pivotY: toInteger(sprite.pivotY),
    nodes: sprite.nodes.map(exportNode),
  };

  return `${JSON.stringify(exportedSprite, null, 2)}\n`;
}

function exportNode(node: SceneNode): ExportedSpriteNode {
  if (node.type === "primitive") {
    return {
      type: "primitive",
      id: node.id,
      name: node.name,
      visible: node.visible,
      locked: node.locked,
      primitive: exportPrimitive(node.command),
    };
  }

  return {
    type: "group",
    id: node.id,
    name: node.name,
    visible: node.visible,
    locked: node.locked,
    children: node.children.map(exportNode),
  };
}

function exportPrimitive(primitive: Primitive): ExportedSpritePrimitive {
  if (primitive.kind === "path") {
    const path = normalizePathPrimitive(primitive);

    return {
      kind: "path",
      points: path.points,
      thickness: path.thickness,
      cap: path.cap ?? "round",
      join: path.join ?? "round",
      smoothing: path.smoothing ?? "none",
      segments: path.segments ?? 8,
      color: isRgba(path.color) ? path.color : "000000ff",
    };
  }

  return {
    kind: primitive.kind,
    x: toInteger(primitive.x),
    y: toInteger(primitive.y),
    w: toInteger(primitive.w),
    h: toInteger(primitive.h),
    rotation: primitive.rotation,
    color: isRgba(primitive.color) ? primitive.color : "000000ff",
  };
}

function toInteger(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function isRgba(value: string): boolean {
  return /^[0-9a-f]{8}$/.test(value);
}
