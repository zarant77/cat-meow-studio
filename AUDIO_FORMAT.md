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

---

# Philosophy

Store instructions.

Generate samples once.

Play cached PCM.

No WAV.

No OGG.

No MP3.

No JSON.

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

Pitch changes linearly from note_start to note_end.

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

Music is rendered once into a GeneratedSound buffer.

Runtime playback loops the generated buffer.

---

# Instrument

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

# Note

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

# Music Definition

```c
typedef struct {
    uint16_t id;

    uint16_t bpm;

    uint8_t ticks_per_beat;

    uint16_t length_ticks;

    const MusicInstrument *instruments;
    uint16_t instrument_count;

    const MusicNote *notes;
    uint16_t note_count;
} MusicDefinition;
```

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

No JSON export is required.

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

---

# Design Goal

Tiny source data.

Tiny APK.

Fast startup.

Fast playback.

No audio assets.

No runtime parsers.

Procedural audio for tiny .kkrieger-inspired games.
