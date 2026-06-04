import { FONT_LINE_PATTERN, type FontGlyph, type VectorFont } from "../model/font.js";

export type ImportFontJsonResult = { ok: true; font: VectorFont } | { ok: false; error: string };

export function importFontJson(text: string): ImportFontJsonResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return fail("The file is not valid JSON.");
  }

  if (!isRecord(parsed)) return fail("The font file must be a JSON object.");
  if (parsed.version !== 1) return fail("Font version must be 1.");
  if (typeof parsed.id !== "string" || !/^[a-z0-9_-]+$/.test(parsed.id)) return fail("Font id must match [a-z0-9_-]+.");
  if (parsed.type !== "vector") return fail('Font type must be "vector".');
  if (parsed.gridSize !== 16) return fail("Font gridSize must be 16.");
  if (!isInteger(parsed.defaultAdvance)) return fail("Font defaultAdvance must be an integer.");
  if (!isInteger(parsed.lineThickness)) return fail("Font lineThickness must be an integer.");
  if (!Array.isArray(parsed.glyphs)) return fail("Font glyphs must be an array.");

  const glyphs: FontGlyph[] = [];
  const chars = new Set<string>();

  for (const value of parsed.glyphs) {
    if (!isRecord(value) || typeof value.char !== "string" || value.char.length !== 1) {
      return fail("Every glyph char must be exactly one character.");
    }
    if (chars.has(value.char)) return fail(`Duplicate glyph character: ${displayChar(value.char)}.`);
    if (value.name !== undefined && typeof value.name !== "string") return fail(`Glyph ${displayChar(value.char)} name must be a string.`);
    if (value.advance !== undefined && !isInteger(value.advance)) return fail(`Glyph ${displayChar(value.char)} advance must be an integer.`);
    if (!Array.isArray(value.lines) || !value.lines.every((line) => typeof line === "string" && FONT_LINE_PATTERN.test(line.toUpperCase()))) {
      return fail(`Glyph ${displayChar(value.char)} contains an invalid line.`);
    }

    chars.add(value.char);
    glyphs.push({
      char: value.char,
      ...(value.name === undefined ? {} : { name: value.name }),
      ...(value.advance === undefined ? {} : { advance: value.advance }),
      lines: value.lines.map((line) => String(line).toUpperCase()),
    });
  }

  return {
    ok: true,
    font: {
      version: 1,
      id: parsed.id,
      type: "vector",
      gridSize: 16,
      defaultAdvance: parsed.defaultAdvance,
      lineThickness: parsed.lineThickness,
      glyphs,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function displayChar(char: string): string {
  return char === " " ? "space" : char;
}

function fail(error: string): ImportFontJsonResult {
  return { ok: false, error };
}
