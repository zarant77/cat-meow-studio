import type { SpriteAssetData, SpritePaletteColor } from "../model/assets.js";
import { createPrimitiveNodes, type SceneNode } from "../sprites/document/CatPaintDocument.js";
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

interface ImportedSpriteCommand {
  kind: PrimitiveKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: number;
}

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

  if (parsed.type !== "sprite") {
    return fail('Wrong file type. Sprite mode expects a "sprite" JSON file.');
  }

  if (typeof parsed.id !== "string" || !isValidSoundId(parsed.id)) {
    return fail("The sprite id is empty or contains unsupported characters.");
  }

  const width = parseCanvasSize(parsed.width);
  const height = parseCanvasSize(parsed.height);

  if (width === null || height === null) {
    return fail("Sprite width and height must use a supported canvas size.");
  }

  const palette = parsePalette(parsed.palette);

  if (palette === null) {
    return fail("Sprite palette must be an array of RGBA hex strings.");
  }

  const nodes = Array.isArray(parsed.nodes) ? parseNodes(parsed.nodes, palette) : null;

  if (Array.isArray(parsed.nodes) && nodes === null) {
    return fail("Sprite nodes are not valid.");
  }

  const commands = Array.isArray(parsed.commands) ? parseCommands(parsed.commands, palette) : null;

  if (nodes === null && commands === null) {
    return fail("Sprite commands must be an array.");
  }

  return {
    ok: true,
    sprite: {
      spriteId: parsed.id,
      width,
      height,
      pivotX: Math.floor(width / 2),
      pivotY: height,
      palette,
      nodes: nodes ?? createPrimitiveNodes(commands ?? []),
    },
  };
}

function parsePalette(value: unknown): SpritePaletteColor[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const palette: SpritePaletteColor[] = [];

  for (let index = 0; index < Math.min(value.length, 256); index += 1) {
    const rgba = parseRgba(value[index]);

    if (rgba === null) {
      return null;
    }

    palette.push({
      name: `Color ${index + 1}`,
      rgba,
    });
  }

  if (palette.length === 0) {
    return null;
  }

  return palette;
}

function parseNodes(values: unknown[], palette: readonly SpritePaletteColor[]): SceneNode[] | null {
  const nodes: SceneNode[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const node = parseNode(values[index], palette, index);

    if (node === null) {
      return null;
    }

    nodes.push(node);
  }

  return nodes;
}

function parseNode(value: unknown, palette: readonly SpritePaletteColor[], index: number): SceneNode | null {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.visible !== "boolean" || typeof value.locked !== "boolean") {
    return null;
  }

  if (value.type === "primitive") {
    const command = parseCommand(value.command, palette);

    if (command === null) {
      return null;
    }

    return {
      id: createNodeId("primitive"),
      type: "primitive",
      name: value.name,
      visible: value.visible,
      locked: value.locked,
      command,
    };
  }

  if (value.type !== "group" || !Array.isArray(value.children)) {
    return null;
  }

  const children = parseNodes(value.children, palette);

  if (children === null) {
    return null;
  }

  return {
    id: createNodeId(`group-${index + 1}`),
    type: "group",
    name: value.name,
    visible: value.visible,
    locked: value.locked,
    children,
  };
}

function parseCommands(values: unknown[], palette: readonly SpritePaletteColor[]): Primitive[] | null {
  const commands: Primitive[] = [];

  for (const value of values) {
    const command = parseCommand(value, palette);

    if (command === null) {
      return null;
    }

    commands.push(command);
  }

  return commands;
}

function parseCommand(value: unknown, palette: readonly SpritePaletteColor[]): Primitive | null {
  if (!isRecord(value) || !isPrimitiveKind(value.kind)) {
    return null;
  }

  const imported = readImportedCommand(value);

  if (imported === null || imported.color < 0 || imported.color >= palette.length) {
    return null;
  }

  const rgba = palette[imported.color]?.rgba;

  if (rgba === undefined) {
    return null;
  }

  return {
    kind: imported.kind,
    x: imported.x,
    y: imported.y,
    w: imported.w,
    h: imported.h,
    rotation: imported.rotation,
    color: rgba.slice(0, 7),
    alpha: Number.parseInt(rgba.slice(7, 9), 16),
  };
}

function readImportedCommand(value: Record<string, unknown>): ImportedSpriteCommand | null {
  if (
    !isPrimitiveKind(value.kind) ||
    !isNumber(value.x) ||
    !isNumber(value.y) ||
    !isNumber(value.w) ||
    !isNumber(value.h) ||
    !isNumber(value.rotation) ||
    !isInteger(value.color)
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

function parseCanvasSize(value: unknown): number | null {
  const sizes = [32, 64, 96, 128, 192, 256, 512, 768, 1024];

  return typeof value === "number" && sizes.includes(value) ? value : null;
}

function parseRgba(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.startsWith("#") ? value : `#${value}`;

  return /^#[0-9a-fA-F]{8}$/.test(normalized) ? normalized.toLowerCase() : null;
}

function createNodeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function fail(error: string): ImportSpriteJsonResult {
  return {
    ok: false,
    error,
  };
}
