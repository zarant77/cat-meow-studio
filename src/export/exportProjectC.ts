import { exportMusicC } from "./exportMusicC.js";
import { exportSoundC } from "./exportSoundC.js";
import type { Project, SpriteProjectAsset } from "../model/assets.js";
import { flattenNodes } from "../sprites/document/CatPaintDocument.js";
import type { Primitive, PrimitiveKind } from "../sprites/primitives/Primitive.js";

export interface GeneratedCFile {
  fileName: string;
  source: string;
}

interface CompactPrimitive {
  kind: PrimitiveKind;
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: number;
}

export const spriteSizeTable = [
  0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 128, 160, 192, 224, 255,
] as const;

const compactSizeTableLimit = 16;
const fullCircleRadians = Math.PI * 2;

export function getSpriteExportErrors(project: Project): string[] {
  const errors: string[] = [];
  const sprites = project.assets.filter((asset): asset is SpriteProjectAsset => asset.kind === "sprite");
  const palette = project.spritePalette.slice(0, 256);

  for (const sprite of sprites) {
    for (const primitive of flattenNodes(sprite.sprite.nodes)) {
      errors.push(...getPrimitiveExportErrors(sprite, primitive, palette));
    }
  }

  return errors;
}

export function exportProjectSpritesC(project: Project): GeneratedCFile | null {
  const sprites = project.assets.filter((asset): asset is SpriteProjectAsset => asset.kind === "sprite");

  if (sprites.length === 0) {
    return null;
  }

  if (getSpriteExportErrors(project).length > 0) {
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
      "static const uint16_t SPRITE_SIZE_TABLE[] = {",
      ...spriteSizeTable.map((size) => `    ${size},`),
      "};",
      "",
      "const uint16_t SPRITE_SIZE_TABLE_COUNT = sizeof(SPRITE_SIZE_TABLE) / sizeof(SPRITE_SIZE_TABLE[0]);",
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
  const primitives = flattenNodes(sprite.sprite.nodes)
    .map((primitive) => toCompactPrimitive(primitive, palette))
    .filter((primitive): primitive is CompactPrimitive => primitive !== null);
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

function formatPrimitive(primitive: CompactPrimitive): string {
  return `    { ${getPrimitiveConstant(primitive.kind)}, ${primitive.x}, ${primitive.y}, 0x${primitive.size
    .toString(16)
    .padStart(2, "0")}, ${primitive.rotation}, ${primitive.color} },`;
}

function toCompactPrimitive(primitive: Primitive, palette: Project["spritePalette"]): CompactPrimitive | null {
  const x = toUint8(primitive.x);
  const y = toUint8(primitive.y);
  const color = palette.findIndex((paletteColor) => paletteColor.rgba === primitiveToRgba(primitive));

  if (x === null || y === null || color < 0 || color > 255) {
    return null;
  }

  const size = getPackedPrimitiveSize(primitive);

  if (size === null) {
    return null;
  }

  return {
    kind: primitive.kind,
    x,
    y,
    size,
    rotation: rotationToByte(primitive.rotation),
    color,
  };
}

function getPrimitiveExportErrors(sprite: SpriteProjectAsset, primitive: Primitive, palette: Project["spritePalette"]): string[] {
  const errors: string[] = [];
  const label = `${sprite.name} ${primitive.kind}`;

  if (toUint8(primitive.x) === null || toUint8(primitive.y) === null) {
    errors.push(`${label} position must fit uint8 x/y coordinates.`);
  }

  if (palette.findIndex((color) => color.rgba === primitiveToRgba(primitive)) === -1) {
    errors.push(`${label} color is not in the global sprite palette.`);
  }

  if (getPackedPrimitiveSize(primitive) === null) {
    errors.push(`${label} size is not in the compact sprite size table.`);
  }

  if (!Number.isFinite(primitive.rotation)) {
    errors.push(`${label} rotation must be finite.`);
  }

  return errors;
}

function getPackedPrimitiveSize(primitive: Primitive): number | null {
  if (primitive.kind === "circle") {
    const radiusIndex = getCompactSizeIndex(primitive.w);

    return radiusIndex === null ? null : radiusIndex << 4;
  }

  const widthIndex = getCompactSizeIndex(primitive.w);
  const heightIndex = getCompactSizeIndex(primitive.h);

  if (widthIndex === null || heightIndex === null) {
    return null;
  }

  return (widthIndex << 4) | heightIndex;
}

function getCompactSizeIndex(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const roundedValue = Math.round(value);
  const index = spriteSizeTable.slice(0, compactSizeTableLimit).findIndex((size) => size === roundedValue);

  return index === -1 ? null : index;
}

function toUint8(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const roundedValue = Math.round(value);

  if (roundedValue < 0 || roundedValue > 255) {
    return null;
  }

  return roundedValue;
}

function rotationToByte(rotation: number): number {
  if (!Number.isFinite(rotation)) {
    return 0;
  }

  const normalizedRotation = ((rotation % fullCircleRadians) + fullCircleRadians) % fullCircleRadians;

  return Math.round((normalizedRotation / fullCircleRadians) * 256) % 256;
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
