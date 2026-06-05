# Cat Meow Studio ↔ Little One Audio Format

## Purpose

Cat Meow Studio stores procedural audio definitions and exports compact C source files for Little One.

Little One generates PCM buffers from these definitions during startup and plays cached audio during gameplay.

The runtime never parses editor data.

The runtime never generates audio during gameplay.

---

# Pipeline

```text
Cat Meow Studio
    ↓
SQLite Project Database
    ↓
Export
    ↓
*.sound.c
*.music.c
    ↓
Little One
    ↓
GeneratedSound
    ↓
Runtime Playback
```

Optional editor interchange:

```text
*.music.json
*.sound.json
```

JSON files are editor/import/export files only.

Little One runtime must not read JSON files.

---

# Philosophy

Store instructions.

Generate samples once.

Play cached PCM.

No WAV.

No OGG.

No MP3.

No runtime parsers.

No runtime audio generation.

---

# Source Of Truth

The source of truth is the Cat Meow Studio project database.

```text
SQLite
```

Little One never reads project data directly.

Little One only consumes exported C definitions.

JSON is allowed as an editor interchange format, but it is not a runtime format.

---

# Runtime Audio Format

Generated audio uses:

```text
22050 Hz
16-bit signed PCM
mono
```

Future upgrades may support:

```text
44100 Hz
stereo
```

but exported asset formats should remain compatible.

---

# GeneratedSound

```c
typedef struct {
    uint16_t id;

    uint32_t sample_rate;
    uint32_t sample_count;

    int16_t *samples;
} GeneratedSound;
```

Generated sounds are cached.

Each sound is generated exactly once.

---

# Wave Types

```c
typedef enum {
    SOUND_WAVE_SQUARE   = 0,
    SOUND_WAVE_SINE     = 1,
    SOUND_WAVE_TRIANGLE = 2,
    SOUND_WAVE_NOISE    = 3
} SoundWaveKind;
```

Future waveforms may be added.

Existing IDs must remain stable.

---

# Note Table

Music and sound effects use note indices rather than raw frequencies.

```text
60 = C4
61 = C#4
62 = D4
63 = D#4
64 = E4
65 = F4
66 = F#4
67 = G4
68 = G#4
69 = A4
70 = A#4
71 = B4
72 = C5
```

Runtime converts note numbers to frequencies.

This keeps exported data compact and consistent.

---

# Sound Effects

Sound effects are short procedural clips.

Examples:

```text
jump
smash
hit
death
ui_click
```

---

# Sound Command

```c
#pragma pack(push, 1)

typedef struct {
    uint8_t wave;

    uint8_t note_start;
    uint8_t note_end;

    uint16_t duration_ms;

    uint8_t volume;
} SoundCommand;

#pragma pack(pop)
```

Size:

```text
6 bytes
```

Field meaning:

```text
wave        = oscillator type
note_start  = starting note
note_end    = ending note
duration_ms = command duration
volume      = 0..255
```

Pitch changes linearly from `note_start` to `note_end`.

---

# Sound Definition

```c
typedef struct {
    uint16_t id;

    const SoundCommand *commands;
    uint16_t command_count;
} SoundDefinition;
```

---

# Sound Example

```c
static const SoundCommand COMMANDS[] = {
    { SOUND_WAVE_SQUARE, 72, 84, 90, 200 }
};

const SoundDefinition JUMP_SOUND = {
    .id = SOUND_ID_JUMP,

    .commands = COMMANDS,
    .command_count = sizeof(COMMANDS) / sizeof(COMMANDS[0]),
};
```

---

# Music

Music is generated procedurally and cached exactly like sound effects.

Music is rendered once into a `GeneratedSound` buffer.

Runtime playback can either:

- play once
- loop the whole generated buffer
- play an intro once, then loop only a selected loop region

---

# Music Instrument

```c
#pragma pack(push, 1)

typedef struct {
    uint8_t wave;

    uint8_t volume;

    uint16_t attack_ms;
    uint16_t decay_ms;

    uint8_t sustain;

    uint16_t release_ms;
} MusicInstrument;

#pragma pack(pop)
```

