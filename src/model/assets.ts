import type { MusicProject } from "./musicProject.js";
import type { SoundProject } from "./soundProject.js";
import type { SceneNode } from "../sprites/document/CatPaintDocument.js";

export type AssetKind = "sprite" | "music" | "sfx";

export type AssetId = string;

export type Timestamp = string;

export interface ProjectAssetBase {
  id: AssetId;
  kind: AssetKind;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SpriteAssetData {
  spriteId: string;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
  nodes: SceneNode[];
}

export interface SpriteProjectAsset extends ProjectAssetBase {
  kind: "sprite";
  sprite: SpriteAssetData;
}

export interface MusicProjectAsset extends ProjectAssetBase {
  kind: "music";
  music: MusicProject;
}

export interface SfxProjectAsset extends ProjectAssetBase {
  kind: "sfx";
  sfx: SoundProject;
}

export type ProjectAsset = SpriteProjectAsset | MusicProjectAsset | SfxProjectAsset;

export interface Project {
  id: string;
  name: string;
  assets: ProjectAsset[];
}
