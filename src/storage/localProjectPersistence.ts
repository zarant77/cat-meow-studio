import type { AssetId, AssetKind, Project, ProjectAsset, SpriteAssetData } from "../model/assets.js";
import { isMusicWave, type MusicInstrument, type MusicNote, type MusicProject } from "../model/musicProject.js";
import { soundWaves, type SoundCommand, type SoundProject, type SoundWave } from "../model/soundProject.js";
import type { SelectedAssetIds } from "../state/projectState.js";
import type { SceneNode } from "../sprites/document/CatPaintDocument.js";
import type { Primitive, PrimitiveKind } from "../sprites/primitives/Primitive.js";
import type { AppMode } from "../ui/appTypes.js";

const localProjectStorageKey = "cat-meow-studio:project";

export interface PersistedProjectState {
  project: Project;
  selectedAssetIds: SelectedAssetIds;
  activeMode: AppMode;
}

export function saveLocalProjectState(state: PersistedProjectState): boolean {
  try {
    window.localStorage.setItem(localProjectStorageKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadLocalProjectState(): PersistedProjectState | null {
  const source = getLocalProjectSource();

  if (source === null) {
    return null;
  }

  try {
    return readPersistedProjectState(JSON.parse(source) as unknown);
  } catch {
    return null;
  }
}

export function clearLocalProjectState(): void {
  try {
    window.localStorage.removeItem(localProjectStorageKey);
  } catch {
    return;
  }
}

function getLocalProjectSource(): string | null {
  try {
    return window.localStorage.getItem(localProjectStorageKey);
  } catch {
    return null;
  }
}

export function readPersistedProjectState(value: unknown): PersistedProjectState | null {
  if (!isRecord(value)) {
    return null;
  }

  const project = readProject(value.project);
  const selectedAssetIds = readSelectedAssetIds(value.selectedAssetIds);
  const activeMode = readAppMode(value.activeMode);

  if (project === null || selectedAssetIds === null || activeMode === null) {
    return null;
  }

  return {
    project,
    selectedAssetIds,
    activeMode,
  };
}

function readProject(value: unknown): Project | null {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name) || !Array.isArray(value.assets)) {
    return null;
  }

  const assets: ProjectAsset[] = [];

  for (const assetValue of value.assets) {
    const asset = readProjectAsset(assetValue);

    if (asset === null) {
      return null;
    }

    assets.push(asset);
  }

  return {
    id: value.id,
    name: value.name,
    assets,
  };
}

function readProjectAsset(value: unknown): ProjectAsset | null {
  if (!isRecord(value)) {
    return null;
  }

  const base = readProjectAssetBase(value);

  if (base === null) {
    return null;
  }

  if (base.kind === "sprite") {
    const sprite = readSpriteAssetData(value.sprite);

    return sprite === null ? null : { ...base, kind: "sprite", sprite };
  }

  if (base.kind === "music") {
    const music = readMusicProject(value.music);

    return music === null ? null : { ...base, kind: "music", music };
  }

  const sfx = readSoundProject(value.sfx);

  return sfx === null ? null : { ...base, kind: "sfx", sfx };
}

function readProjectAssetBase(value: Record<string, unknown>): Pick<ProjectAsset, "id" | "kind" | "name" | "createdAt" | "updatedAt"> | null {
  if (!isString(value.id) || !isAssetKind(value.kind) || !isString(value.name) || !isString(value.createdAt) || !isString(value.updatedAt)) {
    return null;
  }

  return {
    id: value.id,
    kind: value.kind,
    name: value.name,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function readSelectedAssetIds(value: unknown): SelectedAssetIds | null {
  if (!isRecord(value) || !isSelectedAssetId(value.sprite) || !isSelectedAssetId(value.music) || !isSelectedAssetId(value.sfx)) {
    return null;
  }

  return {
    sprite: value.sprite,
    music: value.music,
    sfx: value.sfx,
  };
}

function readSpriteAssetData(value: unknown): SpriteAssetData | null {
  if (
    !isRecord(value) ||
    !isString(value.spriteId) ||
    !isCanvasDimension(value.width) ||
    !isCanvasDimension(value.height) ||
    !isNumber(value.pivotX) ||
    !isNumber(value.pivotY) ||
    !Array.isArray(value.nodes)
  ) {
    return null;
  }

  const nodes = readSceneNodes(value.nodes);

  if (nodes === null) {
    return null;
  }

  return {
    spriteId: value.spriteId,
    width: value.width,
    height: value.height,
    pivotX: value.pivotX,
    pivotY: value.pivotY,
    nodes,
  };
}

function readSceneNodes(values: unknown[]): SceneNode[] | null {
  const nodes: SceneNode[] = [];

  for (const value of values) {
    const node = readSceneNode(value);

    if (node === null) {
      return null;
    }

    nodes.push(node);
  }

  return nodes;
}

function readSceneNode(value: unknown): SceneNode | null {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name) || !isBoolean(value.visible) || !isBoolean(value.locked)) {
    return null;
  }

  if (value.type === "primitive") {
    const command = readPrimitive(value.command);

    if (command === null) {
      return null;
    }

    return {
      id: value.id,
      type: "primitive",
      name: value.name,
      visible: value.visible,
      locked: value.locked,
      command,
    };
  }

  if (value.type !== "group" || !Array.isArray(value.children)) {
    return null;
  }

  const children = readSceneNodes(value.children);

  if (children === null) {
    return null;
  }

  return {
    id: value.id,
    type: "group",
    name: value.name,
    visible: value.visible,
    locked: value.locked,
    children,
  };
}

function readPrimitive(value: unknown): Primitive | null {
  if (
    !isRecord(value) ||
    !isPrimitiveKind(value.kind) ||
    !isNumber(value.x) ||
    !isNumber(value.y) ||
    !isNumber(value.w) ||
    !isNumber(value.h) ||
    !isNumber(value.rotation) ||
    !isString(value.color)
  ) {
    return null;
  }

  const color = readPrimitiveColor(value.color);

  if (color === null) {
    return null;
  }

  return {
    kind: value.kind,
    x: value.x,
    y: value.y,
    w: value.w,
    h: value.h,
    rotation: value.rotation,
    color,
  };
}

function readPrimitiveColor(color: string): string | null {
  if (/^[0-9a-f]{8}$/.test(color)) {
    return color;
  }

  return null;
}

function readMusicProject(value: unknown): MusicProject | null {
  if (
    !isRecord(value) ||
    value.type !== "music" ||
    !isString(value.id) ||
    !isNumber(value.bpm) ||
    !isNumber(value.ticksPerBeat) ||
    !isNumber(value.lengthTicks) ||
    !Array.isArray(value.instruments) ||
    !Array.isArray(value.notes)
  ) {
    return null;
  }

  const instruments = readMusicInstruments(value.instruments);
  const notes = readMusicNotes(value.notes);

  if (instruments === null || notes === null) {
    return null;
  }

  return {
    type: "music",
    id: value.id,
    bpm: value.bpm,
    ticksPerBeat: value.ticksPerBeat,
    lengthTicks: value.lengthTicks,
    instruments,
    notes,
  };
}

function readMusicInstruments(values: unknown[]): MusicInstrument[] | null {
  const instruments: MusicInstrument[] = [];

  for (const value of values) {
    if (!isRecord(value) || !isString(value.id) || !isString(value.wave) || !isMusicWave(value.wave) || !isNumber(value.volume) || !isNumber(value.attackMs) || !isNumber(value.decayMs)) {
      return null;
    }

    instruments.push({
      id: value.id,
      wave: value.wave,
      volume: value.volume,
      attackMs: value.attackMs,
      decayMs: value.decayMs,
    });
  }

  return instruments;
}

function readMusicNotes(values: unknown[]): MusicNote[] | null {
  const notes: MusicNote[] = [];

  for (const value of values) {
    if (
      !isRecord(value) ||
      !isString(value.id) ||
      !isNumber(value.instrument) ||
      !isNumber(value.note) ||
      !isNumber(value.startTick) ||
      !isNumber(value.durationTicks) ||
      !isNumber(value.volume)
    ) {
      return null;
    }

    notes.push({
      id: value.id,
      instrument: value.instrument,
      note: value.note,
      startTick: value.startTick,
      durationTicks: value.durationTicks,
      volume: value.volume,
    });
  }

  return notes;
}

function readSoundProject(value: unknown): SoundProject | null {
  if (!isRecord(value) || !isString(value.id) || !Array.isArray(value.commands)) {
    return null;
  }

  const commands = readSoundCommands(value.commands);

  if (commands === null) {
    return null;
  }

  return {
    id: value.id,
    commands,
  };
}

function readSoundCommands(values: unknown[]): SoundCommand[] | null {
  const commands: SoundCommand[] = [];

  for (const value of values) {
    if (
      !isRecord(value) ||
      !isString(value.id) ||
      !isString(value.wave) ||
      !isSoundWave(value.wave) ||
      !isNumber(value.frequencyStart) ||
      !isNumber(value.frequencyEnd) ||
      !isNumber(value.durationMs) ||
      !isNumber(value.volume)
    ) {
      return null;
    }

    commands.push({
      id: value.id,
      wave: value.wave,
      frequencyStart: value.frequencyStart,
      frequencyEnd: value.frequencyEnd,
      durationMs: value.durationMs,
      volume: value.volume,
    });
  }

  return commands;
}

function readAppMode(value: unknown): AppMode | null {
  if (value === "music" || value === "sfx" || value === "sprites") {
    return value;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCanvasDimension(value: unknown): value is number {
  return Number.isInteger(value) && value >= 1 && value <= 1020;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isAssetKind(value: unknown): value is AssetKind {
  return value === "sprite" || value === "music" || value === "sfx";
}

function isSelectedAssetId(value: unknown): value is AssetId | null {
  return value === null || typeof value === "string";
}

function isPrimitiveKind(value: unknown): value is PrimitiveKind {
  return value === "rect" || value === "circle" || value === "triangle";
}

function isSoundWave(value: string): value is SoundWave {
  return soundWaves.some((wave) => wave === value);
}