Envelope:

```text
Attack
Decay
Sustain
Release
```

ADSR values are applied during generation.

---

# Music Note

```c
#pragma pack(push, 1)

typedef struct {
    uint8_t instrument;

    uint8_t note;

    uint16_t start_tick;
    uint16_t duration_ticks;

    uint8_t volume;
} MusicNote;

#pragma pack(pop)
```

Size:

```text
7 bytes
```

Field meaning:

```text
instrument     = instrument index
note           = MIDI note
start_tick     = note position
duration_ticks = note length
volume         = 0..255
```

---

# Music Loop

Some tracks need a one-time intro or prelude before the main loop starts.

Example:

```text
0..63      intro / prelude
64..191    loop section
```

Playback should work like this:

```text
first pass:
0 → 191

then:
64 → 191
64 → 191
64 → 191
...
```

The intro must not repeat after the first pass.

---

# Music Loop Metadata

Loop metadata is optional.

If loop metadata is missing or disabled, the track keeps the old behavior.

```c
typedef struct {
    uint8_t enabled;

    uint16_t start_tick;
    uint16_t end_tick;
} MusicLoop;
```

Field meaning:

```text
enabled    = 0 or 1
start_tick = first tick of the loop region
end_tick   = exclusive end tick of the loop region
```

The loop end tick is exclusive.

This means the loop region is:

```text
[start_tick, end_tick)
```

Example:

```text
start_tick = 64
end_tick   = 192

looped ticks:
64..191
```

---

# Music Definition

```c
typedef struct {
    uint16_t id;

    uint16_t bpm;

    uint8_t ticks_per_beat;

    uint16_t length_ticks;

    MusicLoop loop;

    const MusicInstrument *instruments;
    uint16_t instrument_count;

    const MusicNote *notes;
    uint16_t note_count;
} MusicDefinition;
```

`loop.enabled = 0` means normal playback behavior.

`loop.enabled = 1` means playback starts from tick `0`, but after reaching `loop.end_tick`, it jumps back to `loop.start_tick`.

---

# Music Loop Validation

Exporter and packer must validate loop metadata.

Rules:

```text
loop.enabled must be 0 or 1
loop.start_tick >= 0
loop.end_tick > loop.start_tick
loop.end_tick <= length_ticks
```

If `loop.enabled = 0`, `loop.start_tick` and `loop.end_tick` may be `0`.

If `loop.enabled = 1`, invalid loop metadata is an export error.

Recommended strict behavior:

```text
Fail export with a clear message.
```

Do not silently fix invalid loop metadata.

---

# Notes Crossing Loop Boundaries

Notes should not cross `loop.end_tick`.

Problem example:

```text
note starts at 188
duration is 12
loop.end_tick is 192
```

That note would extend past the loop end.

For MVP, the exporter should fail with a clear error.

Recommended error:

```text
Music note crosses loop end:
start_tick=188 duration_ticks=12 loop_end_tick=192
```

Later, Cat Meow Studio may add an option to automatically clamp such notes.

For now, strict validation is safer and more predictable.

---

# Runtime Playback Rules

Correct behavior for music with loop metadata:

```text
Start playback at tick 0.
Play intro and main section normally.
When playhead reaches loop.end_tick, jump to loop.start_tick.
Continue looping between loop.start_tick and loop.end_tick.
```

Pseudocode:

```c
if (music->loop.enabled && play_tick >= music->loop.end_tick) {
    play_tick = music->loop.start_tick;
}
```

Music without loop metadata:

```text
Existing behavior remains unchanged.
```

If the old behavior was whole-track looping, it still loops from `0` to `length_ticks`.

---

# Runtime Sample Looping

Music is generated into one PCM buffer.

Loop metadata in ticks must be converted to sample positions during generation or playback setup.

Required generated metadata:

```c
typedef struct {
    uint16_t id;

    uint32_t sample_rate;
    uint32_t sample_count;

    uint8_t loop_enabled;
    uint32_t loop_start_sample;
    uint32_t loop_end_sample;

    int16_t *samples;
} GeneratedMusic;
```

