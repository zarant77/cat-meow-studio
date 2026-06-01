import type { SpriteAssetData } from "../model/assets.js";
import { flattenNodes, type SceneNode } from "../sprites/document/CatPaintDocument.js";
import type { Primitive } from "../sprites/primitives/Primitive.js";
import { isValidSoundId } from "../utils/symbolName.js";

interface ExportedSpriteCommand {
  kind: Primitive["kind"];
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: number;
}

type ExportedSpriteNode =
  | {
      type: "primitive";
      name: string;
      visible: boolean;
      locked: boolean;
      command: ExportedSpriteCommand;
    }
  | {
      type: "group";
      name: string;
      visible: boolean;
      locked: boolean;
      children: ExportedSpriteNode[];
    };

interface ExportedSpriteJson {
  type: "sprite";
  id: string;
  width: number;
  height: number;
  palette: string[];
  commands: ExportedSpriteCommand[];
  nodes: ExportedSpriteNode[];
}

export function exportSpriteJson(sprite: SpriteAssetData): string | null {
  if (!isValidSoundId(sprite.spriteId)) {
    return null;
  }

  const palette = normalizePalette(sprite.palette.map((color) => color.rgba));
  const commands = flattenNodes(sprite.nodes).map((command) => exportCommand(command, palette));
  const nodes = sprite.nodes.map((node) => exportNode(node, palette));
  const exportedSprite: ExportedSpriteJson = {
    type: "sprite",
    id: sprite.spriteId,
    width: sprite.width,
    height: sprite.height,
    palette: palette.map((rgba) => rgba.slice(1)),
    commands,
    nodes,
  };

  return `${JSON.stringify(exportedSprite, null, 2)}\n`;
}

function exportNode(node: SceneNode, palette: string[]): ExportedSpriteNode {
  if (node.type === "primitive") {
    return {
      type: "primitive",
      name: node.name,
      visible: node.visible,
      locked: node.locked,
      command: exportCommand(node.command, palette),
    };
  }

  return {
    type: "group",
    name: node.name,
    visible: node.visible,
    locked: node.locked,
    children: node.children.map((child) => exportNode(child, palette)),
  };
}

function exportCommand(command: Primitive, palette: string[]): ExportedSpriteCommand {
  return {
    kind: command.kind,
    x: command.x,
    y: command.y,
    w: command.w,
    h: command.h,
    rotation: command.rotation,
    color: getPaletteIndex(toRgba(command.color, command.alpha), palette),
  };
}

function normalizePalette(colors: readonly string[]): string[] {
  return colors.filter(isRgba).slice(0, 256);
}

function getPaletteIndex(rgba: string, palette: string[]): number {
  const existingIndex = palette.indexOf(rgba);

  if (existingIndex !== -1) {
    return existingIndex;
  }

  if (palette.length < 256) {
    palette.push(rgba);
    return palette.length - 1;
  }

  return 0;
}

function toRgba(color: string, alpha: number): string {
  const normalizedColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#000000";
  const normalizedAlpha = Math.min(255, Math.max(0, Number.isFinite(alpha) ? Math.round(alpha) : 255));

  return `${normalizedColor}${normalizedAlpha.toString(16).padStart(2, "0")}`;
}

function isRgba(value: string): boolean {
  return /^#[0-9a-fA-F]{8}$/.test(value);
}
