import type { SoundProject } from "./soundProject.js";

export const soundPresets = [
  {
    id: "jump",
    commands: [
      {
        id: "jump-rise",
        wave: "square",
        frequencyStart: 420,
        frequencyEnd: 980,
        durationMs: 95,
        volume: 76,
      },
      {
        id: "jump-pop",
        wave: "triangle",
        frequencyStart: 880,
        frequencyEnd: 620,
        durationMs: 45,
        volume: 48,
      },
    ],
  },
  {
    id: "smash",
    commands: [
      {
        id: "smash-crack",
        wave: "noise",
        frequencyStart: 240,
        frequencyEnd: 60,
        durationMs: 130,
        volume: 94,
      },
      {
        id: "smash-drop",
        wave: "square",
        frequencyStart: 140,
        frequencyEnd: 36,
        durationMs: 120,
        volume: 72,
      },
    ],
  },
  {
    id: "hit",
    commands: [
      {
        id: "hit-punch",
        wave: "square",
        frequencyStart: 300,
        frequencyEnd: 120,
        durationMs: 55,
        volume: 86,
      },
      {
        id: "hit-noise",
        wave: "noise",
        frequencyStart: 180,
        frequencyEnd: 90,
        durationMs: 35,
        volume: 42,
      },
    ],
  },
  {
    id: "death",
    commands: [
      {
        id: "death-fall",
        wave: "triangle",
        frequencyStart: 520,
        frequencyEnd: 90,
        durationMs: 260,
        volume: 82,
      },
      {
        id: "death-noise",
        wave: "noise",
        frequencyStart: 90,
        frequencyEnd: 24,
        durationMs: 180,
        volume: 52,
      },
    ],
  },
  {
    id: "click",
    commands: [
      {
        id: "click-tick",
        wave: "square",
        frequencyStart: 1200,
        frequencyEnd: 860,
        durationMs: 24,
        volume: 58,
      },
    ],
  },
  {
    id: "coin",
    commands: [
      {
        id: "coin-first",
        wave: "sine",
        frequencyStart: 780,
        frequencyEnd: 1040,
        durationMs: 70,
        volume: 66,
      },
      {
        id: "coin-second",
        wave: "sine",
        frequencyStart: 1120,
        frequencyEnd: 1480,
        durationMs: 90,
        volume: 70,
      },
    ],
  },
  {
    id: "laser",
    commands: [
      {
        id: "laser-zap",
        wave: "square",
        frequencyStart: 1680,
        frequencyEnd: 260,
        durationMs: 170,
        volume: 78,
      },
      {
        id: "laser-glint",
        wave: "sine",
        frequencyStart: 2200,
        frequencyEnd: 900,
        durationMs: 40,
        volume: 36,
      },
    ],
  },
  {
    id: "explosion",
    commands: [
      {
        id: "explosion-blast",
        wave: "noise",
        frequencyStart: 280,
        frequencyEnd: 35,
        durationMs: 250,
        volume: 100,
      },
      {
        id: "explosion-rumble",
        wave: "square",
        frequencyStart: 80,
        frequencyEnd: 24,
        durationMs: 240,
        volume: 62,
      },
      {
        id: "explosion-tail",
        wave: "noise",
        frequencyStart: 70,
        frequencyEnd: 20,
        durationMs: 180,
        volume: 34,
      },
    ],
  },
] satisfies SoundProject[];

export type SoundPresetId = (typeof soundPresets)[number]["id"];

export function getSoundPreset(presetId: string): SoundProject | null {
  return soundPresets.find((preset) => preset.id === presetId) ?? null;
}

export function formatPresetName(presetId: string): string {
  return presetId
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
