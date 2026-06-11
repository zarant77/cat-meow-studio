import type { SpriteAssetData } from "../model/assets.js";
import { createPrimitiveNodes, type GroupNode, type PrimitiveNode, type SceneNode } from "../sprites/document/CatPaintDocument.js";
import type { PathPoint, PathPrimitive, Primitive, ShapePrimitiveKind } from "../sprites/primitives/Primitive.js";
import { normalizePathPrimitive } from "../sprites/primitives/pathPrimitive.js";
import { isValidSoundId } from "../utils/symbolName.js";

export type ImportSpriteJsonResult =
  | {
      ok: true;
      sprite: SpriteAssetData;
    }
  | {
      ok: false;
      error: string;
    };

export function importSpriteJson(text: string): ImportSpriteJsonResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return fail("The file is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    return fail("The sprite file must be a JSON object.");
  }

  if (parsed.version !== 1 && parsed.version !== 2) {
    return fail("Sprite version must be 1 or 2.");
  }

  if (typeof parsed.id !== "string" || !isValidSoundId(parsed.id)) {
    return fail("The sprite id is empty or contains unsupported characters.");
  }

  const width = parseCanvasDimension(parsed.width);
  const height = parseCanvasDimension(parsed.height);

  if (width === null || height === null) {
    return fail("Sprite width and height must be integers from 1 to 1020.");
  }

  if (!isInteger(parsed.pivotX) || !isInteger(parsed.pivotY)) {
    return fail("Sprite pivotX and pivotY must be integers.");
  }

  const nodes = parseSpriteNodes(parsed);

  if (nodes === null) {
    return fail("Sprite nodes or primitives are not valid.");
  }

  return {
    ok: true,
    sprite: {
      spriteId: parsed.id,
      width,
      height,
      pivotX: parsed.pivotX,
      pivotY: parsed.pivotY,
      nodes,
    },
  };
}

function parseSpriteNodes(parsed: Record<string, unknown>): SceneNode[] | null {
  if (Array.isArray(parsed.nodes)) {
    return parseNodes(parsed.nodes);
  }

  if (Array.isArray(parsed.primitives)) {
    const primitives = parsePrimitives(parsed.primitives, { skipInvalid: false });

    return primitives === null ? null : createPrimitiveNodes(primitives);
  }

  return null;
}

function parseNodes(values: unknown[]): SceneNode[] {
  const nodes: SceneNode[] = [];
  const usedIds = new Set<string>();

  values.forEach((value, index) => {
    const node = parseNode(value, index, usedIds);

    if (node !== null) {
      nodes.push(node);
    }
  });

  return nodes;
}

function parseNode(value: unknown, index: number, usedIds: Set<string>): SceneNode | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.type === "primitive") {
    const primitive = parsePrimitive(value.primitive);

    if (primitive === null) {
      return null;
    }

    return {
      id: parseNodeId(value.id, "primitive", usedIds),
      type: "primitive",
      name: parseNodeName(value.name, `Primitive ${index + 1}`),
      visible: parseNodeBoolean(value.visible, true),
      locked: parseNodeBoolean(value.locked, false),
      command: primitive,
    } satisfies PrimitiveNode;
  }

  if (value.type === "group") {
    const children = Array.isArray(value.children) ? parseNodesWithUsedIds(value.children, usedIds) : [];

    return {
      id: parseNodeId(value.id, "group", usedIds),
      type: "group",
      name: parseNodeName(value.name, `Group ${index + 1}`),
      visible: parseNodeBoolean(value.visible, true),
      locked: parseNodeBoolean(value.locked, false),
      children,
    } satisfies GroupNode;
  }

  return null;
}

function parseNodesWithUsedIds(values: unknown[], usedIds: Set<string>): SceneNode[] {
  const nodes: SceneNode[] = [];

  values.forEach((value, index) => {
    const node = parseNode(value, index, usedIds);

    if (node !== null) {
      nodes.push(node);
    }
  });

  return nodes;
}

function parseNodeId(value: unknown, prefix: string, usedIds: Set<string>): string {
  const baseId = typeof value === "string" && value.trim() !== "" ? value.trim() : createImportedNodeId(prefix, usedIds.size);
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function createImportedNodeId(prefix: string, index: number): string {
  return `${prefix}-imported-${index + 1}`;
}

function parseNodeName(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const name = value.trim();

  return name === "" ? fallback : name;
}

function parseNodeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parsePrimitives(values: unknown[], options: { skipInvalid: boolean }): Primitive[] | null {
  const primitives: Primitive[] = [];

  for (const value of values) {
    const primitive = parsePrimitive(value);

    if (primitive === null) {
      if (options.skipInvalid) {
        continue;
      }

      return null;
    }

    primitives.push(primitive);
  }

  return primitives;
}

function parsePrimitive(value: unknown): Primitive | null {
  if (isRecord(value) && value.kind === "path") {
    return parsePathPrimitive(value);
  }

  if (
    !isRecord(value) ||
    !isShapePrimitiveKind(value.kind) ||
    !isInteger(value.x) ||
    !isInteger(value.y) ||
    !isInteger(value.w) ||
    !isInteger(value.h) ||
    !isNumber(value.rotation) ||
    !isRgba(value.color)
  ) {
    return null;
  }

  return {
    kind: value.kind,
    x: value.x,
    y: value.y,
    w: value.w,
    h: value.h,
    rotation: value.rotation,
    color: value.color,
  };
}

function parsePathPrimitive(value: Record<string, unknown>): PathPrimitive | null {
  if (!Array.isArray(value.points) || !isPositiveNumber(value.thickness) || !isRgba(value.color)) {
    return null;
  }

  const points = parsePathPoints(value.points);

  if (points === null) {
    return null;
  }

  return normalizePathPrimitive({
    kind: "path",
    points,
    thickness: value.thickness,
    cap: isPathCap(value.cap) ? value.cap : "round",
    join: "round",
    smoothing: isPathSmoothing(value.smoothing) ? value.smoothing : "none",
    segments: isPositiveNumber(value.segments) ? value.segments : 8,
    color: value.color,
  });
}

function parsePathPoints(values: unknown[]): PathPoint[] | null {
  const points: PathPoint[] = [];

  for (const value of values) {
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      !isNumber(value[0]) ||
      !isNumber(value[1])
    ) {
      return null;
    }

    points.push([Math.round(value[0]), Math.round(value[1])]);
  }

  return points.length >= 2 ? points : null;
}

function parseCanvasDimension(value: unknown): number | null {
  if (!isInteger(value) || value < 1 || value > 1020) {
    return null;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isShapePrimitiveKind(value: unknown): value is ShapePrimitiveKind {
  return value === "rect" || value === "circle" || value === "triangle";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

function isPathCap(value: unknown): value is NonNullable<PathPrimitive["cap"]> {
  return value === "butt" || value === "round";
}

function isPathSmoothing(value: unknown): value is NonNullable<PathPrimitive["smoothing"]> {
  return value === "none" || value === "quadratic";
}

function isRgba(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}$/.test(value);
}

function fail(error: string): ImportSpriteJsonResult {
  return {
    ok: false,
    error,
  };
}
