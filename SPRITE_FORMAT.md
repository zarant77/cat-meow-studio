# Cat Meow Studio ↔ Little One Sprite Format

## Purpose

Cat Meow Studio stores procedural sprite definitions and exports compact C source files for Little One.

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

The source of truth is the Cat Meow Studio project model.

```text
Project
    id
    name
    spritePalette
    assets[]
```

The project model may be stored locally during development.

The final storage backend should be SQLite.

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

- global sprite palette
- global canvas size table
- global primitive size table
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
top-left corner of the sprite canvas
```

Direction:

```text
+X → right
+Y ↓ down
```

Primitive coordinates are stored as unsigned bytes:

```c
uint8_t x;
uint8_t y;
```

Coordinate range:

```text
0..255
```

This means compact primitive commands can address positions inside a 256x256 coordinate space.

Larger exported canvases are allowed, but primitive coordinates still use the compact 0..255 coordinate system unless a future extended command format is introduced.

---

# Sprite Canvas Size

Every sprite stores its canvas size using a single byte.

```c
uint8_t size;
```

The byte contains two packed canvas-size indices.

```text
high nibble = width index
low nibble  = height index
```

This allows:

```text
16 width values
16 height values
256 possible width/height combinations
```

Both portrait and landscape sprites are supported.

Current canvas size table:

```c
static const uint16_t SPRITE_CANVAS_SIZE_TABLE[] = {
     32,
     64,
     96,
    128,
    192,
    256,
    512,
    768,
   1024
};
```

Examples:

```text
32x32
64x64
96x128
128x96
256x512
512x256
768x1024
1024x768
```

Example:

```text
size = 0x23
```

Meaning:

```text
width  = SPRITE_CANVAS_SIZE_TABLE[2] = 96
height = SPRITE_CANVAS_SIZE_TABLE[3] = 128
```

The exporter must fail safely if a sprite canvas width or height is not present in `SPRITE_CANVAS_SIZE_TABLE`.

---

# Pivot Convention

All exported sprites use a fixed pivot convention.

```text
pivot_x = width / 2
pivot_y = height
```

Visual position:

```text
      sprite
   ┌─────────┐
   │         │
   │         │
   │         │
   └────┬────┘
        ●
```

The pivot is always located at the bottom-center of the sprite canvas.

This convention is mandatory for all Little One sprite assets.

The runtime assumes that sprite position corresponds to the point where an entity touches the ground.

Because the pivot can be derived from the sprite canvas size, it is not stored in exported data.

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

# Global Sprite Palette

All sprites use one global project palette.

Colors are stored once.

Sprite commands reference colors by palette index.

```c
static const uint32_t SPRITE_PALETTE[] = {
    0x00000000,
    0x000000ff,
    0xffffffff,
    0xffcc66ff
};
```

The generated symbol may be project-prefixed, but it is one global sprite palette for the entire generated sprite file.

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

The editor may use named colors internally.

The exported runtime data uses numeric palette indices.

The exported command does not include raw RGBA values.

---

# Primitive Size Table

Primitive dimensions are stored as size-table indices instead of raw width, height, or radius values.

The primitive size table is global.

```c
static const uint16_t SPRITE_PRIMITIVE_SIZE_TABLE[] = {
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
    32
};
```

Only the first 16 entries can be used by compact 6-byte sprite commands.

A compact command stores:

```c
uint8_t size;
```

The meaning depends on primitive type.

For primitives that need two dimensions:

```text
high nibble = width size index
low nibble  = height size index
```

For circles:

```text
high nibble = radius size index
low nibble  = 0
```

The compact exporter must not silently approximate dimensions.

If a width, height, or radius is not present in `SPRITE_PRIMITIVE_SIZE_TABLE`, export must fail safely.

---

# Compact Sprite Command

Sprite primitives are exported as compact command records whenever all fields fit the compact format.

```c
#pragma pack(push, 1)

typedef struct {
    uint8_t kind;

    uint8_t x;
    uint8_t y;

    uint8_t size;

    uint8_t rotation;

    uint8_t color;
} SpriteCommand;