Field meaning:

```text
loop_enabled      = 0 or 1
loop_start_sample = PCM sample index where loop begins
loop_end_sample   = exclusive PCM sample index where loop ends
```

If the engine reuses `GeneratedSound` for music, equivalent loop fields must be stored in the music playback state or in a separate music asset wrapper.

Do not store loop positions only in ticks at runtime playback level if playback operates in samples.

---

# Tick To Time Conversion

Music ticks are converted using:

```text
beats_per_minute = bpm
ticks_per_beat   = ticksPerBeat
seconds_per_beat = 60 / bpm
seconds_per_tick = seconds_per_beat / ticksPerBeat
```

Sample conversion:

```text
sample = tick * seconds_per_tick * sample_rate
```

Example:

```text
bpm = 120
ticks_per_beat = 4
sample_rate = 22050

seconds_per_tick = (60 / 120) / 4
                 = 0.125

samples_per_tick = 22050 * 0.125
                 = 2756.25
```

Because this may not be an integer, the generator should use the same rounding strategy consistently for notes, total length, and loop points.

Recommended:

```text
round to nearest sample
```

---

# Music JSON Interchange Format

Cat Meow Studio may import/export music as JSON for editing and tooling.

This is not a Little One runtime format.

Example:

```json
{
  "type": "music",
  "id": "robocat_theme",
  "bpm": 88,
  "ticksPerBeat": 4,
  "lengthTicks": 192,
  "loop": {
    "enabled": true,
    "startTick": 64,
    "endTick": 192
  },
  "instruments": [
    {
      "id": "lead",
      "wave": "square",
      "volume": 76,
      "attackMs": 5,
      "decayMs": 70,
      "sustain": 180,
      "releaseMs": 40
    }
  ],
  "notes": [
    {
      "instrument": 0,
      "note": 62,
      "startTick": 0,
      "durationTicks": 4,
      "volume": 220
    }
  ]
}
```

---

# Music JSON Fields

```text
type         = "music"
id           = editor asset id
bpm          = beats per minute
ticksPerBeat = ticks per beat
lengthTicks  = total track length in ticks
loop         = optional loop metadata
instruments  = instrument list
notes        = note list
```

---

# Music JSON Loop Fields

```json
"loop": {
  "enabled": true,
  "startTick": 64,
  "endTick": 192
}
```

Rules:

```text
enabled   = boolean
startTick = integer >= 0
endTick   = integer > startTick
endTick   <= lengthTicks
```

If `loop` is missing:

```text
No custom loop metadata.
Use old/default playback behavior.
```

If `loop.enabled` is `false`:

```text
Custom loop metadata is disabled.
Use old/default playback behavior.
```

---

# Music JSON Instrument Fields

```text
id        = editor-only instrument id
wave      = "square" | "sine" | "triangle" | "noise"
volume    = 0..255
attackMs  = attack duration
decayMs   = decay duration
sustain   = 0..255
releaseMs = release duration
```

Older JSON files may contain only:

```text
id
wave
volume
attackMs
decayMs
```

Importer should support older files and apply defaults:

```text
sustain   = 255
releaseMs = 0
```

---

# Music JSON Note Fields

```text
instrument    = instrument index
note          = MIDI note, 0..127
startTick     = note position
durationTicks = note length
volume        = 0..255
```

Older tools may emit note volume as `1..100`.

Importer should support both scales when possible.

Recommended editor behavior:

```text
If max note volume <= 100, treat it as percent and convert to 0..255.
If any note volume > 100, treat all note volumes as 0..255.
```

---

# Music JSON Export Rules

When Cat Meow Studio exports `*.music.json`:

- include `loop` only if loop metadata exists or if loop editing is enabled
- use camelCase field names
- sort notes by `startTick`, then `instrument`, then `note`
- write valid `lengthTicks`
- write valid instrument indexes
- write valid note ranges
- validate loop metadata
- validate notes crossing `loop.endTick`

---

# Music JSON Import Rules

When Cat Meow Studio imports `*.music.json`:

