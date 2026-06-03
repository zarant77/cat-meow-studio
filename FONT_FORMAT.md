# Cat Meow Studio ↔ Little One Font Format

## Purpose

Cat Meow Studio exports compact vector font source data for Little One.

Little One uses these font definitions to generate or render tiny in-game text for:

* HUD
* menus
* score labels
* game over screen
* debug text
* short localized phrases

The font format is designed to stay extremely small and simple.

---

## Pipeline

```text
Cat Meow Studio Font Editor
    ↓
*.font.json
    ↓
Python font packer
    ↓
Packed C font data
    ↓
Little One runtime text rendering
```

---

## Philosophy

Store strokes.

Pack lines.

Render text without external font files.

No TTF.

No PNG.

No runtime JSON parsing.

---

## Asset Location

Editable font source files live in:

```text
src/assets/fonts/
```

Example:

```text
src/assets/fonts/vector_16.font.json
```

The Python packer reads font JSON files from:

```text
src/assets/fonts/**/*.font.json
```

The game runtime does not read JSON files.

---

## Font Type

The initial font format is a vector grid font.

Each glyph is made from straight lines placed on a fixed-size grid.

Current recommended grid:

```text
16x16
```

Coordinate range:

```text
0..F
```

This allows every point coordinate to be encoded as a single hexadecimal digit.

---

## Coordinate System

Each glyph has its own local coordinate system.

Origin:

```text
(0,0)
```

Location:

```text
top-left corner of the glyph grid
```

Direction:

```text
+X → right
+Y ↓ down
```

For a 16x16 grid:

```text
X = 0..F
Y = 0..F
```

Examples:

```text
00 = top-left
F0 = top-right
0F = bottom-left
FF = bottom-right
```

---

## Line Encoding

Each line is stored as a 4-character hex string:

```text
x1 y1 x2 y2
```

Example:

```text
00FF
```

Meaning:

```text
start = (0,0)
end   = (F,F)
```

Example:

```text
0FF0
```

Meaning:

```text
start = (0,F)
end   = (F,0)
```

Together:

```json
"lines": [
  "00FF",
  "0FF0"
]
```

This draws an X-shaped cross.

---

## JSON Format

Example:

```json
{
  "version": 1,
  "id": "vector_16",
  "type": "vector",
  "gridSize": 16,
  "defaultAdvance": 12,
  "lineThickness": 1,
  "glyphs": [
    {
      "char": "X",
      "advance": 12,
      "lines": [
        "00FF",
        "0FF0"
      ]
    }
  ]
}
```

---

## Root Fields

### version

Format version.

Current value:

```json
"version": 1
```

---

### id

Font identifier.

Allowed characters:

```text
a-z
0-9
_
-
```

Examples:

```text
vector_16
tiny_vector
menu_font
hud_font
```

---

### type

Font type.

Current supported value:

```json
"type": "vector"
```

Future possible values:

```text
bitmap
sdf
```

Only `vector` is required for the current Little One pipeline.

---

### gridSize

Size of the glyph grid.

Current recommended value:

```json
"gridSize": 16
```

For `gridSize = 16`, coordinates use hexadecimal digits:

```text
0..F
```

The current packed line format assumes a 16x16 grid.

---

### defaultAdvance

Default horizontal advance after drawing a glyph.

Example:

```json
"defaultAdvance": 12
```

This means the next glyph starts 12 grid units after the current glyph origin, before scaling.

Individual glyphs may override this value.

---

### lineThickness

Default line thickness.

Example:

```json
"lineThickness": 1
```

Runtime may interpret this value depending on renderer capabilities.

Initial implementation may support only thickness `1`.

---

### glyphs

Array of glyph definitions.

Example:

```json
"glyphs": [
  {
    "char": "A",
    "advance": 12,
    "lines": [
      "0F70",
      "70FF",
      "3A CA"
    ]
  }
]
```

Whitespace inside line strings is not recommended.

The canonical format is exactly 4 hex characters.

Correct:

```json
"3ACA"
```

Wrong:

```json
"3A CA"
```

---

## Glyph Fields

### char

The character represented by this glyph.

Examples:

```json
"char": "A"
```

```json
"char": "0"
```

```json
"char": "!"
```

Space is allowed:

```json
"char": " "
```

Each glyph must contain exactly one character.

---

### name

Optional human-readable glyph name.

Useful for special glyphs.

Example:

```json
{
  "char": " ",
  "name": "space",
  "advance": 6,
  "lines": []
}
```

---

### advance

Optional per-glyph horizontal advance.

If omitted, `defaultAdvance` is used.

Example:

```json
{
  "char": "I",
  "advance": 6,
  "lines": [
    "20D0",
    "7707",
    "2FDF"
  ]
}
```

---

### lines

Array of line strings.

Each line must be exactly 4 hexadecimal characters:

```text
x1y1x2y2
```

Allowed characters:

```text
0-9
A-F
a-f
```

