# Cat Meow Studio ↔ Little One Sprite Format

## Purpose

Cat Meow Studio stores procedural sprite definitions in SQLite and exports compact C source files for Little One.

Little One generates pixel buffers from these definitions during startup and renders cached sprites during gameplay.

The runtime never parses editor data.

The runtime never rebuilds sprites during gameplay.

---

# Pipeline

```text
Cat Meow Studio
    ↓
SQLite Project Database
    ↓
Export
    ↓
sprites_generated.c
    ↓
Little One
    ↓
GeneratedSprite
    ↓
Runtime Rendering
```

---

# Philosophy

Store instructions.

Generate pixels once.

Render cached pixels.

No PNG.

No SVG.

No JSON.

No runtime parsers.

No runtime sprite generation during gameplay.

---

# Source Of Truth

The source of truth is the Cat Meow Studio project database.

```text
SQLite
```

Little One never reads project data directly.

Little One only consumes exported C definitions.

---

# Export Model

Cat Meow Studio exports all sprite data into one generated C source file.

Suggested file:

```text
src/generated/sprites_generated.c
```

Optional header:

```text
src/generated/sprites_generated.h
```

The generated file contains:

- global palette
- size table
- sprite command arrays
- sprite definitions
- sprite registry

Cat Meow Studio does not export one file per sprite.

---

# Coordinate System

Each sprite has its own local coordinate system.

Origin:

```text
(0,0)
```

Location:

```text
top-left corner of the sprite
```

Direction:

```text
+X → right
+Y ↓ down
```

Coordinates are stored as unsigned bytes.

```c
uint8_t x;
uint8_t y;
```

This means the maximum sprite coordinate range is:

```text
0..255
```

Current target sprite size:

```text
up to 255x255
```

Larger sprites require either:

- multiple smaller sprites
- background layers
- future 16-bit extended command format

---

# Primitive Positioning

For all primitives:

```text
x,y = geometric center of the primitive
```

Rotation is always applied around the primitive center.

This rule applies to all primitive types.

No primitive-specific coordinate systems.

---

# Pivot

Every sprite contains a pivot point.

Current convention:

```text
pivot = geometric center of the sprite
```

Example:

```c
.width = 64,
.height = 64,

.pivot_x = 32,
.pivot_y = 32,
```

Pivot is stored as:

```c
uint8_t pivot_x;
uint8_t pivot_y;
```

---

# Global Palette

All sprites use one global project palette.

Colors are stored once.

Sprite commands reference colors by index.

```c
static const uint32_t SPRITE_PALETTE[] = {
    0x00000000,
    0x000000ff,
    0xffffffff,
    0xffcc66ff
};
```

Color format:

```text
0xRRGGBBAA
```

Examples:

```c
0x00000000 // transparent
0x000000ff // black
0xffffffff // white
0xff0000ff // red
0x00ff00ff // green
0x0000ffff // blue
```

Palette index is stored as:

```c
uint8_t color;
```

Maximum colors:

```text
256 colors
```

Recommended rule:

```text
color 0 = transparent / reserved
colors 1..255 = visible colors
```

The editor may use named colors internally, but exported runtime data uses numeric palette indices.

---

# Size Table

Primitive dimensions are stored as size table indices instead of raw width/height values.

The size table is global.

```c
static const uint16_t SPRITE_SIZE_TABLE[] = {
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    8,
    10,
    12,
    14,
    16,
    20,
    24,
    28,
    32,
    40,
    48,
    56,
    64,
    80,
    96,
    128,
    160,
    192,
    224,
    255
};
```

A command stores:

```c
uint8_t size;
```

Meaning depends on primitive type.

For primitives that need two dimensions, the size byte is split into two 4-bit indices:

```text
high nibble = width size index
low nibble  = height size index
```

This gives:

```text
16 width choices
16 height choices
```

For circles:

```text
high nibble = radius size index
low nibble  = unused
```

The first 16 entries of `SPRITE_SIZE_TABLE` are the compact-size set used by packed commands.

Recommended first 16 entries:

```text
0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 32
```