- accept files with missing `loop`
- accept files with `loop.enabled = false`
- validate files with `loop.enabled = true`
- support older instruments without `sustain` and `releaseMs`
- support older note volume range `1..100`
- preserve loop metadata when re-exporting

---

# MIDI Import Rules

Cat Meow Studio may import `.mid` / `.midi` files in the browser.

MIDI import converts MIDI notes into the Music JSON shape.

Rules:

```text
MIDI note number      → note
MIDI note start ticks → startTick
MIDI note duration    → durationTicks
MIDI velocity         → volume
```

MIDI import should support:

```text
selected track to lead
all tracks merged to lead
tracks mapped to instruments
output lengthTicks
quantize grid
transpose
optional loop metadata
```

MIDI import may optionally set:

```json
"loop": {
  "enabled": true,
  "startTick": 64,
  "endTick": 192
}
```

Use this when the user specifies intro length and loop length.

---

# Mixing Rules

Minimum runtime support:

```text
1 music channel
1 sound effect channel
```

Supported:

```text
music + sound effect
```

MVP behavior:

- music loops
- music may have a one-time intro before the loop
- one sound effect may play over music
- new sound effect may replace current sound effect

Advanced mixing may be added later.

---

# Asset IDs

Editor names are stored only in Cat Meow Studio.

Runtime assets use numeric IDs.

Example:

```c
typedef enum {
    SOUND_ID_JUMP = 1,
    SOUND_ID_SMASH,
    SOUND_ID_HIT,
    SOUND_ID_DEATH
} SoundId;
```

Example:

```c
typedef enum {
    MUSIC_ID_MAIN_THEME = 1,
    MUSIC_ID_GAME_OVER,
    MUSIC_ID_ROBOCAT_THEME
} MusicId;
```

The runtime should never perform string lookups.

---

# Export Rules

Cat Meow Studio exports:

```text
*.sound.c
*.music.c
```

Each file contains:

- include statement
- static arrays
- one public definition
- optional loop metadata for music

JSON export is allowed for editor interchange, debugging, and tooling.

JSON export is not required by Little One runtime.

---

# Music C Export Example

```c
#include "../music_definition.h"

static const MusicInstrument INSTRUMENTS[] = {
    {
        SOUND_WAVE_SQUARE,
        200,
        5,
        70,
        220,
        40
    }
};

static const MusicNote NOTES[] = {
    { 0, 62, 0, 4, 220 },
    { 0, 69, 4, 4, 200 },
    { 0, 65, 8, 4, 200 },
    { 0, 62, 12, 4, 220 }
};

const MusicDefinition ROBOCAT_THEME_MUSIC = {
    .id = MUSIC_ID_ROBOCAT_THEME,

    .bpm = 88,
    .ticks_per_beat = 4,

    .length_ticks = 192,

    .loop = {
        .enabled = 1,
        .start_tick = 64,
        .end_tick = 192
    },

    .instruments = INSTRUMENTS,
    .instrument_count = sizeof(INSTRUMENTS) / sizeof(INSTRUMENTS[0]),

    .notes = NOTES,
    .note_count = sizeof(NOTES) / sizeof(NOTES[0]),
};
```

---

# Runtime Rules

Correct:

```c
audio_play_sound(SOUND_ID_JUMP);
audio_play_music(MUSIC_ID_MAIN_THEME);
```

Wrong:

```c
parse_json(...);
load_wav(...);
generate_audio_every_frame(...);
```

Audio generation happens during startup only.

Music playback should use cached PCM and loop sample metadata.

---

# Backward Compatibility

Existing music without loop metadata remains valid.

Existing generated music definitions can be migrated by setting:

```c
.loop = {
    .enabled = 0,
    .start_tick = 0,
    .end_tick = 0
}
```

If the C compiler requires explicit initialization, exporters should emit disabled loop metadata for every music definition.

If not required, missing or zero-initialized loop metadata must mean disabled loop.

---

# Design Goal

Tiny source data.

Tiny APK.

Fast startup.

Fast playback.

No audio assets.

No runtime parsers.

Procedural audio for tiny .kkrieger-inspired games.
