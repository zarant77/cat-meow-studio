import { isValidSoundId } from "../utils/symbolName.js";
import type { AnimationEasing, AnimationFile, AnimationKey, AnimationProperty, AnimationTrack } from "./animationTypes.js";
import { animationEasings, animationProperties } from "./animationTypes.js";

export type ImportAnimationJsonResult =
  | {
      ok: true;
      animationFile: AnimationFile;
    }
  | {
      ok: false;
      error: string;
    };

export function exportAnimationJson(animationFile: AnimationFile): string {
  return `${JSON.stringify(exportAnimationFile(animationFile), null, 2)}\n`;
}

export function importAnimationJson(text: string): ImportAnimationJsonResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return fail("The animation file is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    return fail("The animation file must be a JSON object.");
  }

  return parseAnimationFile(parsed);
}

function exportAnimationFile(animationFile: AnimationFile): AnimationFile {
  return {
    version: 1,
    id: animationFile.id,
    durationMs: toInteger(animationFile.durationMs),
    loop: animationFile.loop,
    tracks: animationFile.tracks.map((track) => ({
      property: track.property,
      keys: track.keys
        .map((key) => ({
          timeMs: toInteger(key.timeMs),
          value: toInteger(key.value),
          easing: key.easing,
        }))
        .sort((left, right) => left.timeMs - right.timeMs),
    })),
  };
}

function parseAnimationFile(value: Record<string, unknown>): ImportAnimationJsonResult {
  if (value.version !== 1) {
    return fail("Animation version must be 1.");
  }

  if (typeof value.id !== "string" || value.id.trim() === "") {
    return fail("Animation id is required.");
  }

  const id = value.id.trim();

  if (!isValidSoundId(id)) {
    return fail("Animation id must use lowercase letters, numbers, underscores, or hyphens.");
  }

  if (!isInteger(value.durationMs) || value.durationMs <= 0) {
    return fail("Animation durationMs must be an integer greater than 0.");
  }

  if (typeof value.loop !== "boolean") {
    return fail("Animation loop must be a boolean.");
  }

  if (!Array.isArray(value.tracks)) {
    return fail("Animation tracks must be an array.");
  }

  const tracksResult = parseTracks(value.tracks, value.durationMs);

  if (!tracksResult.ok) {
    return fail(tracksResult.error);
  }

  return {
    ok: true,
    animationFile: {
      version: 1,
      id,
      durationMs: value.durationMs,
      loop: value.loop,
      tracks: tracksResult.tracks,
    },
  };
}

type ParseTracksResult =
  | {
      ok: true;
      tracks: AnimationTrack[];
    }
  | {
      ok: false;
      error: string;
    };

function parseTracks(values: unknown[], durationMs: number): ParseTracksResult {
  const tracks: AnimationTrack[] = [];
  const properties = new Set<AnimationProperty>();

  for (const [index, value] of values.entries()) {
    const trackResult = parseTrack(value, durationMs, index);

    if (!trackResult.ok) {
      return trackResult;
    }

    if (properties.has(trackResult.track.property)) {
      return {
        ok: false,
        error: `Animation tracks must not contain duplicate "${trackResult.track.property}" tracks.`,
      };
    }

    properties.add(trackResult.track.property);
    tracks.push(trackResult.track);
  }

  return {
    ok: true,
    tracks,
  };
}

type ParseTrackResult =
  | {
      ok: true;
      track: AnimationTrack;
    }
  | {
      ok: false;
      error: string;
    };

function parseTrack(value: unknown, durationMs: number, trackIndex: number): ParseTrackResult {
  if (!isRecord(value)) {
    return failTrack(`Animation track ${trackIndex + 1} must be an object.`);
  }

  if (!isAnimationProperty(value.property)) {
    return failTrack(`Animation track ${trackIndex + 1} has an unsupported property.`);
  }

  if (!Array.isArray(value.keys)) {
    return failTrack(`Animation track "${value.property}" keys must be an array.`);
  }

  const keysResult = parseKeys(value.keys, durationMs, value.property);

  if (!keysResult.ok) {
    return failTrack(keysResult.error);
  }

  return {
    ok: true,
    track: {
      property: value.property,
      keys: keysResult.keys,
    },
  };
}

type ParseKeysResult =
  | {
      ok: true;
      keys: AnimationKey[];
    }
  | {
      ok: false;
      error: string;
    };

function parseKeys(values: unknown[], durationMs: number, property: AnimationProperty): ParseKeysResult {
  const keys: AnimationKey[] = [];

  for (const [index, value] of values.entries()) {
    const keyResult = parseKey(value, durationMs, property, index);

    if (!keyResult.ok) {
      return keyResult;
    }

    keys.push(keyResult.key);
  }

  return {
    ok: true,
    keys: keys.sort((left, right) => left.timeMs - right.timeMs),
  };
}

type ParseKeyResult =
  | {
      ok: true;
      key: AnimationKey;
    }
  | {
      ok: false;
      error: string;
    };

function parseKey(value: unknown, durationMs: number, property: AnimationProperty, keyIndex: number): ParseKeyResult {
  const keyLabel = `Animation key ${keyIndex + 1} in "${property}"`;

  if (!isRecord(value)) {
    return failKey(`${keyLabel} must be an object.`);
  }

  if (!isInteger(value.timeMs) || value.timeMs < 0 || value.timeMs > durationMs) {
    return failKey(`${keyLabel} timeMs must be an integer inside 0..${durationMs}.`);
  }

  if (!isInteger(value.value)) {
    return failKey(`${keyLabel} value must be an integer.`);
  }

  if (!isValidPropertyValue(property, value.value)) {
    return failKey(`${keyLabel} value is outside the supported range for "${property}".`);
  }

  if (!isAnimationEasing(value.easing)) {
    return failKey(`${keyLabel} has an unsupported easing value.`);
  }

  return {
    ok: true,
    key: {
      timeMs: value.timeMs,
      value: value.value,
      easing: value.easing,
    },
  };
}

function toInteger(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function isAnimationProperty(value: unknown): value is AnimationProperty {
  return typeof value === "string" && animationProperties.includes(value as AnimationProperty);
}

function isAnimationEasing(value: unknown): value is AnimationEasing {
  return typeof value === "string" && animationEasings.includes(value as AnimationEasing);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function isValidPropertyValue(property: AnimationProperty, value: number): boolean {
  if (property === "rotation") {
    return value >= -32768 && value <= 32767;
  }

  if (property === "alpha") {
    return value >= 0 && value <= 255;
  }

  return true;
}

function fail(error: string): ImportAnimationJsonResult {
  return {
    ok: false,
    error,
  };
}

function failTrack(error: string): ParseTrackResult {
  return {
    ok: false,
    error,
  };
}

function failKey(error: string): ParseKeyResult {
  return {
    ok: false,
    error,
  };
}
