import type { SpriteAssetData } from "../model/assets.js";
import { createPrimitiveNodes } from "../sprites/document/CatPaintDocument.js";
import type { Primitive, PrimitiveKind } from "../sprites/primitives/Primitive.js";
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

  if (parsed.version !== 1) {
    return fail("Sprite version must be 1.");
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

  if (!Array.isArray(parsed.primitives)) {
    return fail("Sprite primitives must be an array.");
  }

  const primitives = parsePrimitives(parsed.primitives);

  if (primitives === null) {
    return fail("Sprite primitives are not valid.");
  }

  return {
    ok: true,
    sprite: {
      spriteId: parsed.id,
      width,
      height,
      pivotX: parsed.pivotX,
      pivotY: parsed.pivotY,
      nodes: createPrimitiveNodes(primitives),
    },
  };
}

function parsePrimitives(values: unknown[]): Primitive[] | null {
  const primitives: Primitive[] = [];

  for (const value of values) {
    const primitive = parsePrimitive(value);

    if (primitive === null) {
      return null;
    }

    primitives.push(primitive);
  }

  return primitives;
}

function parsePrimitive(value: unknown): Primitive | null {
  if (
    !isRecord(value) ||
    !isPrimitiveKind(value.kind) ||
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

function parseCanvasDimension(value: unknown): number | null {
  if (!isInteger(value) || value < 1 || value > 1020) {
    return null;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrimitiveKind(value: unknown): value is PrimitiveKind {
  return value === "rect" || value === "circle" || value === "triangle";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
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
