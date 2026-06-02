# ANIMATION_FORMAT.md

# Cat Meow Studio ↔ Little One Animation Format

## Purpose

Cat Meow Studio exports compact procedural animation files for Little One.

Animations are authored visually in Cat Meow Studio Animator as JSON files.

Little One uses generated C animation definitions compiled directly into the executable.

---

## Pipeline

```text
Cat Meow Studio Animator
    ↓
*.anim.json
    ↓
converter
    ↓
*.anim.c
    ↓
Little One
    ↓
AnimationClip
    ↓
Runtime Evaluation
    ↓
AnimationImpact
    ↓
Sprite Rendering
```

---

## Philosophy

Store motion as numbers.

Evaluate simple transforms.

Render cached sprites.

Animations do not contain image frames.

Animations do not modify sprite geometry.

Animations only describe how a sprite should be transformed over time.

---

## Relationship With Sprites

Sprites and animations are stored separately.

Example:

```text
player.sprite.json
walk.anim.json

player.sprite.c
walk.anim.c
```

The sprite defines shape.

The animation defines motion.

```text
SpriteDefinition
    ↓
GeneratedSprite
    ↓
AnimationImpact
    ↓
blit_sprite_ex(...)
```

---

## Runtime Rule

Correct:

```c
AnimationImpact impact = animation_evaluate(clip, time_ms);

blit_sprite_ex(
    framebuffer,
    sprite,
    x + impact.offset_x,
    y + impact.offset_y,
    impact.scale_x,
    impact.scale_y,
    impact.rotation,
    impact.alpha
);
```

Wrong:

```c
// Do not rebuild sprite pixels every frame.
generate_sprite_pixels(sprite_definition);
```

Sprites are generated once during startup.

Animations are evaluated during gameplay.

---

## Coordinate System

Animations use the same coordinate direction as sprites.

```text
+X → right
+Y ↓ down
```

Offsets are measured in pixels.

```text
offset_x = positive moves right
offset_y = positive moves down
```

---

## Pivot

All animation transforms are applied around the sprite pivot.

The pivot comes from the sprite definition.

Scale and rotation must use the same pivot in:

* Cat Meow Studio preview
* Little One runtime renderer

This is required so animations look the same in the editor and in the game.

---

## Animation File Layout

Cat Meow Studio saves one animation JSON file per reusable transform clip.
Animation files are sprite-agnostic; imported sprite JSON is only a preview target in Animator.

Example:

```text
idle.anim.json
walk.anim.json
jump.anim.json
fall.anim.json
smash.anim.json
land.anim.json
damage.anim.json
death.anim.json
boar_walk.anim.json
ork_walk.anim.json
crow_fly.anim.json
```

Each file contains exactly one animation clip.

---

## JSON File Format

```ts
type AnimationFile = {
  version: 1;
  id: string;
  durationMs: number;
  loop: boolean;
  tracks: AnimationTrack[];
};
```

Example:

```json
{
  "version": 1,
  "id": "idle",
  "durationMs": 1000,
  "loop": true,
  "tracks": []
}
```

Fields:

```text
id         = animation identifier
durationMs = total duration in milliseconds
loop       = whether animation repeats
tracks     = animated property tracks
```

---

## Animation ID Rules

Allowed animation ID characters:

```text
a-z
0-9
_
-
```

Examples:

```text
idle
walk
jump
smash
land
damage
ground_death
flying_death
```

---

## Animation Tracks

Each track animates one property.

```ts
type AnimationTrack = {
  property: AnimationProperty;
  keys: AnimationKey[];
};
```

A clip should have at most one track for each property.

Correct:

```json
{
  "property": "scale_x",
  "keys": []
}
```

Wrong:

```json
[
  { "property": "scale_x", "keys": [] },
  { "property": "scale_x", "keys": [] }
]
```

Duplicate tracks for the same property are not allowed.

---

## Supported Properties

```ts
type AnimationProperty =
  | "offset_x"
  | "offset_y"
  | "scale_x"
  | "scale_y"
  | "rotation"
  | "alpha";
```

Meaning:

```text
offset_x = horizontal pixel offset
offset_y = vertical pixel offset
scale_x  = horizontal scale
scale_y  = vertical scale
rotation = rotation around pivot
alpha    = opacity
```

---

## Value Format

All values are integers.

No floats are stored in exported animation files.

---

## Offset Values

Offsets are stored in pixels.

Examples:

```text
0   = no offset
10  = move 10 pixels right/down
-10 = move 10 pixels left/up
```

---

## Scale Values

Scale uses fixed-point integer format.

