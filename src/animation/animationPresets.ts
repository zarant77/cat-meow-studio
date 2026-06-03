import type { AnimationClip } from "./animationTypes.js";

export type AnimationPresetId = "idle_bounce" | "walk_squash" | "smash" | "land_squash" | "death";

export interface AnimationPreset {
  id: AnimationPresetId;
  label: string;
  createClip: (clipId: string) => AnimationClip;
}

export const animationPresets: readonly AnimationPreset[] = [
  {
    id: "idle_bounce",
    label: "Idle bounce",
    createClip: (clipId) => ({
      version: 1,
      id: clipId,
      durationMs: 900,
      loop: true,
      tracks: [
        {
          property: "offset_y",
          keys: [
            { timeMs: 0, value: 0, easing: "linear" },
            { timeMs: 450, value: -5, easing: "ease_out" },
            { timeMs: 900, value: 0, easing: "ease_in" },
          ],
        },
        {
          property: "scale_x",
          keys: [
            { timeMs: 0, value: 1000, easing: "linear" },
            { timeMs: 450, value: 1020, easing: "ease_out" },
            { timeMs: 900, value: 1000, easing: "ease_in" },
          ],
        },
        {
          property: "scale_y",
          keys: [
            { timeMs: 0, value: 1000, easing: "linear" },
            { timeMs: 450, value: 980, easing: "ease_out" },
            { timeMs: 900, value: 1000, easing: "ease_in" },
          ],
        },
      ],
    }),
  },
  {
    id: "walk_squash",
    label: "Walk squash",
    createClip: (clipId) => ({
      version: 1,
      id: clipId,
      durationMs: 600,
      loop: true,
      tracks: [
        {
          property: "scale_x",
          keys: [
            { timeMs: 0, value: 1000, easing: "linear" },
            { timeMs: 150, value: 930, easing: "ease_out" },
            { timeMs: 300, value: 1080, easing: "ease_in_out" },
            { timeMs: 450, value: 930, easing: "ease_out" },
            { timeMs: 600, value: 1000, easing: "ease_in" },
          ],
        },
        {
          property: "scale_y",
          keys: [
            { timeMs: 0, value: 1000, easing: "linear" },
            { timeMs: 150, value: 1080, easing: "ease_out" },
            { timeMs: 300, value: 930, easing: "ease_in_out" },
            { timeMs: 450, value: 1080, easing: "ease_out" },
            { timeMs: 600, value: 1000, easing: "ease_in" },
          ],
        },
      ],
    }),
  },
  {
    id: "smash",
    label: "Smash",
    createClip: (clipId) => ({
      version: 1,
      id: clipId,
      durationMs: 260,
      loop: false,
      tracks: [
        {
          property: "scale_x",
          keys: [
            { timeMs: 0, value: 1000, easing: "linear" },
            { timeMs: 120, value: 1260, easing: "ease_out" },
            { timeMs: 260, value: 1000, easing: "ease_in" },
          ],
        },
        {
          property: "scale_y",
          keys: [
            { timeMs: 0, value: 1000, easing: "linear" },
            { timeMs: 120, value: 760, easing: "ease_out" },
            { timeMs: 260, value: 1000, easing: "ease_in" },
          ],
        },
        {
          property: "rotation",
          keys: [
            { timeMs: 0, value: 0, easing: "linear" },
            { timeMs: 120, value: -350, easing: "ease_out" },
            { timeMs: 260, value: 0, easing: "ease_in" },
          ],
        },
      ],
    }),
  },
  {
    id: "death",
    label: "Death fade",
    createClip: (clipId) => ({
      version: 1,
      id: clipId,
      durationMs: 700,
      loop: false,
      tracks: [
        {
          property: "scale_x",
          keys: [
            { timeMs: 0, value: 1000, easing: "linear" },
            { timeMs: 260, value: 1120, easing: "ease_out" },
            { timeMs: 700, value: 850, easing: "ease_in" },
          ],
        },
        {
          property: "scale_y",
          keys: [
            { timeMs: 0, value: 1000, easing: "linear" },
            { timeMs: 260, value: 880, easing: "ease_out" },
            { timeMs: 700, value: 760, easing: "ease_in" },
          ],
        },
        {
          property: "alpha",
          keys: [
            { timeMs: 0, value: 255, easing: "linear" },
            { timeMs: 420, value: 180, easing: "ease_in_out" },
            { timeMs: 700, value: 0, easing: "ease_out" },
          ],
        },
        {
          property: "offset_y",
          keys: [
            { timeMs: 0, value: 0, easing: "linear" },
            { timeMs: 700, value: 10, easing: "ease_in" },
          ],
        },
      ],
    }),
  },
  {
    id: "land_squash",
    label: "Land squash",
    createClip: (clipId) => ({
      version: 1,
      id: clipId,
      durationMs: 360,
      loop: false,
      tracks: [
        {
          property: "scale_x",
          keys: [
            { timeMs: 0, value: 1000, easing: "linear" },
            { timeMs: 90, value: 1160, easing: "ease_out" },
            { timeMs: 360, value: 1000, easing: "ease_in_out" },
          ],
        },
        {
          property: "scale_y",
          keys: [
            { timeMs: 0, value: 1000, easing: "linear" },
            { timeMs: 90, value: 820, easing: "ease_out" },
            { timeMs: 360, value: 1000, easing: "ease_in_out" },
          ],
        },
      ],
    }),
  },
] as const;
