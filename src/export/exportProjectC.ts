import { exportMusicC } from "./exportMusicC.js";
import { exportSoundC } from "./exportSoundC.js";
import type { Project, SpriteProjectAsset } from "../model/assets.js";
import { flattenNodes } from "../sprites/document/CatPaintDocument.js";
import type { Primitive, PrimitiveKind } from "../sprites/primitives/Primitive.js";

export interface GeneratedCFile {
  fileName: string;
  source: string;
}

interface NamedPrimitive {
  primitive: Primitive;
  paletteIndex: number;
}

export function exportProjectSpritesC(project: Project): GeneratedCFile | null {
  const sprites = project.assets.filter((asset): asset is SpriteProjectAsset => asset.kind === "sprite");

  if (sprites.length === 0) {
    return null;
  }

  const palette = project.spritePalette.slice(0, 256);
  const spriteBlocks = sprites.map((sprite) => formatSpriteBlock(sprite, palette));

  return {
    fileName: `${toFileStem(project.id)}_sprites.c`,
    source: [
      "#include <stdint.h>",
      '#include "../graphics/sprite_definition.h"',
      "",
      "static const uint32_t CAT_MEOW_GLOBAL_PALETTE[] = {",
      ...palette.map((color) => `    ${rgbaToCColor(color.rgba)},`),
      "};",
      "",
      "const uint16_t CAT_MEOW_GLOBAL_PALETTE_COUNT = sizeof(CAT_MEOW_GLOBAL_PALETTE) / sizeof(CAT_MEOW_GLOBAL_PALETTE[0]);",
      "",
      "typedef enum {",
      ...sprites.map((sprite, index) => `    ${toSpriteIdConstant(sprite.id)} = ${index + 1},`),
      "} SpriteId;",
      "",
      ...spriteBlocks.flatMap((block) => block.primitiveLines),
      "const SpriteDefinition CAT_MEOW_SPRITES[] = {",
      ...spriteBlocks.map((block) => block.definitionLine),
      "};",
      "",
      "const uint16_t CAT_MEOW_SPRITE_COUNT = sizeof(CAT_MEOW_SPRITES) / sizeof(CAT_MEOW_SPRITES[0]);",
      "",
    ].join("\n"),
  };
}

export function exportProjectMusicC(project: Project): GeneratedCFile[] {
  return project.assets
    .filter((asset) => asset.kind === "music")
    .map((asset, index) => {
      const source = exportMusicC(asset.music, { numericId: index + 1 });

      return source === null
        ? null
        : {
            fileName: `${toFileStem(asset.id)}.music.c`,
            source,
          };
    })
    .filter((file): file is GeneratedCFile => file !== null);
}

export function exportProjectSfxC(project: Project): GeneratedCFile[] {
  return project.assets
    .filter((asset) => asset.kind === "sfx")
    .map((asset, index) => {
      const source = exportSoundC(asset.sfx, { numericId: index + 1 });

      return source === null
        ? null
        : {
            fileName: `${toFileStem(asset.id)}.sound.c`,
            source,
          };
    })
    .filter((file): file is GeneratedCFile => file !== null);
}

export function exportProjectC(project: Project): GeneratedCFile[] {
  const spriteFile = exportProjectSpritesC(project);

  return [
    ...(spriteFile === null ? [] : [spriteFile]),
    ...exportProjectMusicC(project),
    ...exportProjectSfxC(project),
  ];
}

function formatSpriteBlock(sprite: SpriteProjectAsset, palette: Project["spritePalette"]): {
  primitiveLines: string[];
  definitionLine: string;
} {
  const symbol = toCIdentifier(sprite.id, "SPRITE", "PRIMITIVES");
  const primitives = flattenNodes(sprite.sprite.nodes).map((primitive) => ({
    primitive,
    paletteIndex: Math.max(0, palette.findIndex((color) => color.rgba === primitiveToRgba(primitive))),
  }));
  const primitiveLines = [
    `static const SpritePrimitive ${symbol}[] = {`,
    ...primitives.map(formatPrimitive),
    "};",
    "",
  ];
  const definitionLine = `    { ${toSpriteIdConstant(sprite.id)}, ${clampInteger(sprite.sprite.width, 1, 65535)}, ${clampInteger(
    sprite.sprite.height,
    1,
    65535,
  )}, ${clampInteger(sprite.sprite.pivotX, -32768, 32767)}, ${clampInteger(sprite.sprite.pivotY, -32768, 32767)}, ${symbol}, ${
    primitives.length
  } },`;

  return {
    primitiveLines,
    definitionLine,
  };
}

function formatPrimitive(entry: NamedPrimitive): string {
  const primitive = entry.primitive;

  return `    { ${getPrimitiveConstant(primitive.kind)}, ${clampInteger(primitive.x, -32768, 32767)}, ${clampInteger(
    primitive.y,
    -32768,
    32767,
  )}, ${clampInteger(primitive.w, 0, 65535)}, ${clampInteger(primitive.h, 0, 65535)}, ${clampInteger(
    primitive.rotation,
    -32768,
    32767,
  )}, ${entry.paletteIndex}, ${alphaToByte(primitive.alpha)} },`;
}

function getPrimitiveConstant(kind: PrimitiveKind): string {
  switch (kind) {
    case "rect":
      return "SPRITE_PRIMITIVE_RECT";
    case "circle":
      return "SPRITE_PRIMITIVE_CIRCLE";
    case "triangle":
      return "SPRITE_PRIMITIVE_TRIANGLE";
  }
}

function toSpriteIdConstant(assetId: string): string {
  return `SPRITE_ID_${toEnumToken(assetId)}`;
}

function toCIdentifier(value: string, prefix: string, suffix: string): string {
  return `${prefix}_${toEnumToken(value)}_${suffix}`;
}

function toEnumToken(value: string): string {
  const token = value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  return token === "" ? "ASSET" : token;
}

function toFileStem(value: string): string {
  const stem = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");

  return stem === "" ? "cat_meow" : stem;
}

function alphaToByte(value: number): number {
  return clampInteger(value, 0, 255);
}

function primitiveToRgba(primitive: Primitive): string {
  const color = /^#[0-9a-fA-F]{6}$/.test(primitive.color) ? primitive.color.toLowerCase() : "#000000";
  const alpha = clampInteger(primitive.alpha, 0, 255).toString(16).padStart(2, "0");

  return `${color}${alpha}`;
}

function rgbaToCColor(rgba: string): string {
  const normalizedRgba = /^#[0-9a-fA-F]{8}$/.test(rgba) ? rgba.toLowerCase() : "#00000000";

  return `0x${normalizedRgba.slice(1)}u`;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