```text
1000 = 1.0
900  = 0.9
1100 = 1.1
```

Examples:

```text
scale_x = 1000 // normal width
scale_x = 900  // 10% thinner
scale_x = 1100 // 10% wider

scale_y = 1000 // normal height
scale_y = 900  // 10% shorter
scale_y = 1100 // 10% taller
```

---

## Rotation Values

Rotation uses the same convention as sprite primitive rotation.

```text
rotation = radians * 1000
```

Examples:

```text
0    = 0 degrees
785  = 45 degrees
1570 = 90 degrees
3141 = 180 degrees
```

Positive rotation direction follows the renderer implementation.

Cat Meow Studio preview and Little One runtime must match.

---

## Alpha Values

Alpha is stored as an integer from `0` to `255`.

```text
0   = invisible
255 = fully visible
```

Examples:

```text
alpha = 255 // opaque
alpha = 128 // half transparent
alpha = 0   // invisible
```

---

## Animation Key

A key defines a property value at a specific time.

```ts
type AnimationKey = {
  timeMs: number;
  value: number;
  easing: AnimationEasing;
};
```

Fields:

```text
timeMs = key time in milliseconds
value  = property value at this time
easing = interpolation curve
```

Keys must be sorted by `timeMs` during export.

Cat Meow Studio may sort keys automatically.

---

## Time Rules

```text
timeMs >= 0
timeMs <= durationMs
```

The first key does not have to be at `0`.

The last key does not have to be at `durationMs`.

Evaluation rules define how missing ranges behave.

---

## Easing

Supported easing values:

```ts
type AnimationEasing =
  | "linear"
  | "ease_in"
  | "ease_out"
  | "ease_in_out"
  | "step";
```

Meaning:

```text
linear      = constant speed
ease_in     = starts slow, ends fast
ease_out    = starts fast, ends slow
ease_in_out = starts slow, speeds up, slows down
step        = no interpolation, jumps to value
```

---

## Easing Segment Rule

The easing value of the target key is used for the segment ending at that key.

Example:

```json
[
  { "timeMs": 0, "value": 1000, "easing": "linear" },
  { "timeMs": 500, "value": 900, "easing": "ease_out" }
]
```

For time between `0` and `500`, interpolation uses `ease_out`.

This keeps the format simple and predictable.

---

## Evaluation Rules

Default impact:

```ts
{
  offsetX: 0,
  offsetY: 0,
  scaleX: 1000,
  scaleY: 1000,
  rotation: 0,
  alpha: 255
}
```

If a clip loops:

```text
localTime = timeMs % durationMs
```

If a clip does not loop:

```text
localTime = clamp(timeMs, 0, durationMs)
```

If a property has no track:

```text
use default property value
```

If a track has no keys:

```text
use default property value
```

If local time is before the first key:

```text
use first key value
```

If local time is after the last key:

```text
use last key value
```

If local time is between two keys:

```text
interpolate between previous key and next key
```

---

## AnimationImpact

The evaluated animation result is called `AnimationImpact`.

Runtime shape:

```c
typedef struct {
    int16_t offset_x;
    int16_t offset_y;

    int16_t scale_x;
    int16_t scale_y;

    int16_t rotation;
    uint8_t alpha;
} AnimationImpact;
```

Default value:

```c
static const AnimationImpact ANIMATION_IMPACT_DEFAULT = {
    .offset_x = 0,
    .offset_y = 0,
    .scale_x = 1000,
    .scale_y = 1000,
    .rotation = 0,
    .alpha = 255,
};
```

---

## Example: Breathing Animation

Human-readable behavior:

```text
0-1s: squeeze X by 10%, stretch Y by 10%
1-2s: stretch X by 10%, squeeze Y by 10%
```

JSON:

```json
{
  "version": 1,
  "id": "breath",
  "durationMs": 2000,
  "loop": true,
  "tracks": [
    {
      "property": "scale_x",
      "keys": [
        { "timeMs": 0, "value": 1000, "easing": "linear" },
        { "timeMs": 1000, "value": 900, "easing": "ease_in_out" },
        { "timeMs": 2000, "value": 1100, "easing": "ease_in_out" }
      ]
    },
    {
      "property": "scale_y",
      "keys": [
        { "timeMs": 0, "value": 1000, "easing": "linear" },
        { "timeMs": 1000, "value": 1100, "easing": "ease_in_out" },
        { "timeMs": 2000, "value": 900, "easing": "ease_in_out" }
      ]
    }
  ]
}
```

---

## Example: Walk Squash Animation