#pragma pack(pop)
```

Size:

```text
6 bytes
```

Field meaning:

```text
kind     = primitive type
x        = primitive center x, 0..255
y        = primitive center y, 0..255
size     = packed primitive-size indices
rotation = uint8 full-circle rotation
color    = global palette index
```

The exported command does not store:

```text
raw width
raw height
raw radius
radians
degrees
RGBA color
```

---

# Primitive Kinds

Primitive kinds are exported as stable numeric constants.

```c
typedef enum {
    SPRITE_PRIMITIVE_RECT     = 0,
    SPRITE_PRIMITIVE_CIRCLE   = 1,
    SPRITE_PRIMITIVE_TRIANGLE = 2
} SpritePrimitiveKind;
```

Future primitive kinds may be added.

Existing IDs must remain stable.

---

# Packed Primitive Size

The `size` byte stores indices into `SPRITE_PRIMITIVE_SIZE_TABLE`.

For rectangles and triangles:

```text
high nibble = width size index
low nibble  = height size index
```

Example:

```text
width index  = 12
height index = 9
size         = 0xc9
```

Meaning:

```text
width  = SPRITE_PRIMITIVE_SIZE_TABLE[12]
height = SPRITE_PRIMITIVE_SIZE_TABLE[9]
```

For circles:

```text
high nibble = radius size index
low nibble  = 0
```

Example:

```text
radius index = 15
size         = 0xf0
```

Meaning:

```text
radius = SPRITE_PRIMITIVE_SIZE_TABLE[15]
```

---

# Rotation

Rotation is exported as a `uint8_t`.

```text
0..255 maps to one full circle
```

The editor may store rotation internally in radians.

The exported command stores only the normalized byte value.

Examples:

```text
0   = 0 turns
64  = 1/4 turn
128 = 1/2 turn
192 = 3/4 turn
255 = just under one full turn
```

Runtime conversion:

```text
angle = rotation * 2π / 256
```

The exported data contains no radians or degrees.

Rotation is applied around the primitive center.

---

# Color

Color is exported as a global palette index.

```c
uint8_t color;
```

The value indexes `SPRITE_PALETTE`.

```text
0 = transparent / reserved
1..255 = visible colors
```

The exported command does not include raw RGBA values.

---

# RECT

Rectangle centered at `x,y`.

```text
kind = SPRITE_PRIMITIVE_RECT
```

Size packing:

```text
high nibble = width size index
low nibble  = height size index
```

Example:

```c
{
    SPRITE_PRIMITIVE_RECT,
    32,
    32,
    0xc9,
    0,
    4
}
```

Meaning:

```text
center = (32,32)

width  = SPRITE_PRIMITIVE_SIZE_TABLE[12]
height = SPRITE_PRIMITIVE_SIZE_TABLE[9]

rotation = 0
color    = SPRITE_PALETTE[4]
```

---

# CIRCLE

Circle centered at `x,y`.

```text
kind = SPRITE_PRIMITIVE_CIRCLE
```

Size packing:

```text
high nibble = radius size index
low nibble  = 0
```

Rotation is ignored for circles.

Example:

```c
{
    SPRITE_PRIMITIVE_CIRCLE,
    32,
    32,
    0xf0,
    0,
    2
}
```

Meaning:

```text
center = (32,32)

radius = SPRITE_PRIMITIVE_SIZE_TABLE[15]

color = SPRITE_PALETTE[2]
```

---

# TRIANGLE

Triangle centered at `x,y`.

```text
kind = SPRITE_PRIMITIVE_TRIANGLE
```

Default orientation:

```text
      ▲
     / \
    /   \
   /_____\
```

Top vertex is centered horizontally.

Base is aligned to the bottom side.

Size packing:

```text
high nibble = width size index
low nibble  = height size index
```

Rotation is applied around the triangle center.

Example:

```c
{
    SPRITE_PRIMITIVE_TRIANGLE,
    32,
    32,
    0xc9,
    64,
    3
}
```

Meaning:

```text
center = (32,32)

width  = SPRITE_PRIMITIVE_SIZE_TABLE[12]
height = SPRITE_PRIMITIVE_SIZE_TABLE[9]

