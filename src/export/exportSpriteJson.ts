import type { SpriteAssetData } from "../model/assets.js";
import { flattenNodes } from "../sprites/document/CatPaintDocument.js";
import type { Primitive } from "../sprites/primitives/Primitive.js";
import { isValidSoundId } from "../utils/symbolName.js";

interface ExportedSpritePrimitive {
  kind: Primitive["kind"];
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
}

interface ExportedSpriteJson {
  version: 1;
  id: string;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
  primitives: ExportedSpritePrimitive[];
}

export function exportSpriteJson(sprite: SpriteAssetData): string | null {
  if (!isValidSoundId(sprite.spriteId)) {
    return null;
  }

  const exportedSprite: ExportedSpriteJson = {
    version: 1,
    id: sprite.spriteId,
    width: toInteger(sprite.width),
    height: toInteger(sprite.height),
    pivotX: toInteger(sprite.pivotX),
    pivotY: toInteger(sprite.pivotY),
    primitives: flattenNodes(sprite.nodes).map(exportPrimitive),
  };

  return `${JSON.stringify(exportedSprite, null, 2)}\n`;
}

function exportPrimitive(primitive: Primitive): ExportedSpritePrimitive {
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