The packer should normalize lowercase hex to uppercase when generating C.

Example:

```json
"lines": [
  "00FF",
  "0FF0"
]
```

---

## Example Glyphs

### X

```json
{
  "char": "X",
  "advance": 12,
  "lines": [
    "00FF",
    "0FF0"
  ]
}
```

---

### H

```json
{
  "char": "H",
  "advance": 12,
  "lines": [
    "000F",
    "F0FF",
    "07F7"
  ]
}
```

Meaning:

```text
00 → 0F left vertical line
F0 → FF right vertical line
07 → F7 middle horizontal line
```

---

### A

```json
{
  "char": "A",
  "advance": 12,
  "lines": [
    "0F70",
    "70FF",
    "3A CA"
  ]
}
```

Canonical version without spacing:

```json
{
  "char": "A",
  "advance": 12,
  "lines": [
    "0F70",
    "70FF",
    "3ACA"
  ]
}
```

---

### Space

```json
{
  "char": " ",
  "name": "space",
  "advance": 6,
  "lines": []
}
```

---

## Packed C Format

The Python packer converts every line string into a `uint16_t`.

Example JSON:

```json
"lines": [
  "00FF",
  "0FF0"
]
```

Generated C:

```c
static const uint16_t GLYPH_X_LINES[] = {
    0x00FF,
    0x0FF0,
};
```

Each packed line uses 4 nibbles:

```text
bits 12..15 = x1
bits  8..11 = y1
bits  4..7  = x2
bits  0..3  = y2
```

So:

```text
0x00FF
```

means:

```text
x1 = 0
y1 = 0
x2 = F
y2 = F
```

---

## Suggested Runtime Types

```c
typedef uint16_t PackedFontLine;

typedef struct {
    char code;
    uint8_t advance;
    const PackedFontLine *lines;
    uint8_t line_count;
} PackedFontGlyph;

typedef struct {
    const char *id;

    uint8_t grid_size;
    uint8_t default_advance;
    uint8_t line_thickness;

    const PackedFontGlyph *glyphs;
    uint16_t glyph_count;
} PackedFont;
```

---

## Text Rendering Rules

Runtime text rendering should:

1. Find glyph by character.
2. Draw all glyph lines.
3. Advance cursor by glyph `advance`, or font `defaultAdvance`.
4. Apply scale during rendering.
5. Support newline if needed.

Example behavior:

```text
draw_text(font, "SCORE 123", x, y, scale)
```

Renderer should convert grid coordinates into pixels:

```text
pixel_x = text_x + glyph_x * scale
pixel_y = text_y + glyph_y * scale
```

---

## Missing Glyphs

If a glyph is missing, runtime may:

* skip the character
* draw a fallback rectangle
* draw a `?` glyph if available

Recommended behavior:

```text
missing glyph → use "?" if present
missing "?"   → skip character
```

---

## Initial Supported Glyph Set

Recommended first glyphs:

```text
A-Z
0-9
space
!
?
:
-
.
,
'
```

This is enough for early Little One UI text:

```text
LITTLE ONE
TAP TO START
YOU FELL
SCORE 123
BEST 999
PAUSED
GAME OVER
```

---

## Validation Rules

The packer should validate:

* root is an object
* `version` is `1`
* `id` matches `[a-z0-9_-]+`
* `type` is `"vector"`
* `gridSize` is `16`
* `defaultAdvance` is an integer
* `lineThickness` is an integer
* `glyphs` is an array
* each glyph has exactly one-character `char`
* each `advance`, if present, is an integer
* each line is exactly 4 hex characters
* no duplicate glyph characters
* no line coordinates outside `0..F`

---

## Editor Requirements

Cat Meow Studio Font Editor should support:

* creating a new font
* opening an existing `*.font.json`
* editing font metadata
* selecting a glyph
* adding a glyph
* deleting a glyph
* drawing lines on a 16x16 grid
* moving line endpoints
* deleting lines
* editing glyph advance
* previewing custom text
* exporting valid `*.font.json`

The editor should not reuse sprite primitive data structures directly.

Font glyphs are line-based.

Sprites are primitive-based.

These are separate asset types.

---

## Runtime Rules

Correct:

```text
*.font.json
    ↓
pack_fonts.py
    ↓
packed C data
    ↓
runtime text renderer
```

Wrong:

```text
runtime reads *.font.json directly
```

Little One must not parse JSON at runtime.

---

## Naming Rules

Font file names should use:

```text
*.font.json
```

Examples:

```text
vector_16.font.json
hud.font.json
menu.font.json
```

Font IDs should use:

```text
a-z
0-9
_
-
```

Examples:

```text
vector_16
hud_font
menu_font
```

---

## Design Goal

Tiny font data.

Tiny APK.

No external font files.

No image assets.

No runtime parsers.

Readable authoring JSON.

Compact generated C.

A handmade vector font for a handmade tiny game.