rotation = 1/4 turn
color    = SPRITE_PALETTE[3]
```

---

# Layering

Commands are rendered in array order.

Later commands are drawn over earlier commands.

Example:

```c
static const SpriteCommand PLAYER_COMMANDS[] = {
    { SPRITE_PRIMITIVE_TRIANGLE, 22, 14, 0x8a,   0, 1 },
    { SPRITE_PRIMITIVE_TRIANGLE, 42, 14, 0x8a,   0, 1 },
    { SPRITE_PRIMITIVE_CIRCLE,   32, 32, 0xf0,   0, 1 },
    { SPRITE_PRIMITIVE_CIRCLE,   24, 28, 0x40,   0, 3 },
    { SPRITE_PRIMITIVE_CIRCLE,   40, 28, 0x40,   0, 3 }
};
```

---

# Sprite Definition

Each sprite definition references its compact command array.

```c
typedef struct {
    uint16_t id;

    uint8_t size;

    const SpriteCommand *commands;
    uint16_t command_count;
} SpriteDefinition;
```

Field meaning:

```text
id            = sprite identifier
size          = packed canvas width/height indices
commands      = primitive command array
command_count = number of commands
```

The sprite definition does not store:

```text
width
height
pivot_x
pivot_y
```

Runtime derives these values:

```text
width   = SPRITE_CANVAS_SIZE_TABLE[size >> 4]
height  = SPRITE_CANVAS_SIZE_TABLE[size & 0x0f]
pivot_x = width / 2
pivot_y = height
```

---

# Generated Sprite

Generated during Little One startup.

```c
typedef struct {
    uint16_t id;

    uint16_t width;
    uint16_t height;

    uint16_t pivot_x;
    uint16_t pivot_y;

    uint32_t *pixels;
} GeneratedSprite;
```

Transparent pixels:

```c
0x00000000
```

Generated sprites are cached.

Each sprite is generated exactly once.

---

# Runtime Rules

Correct:

```c
blit_sprite(framebuffer, sprite, x, y);
```

Wrong:

```c
draw_rect(...);
draw_circle(...);
draw_triangle(...);
```

inside the game loop.

The game loop must render only cached `GeneratedSprite` pixel buffers.

Runtime generation happens during startup only.

---

# Sprite Registry

The generated sprite C file owns the sprite registry.

Example:

```c
typedef enum {
    SPRITE_ID_PLAYER = 1,
    SPRITE_ID_BOAR,
    SPRITE_ID_ORK,
    SPRITE_ID_RAT,
    SPRITE_ID_ROCK,
    SPRITE_ID_STUMP
} SpriteId;
```

Example registry:

```c
static const SpriteDefinition SPRITE_DEFINITIONS[] = {
    {
        .id = SPRITE_ID_PLAYER,
        .size = 0x11,
        .commands = PLAYER_COMMANDS,
        .command_count = sizeof(PLAYER_COMMANDS) / sizeof(PLAYER_COMMANDS[0]),
    },
    {
        .id = SPRITE_ID_BOAR,
        .size = 0x23,
        .commands = BOAR_COMMANDS,
        .command_count = sizeof(BOAR_COMMANDS) / sizeof(BOAR_COMMANDS[0]),
    }
};
```

Runtime assets use numeric IDs.

Editor names are stored only in Cat Meow Studio.

The runtime should not perform string lookups.

---

# Export Requirements

Cat Meow Studio exports one generated C file for sprites.

The file must contain:

- include statement
- primitive kind constants
- sprite ID constants
- global `SPRITE_PALETTE`
- global `SPRITE_CANVAS_SIZE_TABLE`
- global `SPRITE_PRIMITIVE_SIZE_TABLE`
- compact command arrays
- sprite definitions
- sprite registry

No JSON export is required.

No PNG export is required.

No per-sprite C export is required.

---

# Export Errors

If a sprite or primitive cannot fit the compact format, Cat Meow Studio must fail sprite export safely instead of generating invalid C.

Current unsupported data errors:

- canvas width is not in `SPRITE_CANVAS_SIZE_TABLE`
- canvas height is not in `SPRITE_CANVAS_SIZE_TABLE`
- canvas width index cannot fit 4 bits
- canvas height index cannot fit 4 bits
- out-of-range primitive coordinates: `x` or `y` cannot fit `uint8_t`
- missing palette color: primitive RGBA is not in the global sprite palette
- non-table primitive size: width, height, or radius is not in `SPRITE_PRIMITIVE_SIZE_TABLE`
- primitive size index cannot fit 4 bits
- invalid rotation: rotation is not finite

The exporter must not silently approximate unsupported values.

Future exporters may add an extended command format for unsupported primitives.

---

# Design Goal

Tiny source data.

Tiny APK.

Fast startup.

Fast rendering.

One generated sprite file.

No image assets.

No runtime parsers.

Procedural sprites for tiny .kkrieger-inspired games.
