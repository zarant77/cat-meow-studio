import { createMusicDefinitionCBlock, exportMusicC, type MusicDefinitionCBlock } from "./exportMusicC.js";
import { createSoundDefinitionCBlock, exportSoundC, type SoundDefinitionCBlock } from "./exportSoundC.js";
import type { MusicProjectAsset, Project, SfxProjectAsset, SpriteProjectAsset } from "../model/assets.js";
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
  0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32,
] as const;

export const spriteCanvasSizeTable = [32, 64, 96, 128, 192, 256, 512, 768, 1024] as const;

const fullCircleRadians = Math.PI * 2;

export function getSpriteExportErrors(project: Project): string[] {
  const errors: string[] = [];
  const sprites = project.assets.filter((asset): asset is SpriteProjectAsset => asset.kind === "sprite");
  const palette = project.spritePalette.slice(0, 256);

  for (const sprite of sprites) {
    const canvasSize = getPackedCanvasSize(sprite);

    if (canvasSize === null) {
      errors.push(`${sprite.name} canvas size is not in the sprite canvas size table.`);
    }

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

  return {
    fileName: `${toFileStem(project.id)}_sprites.c`,
    source: [
      "#include <stdint.h>",
      '#include "../graphics/sprite_definition.h"',
      "",
      ...createSpriteSectionLines(sprites, palette),
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
  return exportLittleOneAssetsC(project);
}

export function exportLittleOneAssetsC(project: Project): GeneratedCFile[] {
  const sprites = project.assets.filter((asset): asset is SpriteProjectAsset => asset.kind === "sprite");
  const musicAssets = project.assets.filter((asset): asset is MusicProjectAsset => asset.kind === "music");
  const sfxAssets = project.assets.filter((asset): asset is SfxProjectAsset => asset.kind === "sfx");
  const palette = project.spritePalette.slice(0, 256);

  return [
    {
      fileName: "little_one_assets.c",
      source: [
        "#include <stdint.h>",
        '#include "../graphics/sprite_definition.h"',
        '#include "../audio/sound_definition.h"',
        '#include "../audio/music_definition.h"',
        "",
        "/* Sprites */",
        ...createSpriteSectionLines(sprites, palette),
        "/* Sound effects */",
        ...createSoundSectionLines(sfxAssets),
        "/* Music */",
        ...createMusicSectionLines(musicAssets),
      ].join("\n"),
    },
  ];
}

function createSpriteSectionLines(sprites: readonly SpriteProjectAsset[], palette: Project["spritePalette"]): string[] {
  const spriteBlocks = sprites.map((sprite) => formatSpriteBlock(sprite, palette));

  return [
    "static const uint32_t CAT_MEOW_GLOBAL_PALETTE[] = {",
    ...palette.map((color) => `    ${rgbaToCColor(color.rgba)},`),
    "};",
    "",
    "const uint16_t CAT_MEOW_GLOBAL_PALETTE_COUNT = sizeof(CAT_MEOW_GLOBAL_PALETTE) / sizeof(CAT_MEOW_GLOBAL_PALETTE[0]);",
    "",
    "static const uint16_t SPRITE_CANVAS_SIZE_TABLE[] = {",
    ...spriteCanvasSizeTable.map((size) => `    ${size},`),
    "};",
    "",
    "const uint16_t SPRITE_CANVAS_SIZE_TABLE_COUNT = sizeof(SPRITE_CANVAS_SIZE_TABLE) / sizeof(SPRITE_CANVAS_SIZE_TABLE[0]);",
    "",
    "static const uint16_t SPRITE_PRIMITIVE_SIZE_TABLE[] = {",
    ...spriteSizeTable.map((size) => `    ${size},`),
    "};",
    "",
    "const uint16_t SPRITE_PRIMITIVE_SIZE_TABLE_COUNT = sizeof(SPRITE_PRIMITIVE_SIZE_TABLE) / sizeof(SPRITE_PRIMITIVE_SIZE_TABLE[0]);",
    "",
    "typedef enum {",
    "    SPRITE_PRIMITIVE_RECT = 0,",
    "    SPRITE_PRIMITIVE_CIRCLE = 1,",
    "    SPRITE_PRIMITIVE_TRIANGLE = 2,",
    "} SpritePrimitiveKind;",
    "",
    ...(sprites.length === 0
      ? []
      : [
          "typedef enum {",
          ...sprites.map((sprite, index) => `    ${toSpriteIdConstant(sprite.id)} = ${index + 1},`),
          "} SpriteId;",
          "",
        ]),
    ...spriteBlocks.flatMap((block) => block.primitiveLines),
    ...(spriteBlocks.length === 0
      ? ["const SpriteDefinition CAT_MEOW_SPRITES[1] = { { 0, 0, 0, 0 } };", "const uint16_t CAT_MEOW_SPRITE_COUNT = 0;", ""]
      : [
          "const SpriteDefinition CAT_MEOW_SPRITES[] = {",
          ...spriteBlocks.map((block) => block.definitionLine),
          "};",
          "",
          "const uint16_t CAT_MEOW_SPRITE_COUNT = sizeof(CAT_MEOW_SPRITES) / sizeof(CAT_MEOW_SPRITES[0]);",
          "",
        ]),
  ];
}

function createSoundSectionLines(assets: readonly SfxProjectAsset[]): string[] {
  const blocks = assets
    .map((asset, index) =>
      createSoundDefinitionCBlock(asset.sfx, {
        numericId: index + 1,
        commandSymbol: toCIdentifier(asset.id, "SOUND", `COMMANDS_${index + 1}`),
      }),
    )
    .filter((block): block is SoundDefinitionCBlock => block !== null);

  return [
    ...(blocks.length === 0
      ? []
      : [
          "typedef enum {",
          ...blocks.map((block, index) => `    ${block.idConstant} = ${index + 1},`),
          "} SoundId;",
          "",
        ]),
    ...blocks.flatMap((block) => block.sourceLines),
    ...(blocks.length === 0
      ? ["const SoundDefinition *CAT_MEOW_SOUNDS[1] = { 0 };", "const uint16_t CAT_MEOW_SOUND_COUNT = 0;", ""]
      : [
          "const SoundDefinition *CAT_MEOW_SOUNDS[] = {",
          ...blocks.map((block) => `    &${block.definitionSymbol},`),
          "};",
          "",
          "const uint16_t CAT_MEOW_SOUND_COUNT = sizeof(CAT_MEOW_SOUNDS) / sizeof(CAT_MEOW_SOUNDS[0]);",
          "",
        ]),
  ];
}

function createMusicSectionLines(assets: readonly MusicProjectAsset[]): string[] {
  const blocks = assets
    .map((asset, index) =>
      createMusicDefinitionCBlock(asset.music, {
        numericId: index + 1,
        instrumentSymbol: toCIdentifier(asset.id, "MUSIC", `INSTRUMENTS_${index + 1}`),
        noteSymbol: toCIdentifier(asset.id, "MUSIC", `NOTES_${index + 1}`),
      }),
    )
    .filter((block): block is MusicDefinitionCBlock => block !== null);

  return [
    ...(blocks.length === 0
      ? []
      : [
          "typedef enum {",
          ...blocks.map((block, index) => `    ${block.idConstant} = ${index + 1},`),
          "} MusicId;",
          "",
        ]),
    ...blocks.flatMap((block) => block.sourceLines),
    ...(blocks.length === 0
      ? ["const MusicDefinition *CAT_MEOW_MUSIC[1] = { 0 };", "const uint16_t CAT_MEOW_MUSIC_COUNT = 0;", ""]
      : [
          "const MusicDefinition *CAT_MEOW_MUSIC[] = {",
          ...blocks.map((block) => `    &${block.definitionSymbol},`),
          "};",
          "",
          "const uint16_t CAT_MEOW_MUSIC_COUNT = sizeof(CAT_MEOW_MUSIC) / sizeof(CAT_MEOW_MUSIC[0]);",
          "",
        ]),
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
  const canvasSize = getPackedCanvasSize(sprite) ?? 0;
  const definitionLine = `    { ${toSpriteIdConstant(sprite.id)}, 0x${canvasSize.toString(16).padStart(2, "0")}, ${symbol}, ${
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
  const index = spriteSizeTable.findIndex((size) => size === roundedValue);

  return index === -1 ? null : index;
}

function getPackedCanvasSize(sprite: SpriteProjectAsset): number | null {
  const widthIndex = getCanvasSizeIndex(sprite.sprite.width);
  const heightIndex = getCanvasSizeIndex(sprite.sprite.height);

  if (widthIndex === null || heightIndex === null) {
    return null;
  }

  return (widthIndex << 4) | heightIndex;
}

function getCanvasSizeIndex(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const roundedValue = Math.round(value);
  const index = spriteCanvasSizeTable.findIndex((size) => size === roundedValue);

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
  const normalizedRgba = /^#[0-9a-fA-F]{8}$/.test(rgba) ? rgba.toLowerCase() : "#000000ff";

  return `0x${normalizedRgba.slice(1)}u`;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