```json
{
  "version": 1,
  "id": "walk",
  "durationMs": 600,
  "loop": true,
  "tracks": [
    {
      "property": "scale_x",
      "keys": [
        { "timeMs": 0, "value": 1000, "easing": "linear" },
        { "timeMs": 150, "value": 930, "easing": "ease_out" },
        { "timeMs": 300, "value": 1080, "easing": "ease_in_out" },
        { "timeMs": 450, "value": 930, "easing": "ease_out" },
        { "timeMs": 600, "value": 1000, "easing": "ease_in" }
      ]
    },
    {
      "property": "scale_y",
      "keys": [
        { "timeMs": 0, "value": 1000, "easing": "linear" },
        { "timeMs": 150, "value": 1080, "easing": "ease_out" },
        { "timeMs": 300, "value": 930, "easing": "ease_in_out" },
        { "timeMs": 450, "value": 1080, "easing": "ease_out" },
        { "timeMs": 600, "value": 1000, "easing": "ease_in" }
      ]
    }
  ]
}
```

---

## Example: Smash Animation

```json
{
  "version": 1,
  "id": "smash",
  "durationMs": 250,
  "loop": false,
  "tracks": [
    {
      "property": "scale_x",
      "keys": [
        { "timeMs": 0, "value": 1000, "easing": "linear" },
        { "timeMs": 80, "value": 1150, "easing": "ease_out" },
        { "timeMs": 250, "value": 1000, "easing": "ease_in" }
      ]
    },
    {
      "property": "scale_y",
      "keys": [
        { "timeMs": 0, "value": 1000, "easing": "linear" },
        { "timeMs": 80, "value": 850, "easing": "ease_out" },
        { "timeMs": 250, "value": 1000, "easing": "ease_in" }
      ]
    },
    {
      "property": "rotation",
      "keys": [
        { "timeMs": 0, "value": 0, "easing": "linear" },
        { "timeMs": 80, "value": 350, "easing": "ease_out" },
        { "timeMs": 250, "value": 0, "easing": "ease_in" }
      ]
    }
  ]
}
```

---

## Cat Meow Studio Animator Requirements

Cat Meow Studio Animator must be able to:

* import sprite JSON as a preview target
* render sprite preview
* import animation JSON
* create animation clips one file at a time
* edit clip id
* edit duration
* edit loop flag
* add tracks
* remove tracks
* add keys
* edit keys
* delete keys
* scrub time
* play preview
* pause preview
* stop preview
* export animation JSON

Animator must not edit sprite geometry.

Animator must not save preview sprite data into `*.anim.json`.

---

## Preview Requirements

Preview must use the same evaluation rules as Little One.

Preview must apply transforms around the sprite pivot.

Preview should show:

* current animation
* current time
* sprite preview
* optional pivot marker
* optional ground line

---

## Export Requirements

Cat Meow Studio exports:

* one complete reusable `*.anim.json` clip
* tracks
* keys
* easing values

Cat Meow Studio should sort keys by `timeMs` before export.

Cat Meow Studio should avoid exporting duplicate tracks for the same property.

---

## Import Requirements

Cat Meow Studio imports its own exported animation JSON format.

It does not need to support arbitrary JSON files.

Required validation:

* `version` must be `1`
* `id` must be present and valid
* `durationMs` must be greater than `0`
* `loop` must be a boolean
* `tracks` must be an array
* track properties must be supported
* duplicate tracks for the same property must be rejected
* key values must be integers
* key times must be inside clip duration
* easing values must be supported

Invalid animation data should show a readable error instead of crashing.

---

## Generated C Format

Little One does not load animation JSON at runtime.

Animation JSON is converted into C source files.

Suggested location:

```text
src/animations/definitions/*.anim.c
```

Examples:

```text
src/animations/definitions/player.anim.c
src/animations/definitions/boar.anim.c
src/animations/definitions/ork.anim.c
```

---

## C Types

Suggested runtime types:

```c
typedef enum {
    ANIM_PROP_OFFSET_X = 0,
    ANIM_PROP_OFFSET_Y = 1,
    ANIM_PROP_SCALE_X  = 2,
    ANIM_PROP_SCALE_Y  = 3,
    ANIM_PROP_ROTATION = 4,
    ANIM_PROP_ALPHA    = 5
} AnimProperty;

typedef enum {
    ANIM_EASE_LINEAR      = 0,
    ANIM_EASE_IN          = 1,
    ANIM_EASE_OUT         = 2,
    ANIM_EASE_IN_OUT      = 3,
    ANIM_EASE_STEP        = 4
} AnimEasing;

typedef struct {
    int16_t time_ms;
    int16_t value;
    uint8_t easing;
} AnimKey;

typedef struct {
    uint8_t property;
    const AnimKey *keys;
    uint8_t key_count;
} AnimTrack;

typedef struct {
    const char *id;

    int16_t duration_ms;
    bool loop;

    const AnimTrack *tracks;
    uint8_t track_count;
} AnimationClip;

typedef struct {
    const char *sprite_id;

    const AnimationClip *clips;
    uint8_t clip_count;
} AnimationSet;
```

