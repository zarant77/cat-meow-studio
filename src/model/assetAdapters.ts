import type {
  AssetId,
  MusicProjectAsset,
  ProjectAsset,
  ProjectAssetBase,
  SfxProjectAsset,
  SpriteAssetData,
  SpriteProjectAsset,
  Timestamp,
} from "./assets.js";
import type { MusicProject } from "./musicProject.js";
import type { SoundProject } from "./soundProject.js";
import { cloneNodes } from "../sprites/document/CatPaintDocument.js";

interface AssetMetadata {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function createSpriteProjectAsset(sprite: SpriteAssetData, metadata: AssetMetadata = {}): SpriteProjectAsset {
  const base = createProjectAssetBase({
    id: toAssetId(sprite.spriteId),
    kind: "sprite",
    name: sprite.spriteId,
    metadata,
  });

  return {
    ...base,
    kind: "sprite",
    sprite: {
      ...sprite,
      palette: sprite.palette.map((color) => ({ ...color })),
      nodes: cloneNodes(sprite.nodes),
    },
  };
}

export function createMusicProjectAsset(music: MusicProject, metadata: AssetMetadata = {}): MusicProjectAsset {
  const base = createProjectAssetBase({
    id: toAssetId(music.id),
    kind: "music",
    name: music.id,
    metadata,
  });

  return {
    ...base,
    kind: "music",
    music: cloneMusicProject(music),
  };
}

export function createSfxProjectAsset(sfx: SoundProject, metadata: AssetMetadata = {}): SfxProjectAsset {
  const base = createProjectAssetBase({
    id: toAssetId(sfx.id),
    kind: "sfx",
    name: sfx.id,
    metadata,
  });

  return {
    ...base,
    kind: "sfx",
    sfx: cloneSoundProject(sfx),
  };
}

function createProjectAssetBase(input: {
  id: AssetId;
  kind: ProjectAsset["kind"];
  name: string;
  metadata: AssetMetadata;
}): ProjectAssetBase {
  const timestamp = new Date().toISOString();

  return {
    id: input.id,
    kind: input.kind,
    name: input.name,
    createdAt: input.metadata.createdAt ?? timestamp,
    updatedAt: input.metadata.updatedAt ?? timestamp,
  };
}

function toAssetId(value: string): AssetId {
  const id = value.trim();

  return id === "" ? "asset" : id;
}

function cloneMusicProject(project: MusicProject): MusicProject {
  return {
    ...project,
    instruments: project.instruments.map((instrument) => ({ ...instrument })),
    notes: project.notes.map((note) => ({ ...note })),
  };
}

function cloneSoundProject(project: SoundProject): SoundProject {
  return {
    ...project,
    commands: project.commands.map((command) => ({ ...command })),
  };
}
