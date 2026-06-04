export interface FontGlyph {
  char: string;
  name?: string;
  advance?: number;
  lines: string[];
}

export interface VectorFont {
  version: 1;
  id: string;
  type: "vector";
  gridSize: 16;
  defaultAdvance: number;
  lineThickness: number;
  glyphs: FontGlyph[];
}

export interface FontPoint {
  x: number;
  y: number;
}

export const FONT_LINE_PATTERN = /^[0-9A-F]{4}$/;

export function createVectorFont(): VectorFont {
  return {
    version: 1,
    id: "vector_16",
    type: "vector",
    gridSize: 16,
    defaultAdvance: 12,
    lineThickness: 1,
    glyphs: [],
  };
}

export function cloneVectorFont(font: VectorFont): VectorFont {
  return {
    ...font,
    glyphs: font.glyphs.map((glyph) => ({ ...glyph, lines: [...glyph.lines] })),
  };
}

export function encodeFontLine(start: FontPoint, end: FontPoint): string {
  return `${toHex(start.x)}${toHex(start.y)}${toHex(end.x)}${toHex(end.y)}`;
}

export function decodeFontLine(line: string): [FontPoint, FontPoint] | null {
  const canonical = line.toUpperCase();

  if (!FONT_LINE_PATTERN.test(canonical)) {
    return null;
  }

  return [
    { x: parseInt(canonical[0] ?? "0", 16), y: parseInt(canonical[1] ?? "0", 16) },
    { x: parseInt(canonical[2] ?? "0", 16), y: parseInt(canonical[3] ?? "0", 16) },
  ];
}

export function clampFontCoordinate(value: number): number {
  return Math.max(0, Math.min(15, Math.round(value)));
}

function toHex(value: number): string {
  return clampFontCoordinate(value).toString(16).toUpperCase();
}