---

## Example Generated C

```c
#include "../animation_definition.h"

static const AnimKey PLAYER_WALK_SCALE_X_KEYS[] = {
    { 0,   1000, ANIM_EASE_LINEAR },
    { 150, 930,  ANIM_EASE_OUT },
    { 300, 1080, ANIM_EASE_IN_OUT },
    { 450, 930,  ANIM_EASE_OUT },
    { 600, 1000, ANIM_EASE_IN },
};

static const AnimKey PLAYER_WALK_SCALE_Y_KEYS[] = {
    { 0,   1000, ANIM_EASE_LINEAR },
    { 150, 1080, ANIM_EASE_OUT },
    { 300, 930,  ANIM_EASE_IN_OUT },
    { 450, 1080, ANIM_EASE_OUT },
    { 600, 1000, ANIM_EASE_IN },
};

static const AnimTrack PLAYER_WALK_TRACKS[] = {
    {
        .property = ANIM_PROP_SCALE_X,
        .keys = PLAYER_WALK_SCALE_X_KEYS,
        .key_count = sizeof(PLAYER_WALK_SCALE_X_KEYS) / sizeof(PLAYER_WALK_SCALE_X_KEYS[0]),
    },
    {
        .property = ANIM_PROP_SCALE_Y,
        .keys = PLAYER_WALK_SCALE_Y_KEYS,
        .key_count = sizeof(PLAYER_WALK_SCALE_Y_KEYS) / sizeof(PLAYER_WALK_SCALE_Y_KEYS[0]),
    },
};

static const AnimationClip PLAYER_CLIPS[] = {
    {
        .id = "walk",
        .duration_ms = 600,
        .loop = true,
        .tracks = PLAYER_WALK_TRACKS,
        .track_count = sizeof(PLAYER_WALK_TRACKS) / sizeof(PLAYER_WALK_TRACKS[0]),
    },
};

const AnimationSet PLAYER_ANIMATIONS = {
    .sprite_id = "player",
    .clips = PLAYER_CLIPS,
    .clip_count = sizeof(PLAYER_CLIPS) / sizeof(PLAYER_CLIPS[0]),
};
```

---

## Animation Registry

Little One registers animation sets separately from individual animation files.

Suggested registry shape:

```c
extern const AnimationSet PLAYER_ANIMATIONS;
extern const AnimationSet BOAR_ANIMATIONS;
extern const AnimationSet ORK_ANIMATIONS;

const AnimationSet *ANIMATION_SETS[] = {
    &PLAYER_ANIMATIONS,
    &BOAR_ANIMATIONS,
    &ORK_ANIMATIONS,
};
```

Cat Meow Studio does not export the registry.

The registry is owned by Little One.

---

## Runtime Evaluation

Suggested function:

```c
AnimationImpact animation_evaluate(
    const AnimationClip *clip,
    int32_t time_ms
);
```

Suggested property application:

```c
switch (track->property) {
    case ANIM_PROP_OFFSET_X:
        impact.offset_x = value;
        break;

    case ANIM_PROP_OFFSET_Y:
        impact.offset_y = value;
        break;

    case ANIM_PROP_SCALE_X:
        impact.scale_x = value;
        break;

    case ANIM_PROP_SCALE_Y:
        impact.scale_y = value;
        break;

    case ANIM_PROP_ROTATION:
        impact.rotation = value;
        break;

    case ANIM_PROP_ALPHA:
        impact.alpha = (uint8_t)value;
        break;
}
```

---

## Interpolation

Linear interpolation:

```text
value = from + (to - from) * t
```

Where:

```text
t = 0..1000
```

Easing transforms `t`.

Suggested fixed-point easing functions:

```text
linear:
    t

ease_in:
    t * t / 1000

ease_out:
    1000 - (1000 - t) * (1000 - t) / 1000

ease_in_out:
    first half uses ease_in
    second half uses ease_out

step:
    0 until target key time, then 1000
```

No floats are required.

---

## Design Goal

Tiny animation data.

No image frames.

No runtime JSON parser.

No runtime sprite rebuilding.

Editor-friendly JSON.

Game-friendly C.

Fast evaluation.

Small APK.

Procedural motion for procedural sprites.
