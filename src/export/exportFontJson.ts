import { importFontJson } from "../import/importFontJson.js";
import { cloneVectorFont, type VectorFont } from "../model/font.js";

export function exportFontJson(font: VectorFont): string | null {
  const canonical = cloneVectorFont(font);
  canonical.glyphs = canonical.glyphs.map((glyph) => ({
    ...glyph,
    lines: glyph.lines.map((line) => line.toUpperCase()),
  }));
  const source = `${JSON.stringify(canonical, null, 2)}\n`;

  return importFontJson(source).ok ? source : null;
}
