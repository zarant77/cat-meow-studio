import type { AssetId, AssetKind, Project, ProjectAsset, SpritePaletteColor } from "../model/assets.js";
import type { SceneNode } from "../sprites/document/CatPaintDocument.js";

export type SelectedAssetIds = Record<AssetKind, AssetId | null>;

type ProjectStateListener = () => void;

const initialProject: Project = {
  id: "cat-meow-studio",
  name: "Cat Meow Studio",
  spritePalette: createDefaultSpritePalette(),
  assets: [],
};

let projectState: Project = cloneProject(initialProject);
let selectedAssetIds: SelectedAssetIds = createEmptySelectedAssetIds();
const projectStateListeners: ProjectStateListener[] = [];

export function subscribeProjectState(listener: ProjectStateListener): () => void {
  projectStateListeners.push(listener);

  return () => {
    const index = projectStateListeners.indexOf(listener);

    if (index !== -1) {
      projectStateListeners.splice(index, 1);
    }
  };
}

export function replaceProjectState(project: Project, selectedIds: SelectedAssetIds, options: { emit?: boolean } = {}): void {
  projectState = cloneProject(project);
  ensureAllSpriteAssetColorsInPalette();
  selectedAssetIds = {
    sprite: selectedIds.sprite,
    music: selectedIds.music,
    sfx: selectedIds.sfx,
  };

  if (options.emit ?? true) {
    emitProjectStateChanged();
  }
}

export function resetProjectState(options: { emit?: boolean } = {}): void {
  replaceProjectState(initialProject, createEmptySelectedAssetIds(), options);
}

export function getSelectedAssetIds(): SelectedAssetIds {
  return {
    sprite: selectedAssetIds.sprite,
    music: selectedAssetIds.music,
    sfx: selectedAssetIds.sfx,
  };
}

function createEmptySelectedAssetIds(): SelectedAssetIds {
  return {
    sprite: null,
    music: null,
    sfx: null,
  };
}

export function getProject(): Project {
  return cloneProject(projectState);
}

export function getProjectAssets(): ProjectAsset[] {
  return projectState.assets.map(cloneProjectAsset);
}

export function upsertProjectAsset(asset: ProjectAsset): void {
  ensureSpriteAssetColorsInPalette(asset);
  const existingIndex = projectState.assets.findIndex((candidate) => candidate.kind === asset.kind && candidate.id === asset.id);
  const existingAsset = existingIndex === -1 ? null : projectState.assets[existingIndex];
  const nextAsset: ProjectAsset = {
    ...cloneProjectAsset(asset),
    createdAt: existingAsset?.createdAt ?? asset.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex === -1) {
    projectState = {
      ...projectState,
      assets: [...projectState.assets, nextAsset],
    };
    selectedAssetIds = {
      ...selectedAssetIds,
      [asset.kind]: nextAsset.id,
    };
    emitProjectStateChanged();
    return;
  }

  projectState = {
    ...projectState,
    assets: projectState.assets.map((candidate, index) => (index === existingIndex ? nextAsset : candidate)),
  };
  selectedAssetIds = {
    ...selectedAssetIds,
    [asset.kind]: nextAsset.id,
  };
  emitProjectStateChanged();
}

export function upsertCurrentProjectAsset(asset: ProjectAsset): void {
  ensureSpriteAssetColorsInPalette(asset);
  const selectedAssetId = selectedAssetIds[asset.kind];
  const existingIndex = projectState.assets.findIndex((candidate) => {
    if (candidate.kind !== asset.kind) {
      return false;
    }

    return selectedAssetId === null ? candidate.id === asset.id : candidate.id === selectedAssetId;
  });
  const existingAsset = existingIndex === -1 ? null : projectState.assets[existingIndex];
  const nextAsset: ProjectAsset = {
    ...cloneProjectAsset(asset),
    createdAt: existingAsset?.createdAt ?? asset.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex === -1) {
    projectState = {
      ...projectState,
      assets: [...projectState.assets, nextAsset],
    };
    selectedAssetIds = {
      ...selectedAssetIds,
      [asset.kind]: nextAsset.id,
    };
    emitProjectStateChanged();
    return;
  }

  projectState = {
    ...projectState,
    assets: projectState.assets.map((candidate, index) => (index === existingIndex ? nextAsset : candidate)),
  };
  selectedAssetIds = {
    ...selectedAssetIds,
    [asset.kind]: nextAsset.id,
  };
  emitProjectStateChanged();
}

export function findProjectAsset(kind: AssetKind, id: AssetId): ProjectAsset | null {
  const asset = projectState.assets.find((candidate) => candidate.kind === kind && candidate.id === id);

  return asset === undefined ? null : cloneProjectAsset(asset);
}

export function selectProjectAsset(kind: AssetKind, id: AssetId): ProjectAsset | null {
  const asset = findProjectAsset(kind, id);

  if (asset === null) {
    return null;
  }

  selectedAssetIds = {
    ...selectedAssetIds,
    [kind]: id,
  };
  emitProjectStateChanged();

  return asset;
}

export function setSelectedProjectAsset(kind: AssetKind, id: AssetId | null): void {
  selectedAssetIds = {
    ...selectedAssetIds,
    [kind]: id,
  };
  emitProjectStateChanged();
}

export function getSelectedProjectAssetId(kind: AssetKind): AssetId | null {
  return selectedAssetIds[kind];
}

export function deleteProjectAsset(kind: AssetKind, id: AssetId): void {
  projectState = {
    ...projectState,
    assets: projectState.assets.filter((asset) => asset.kind !== kind || asset.id !== id),
  };

  if (selectedAssetIds[kind] !== id) {
    emitProjectStateChanged();
    return;
  }

  const nextSelectedAsset = projectState.assets.find((asset) => asset.kind === kind);
  selectedAssetIds = {
    ...selectedAssetIds,
    [kind]: nextSelectedAsset?.id ?? null,
  };
  emitProjectStateChanged();
}

export function renameProjectAsset(kind: AssetKind, id: AssetId, name: string): ProjectAsset | null {
  const asset = findProjectAsset(kind, id);
  const nextName = name.trim();

  if (asset === null || nextName === "") {
    return null;
  }

  const renamedAsset = withAssetIdentity(asset, toUniqueAssetId(nextName, kind, id), nextName);
  upsertProjectAsset(renamedAsset);

  if (renamedAsset.id !== id) {
    deleteProjectAsset(kind, id);
    selectedAssetIds = {
      ...selectedAssetIds,
      [kind]: renamedAsset.id,
    };
  }

  return cloneProjectAsset(renamedAsset);
}

export function duplicateProjectAsset(kind: AssetKind, id: AssetId): ProjectAsset | null {
  const asset = findProjectAsset(kind, id);

  if (asset === null) {
    return null;
  }

  const nextName = toDuplicateName(asset.name);
  const duplicatedAsset = withAssetIdentity(asset, toUniqueAssetId(nextName, kind), nextName);
  upsertProjectAsset(duplicatedAsset);

  return cloneProjectAsset(duplicatedAsset);
}

export function getFirstProjectAsset(kind: AssetKind): ProjectAsset | null {
  const asset = projectState.assets.find((candidate) => candidate.kind === kind);

  return asset === undefined ? null : cloneProjectAsset(asset);
}

export function getProjectAssetSummary(): Array<Pick<ProjectAsset, "id" | "kind" | "name" | "createdAt" | "updatedAt">> {
  return projectState.assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }));
}

export function getSpritePalette(): SpritePaletteColor[] {
  return projectState.spritePalette.map(cloneSpritePaletteColor);
}

export function addSpritePaletteColor(): SpritePaletteColor | null {
  if (projectState.spritePalette.length >= 256) {
    return null;
  }

  const nextColor: SpritePaletteColor = {
    name: toUniquePaletteName("Color"),
    rgba: toUniquePaletteRgba("#ffffffff"),
  };

  projectState = {
    ...projectState,
    spritePalette: [...projectState.spritePalette, nextColor],
  };
  emitProjectStateChanged();

  return cloneSpritePaletteColor(nextColor);
}

export function renameSpritePaletteColor(index: number, name: string): SpritePaletteColor | null {
  const color = projectState.spritePalette[index];
  const nextName = name.trim();

  if (color === undefined || nextName === "") {
    return null;
  }

  const nextColor = {
    ...color,
    name: nextName,
  };

  projectState = {
    ...projectState,
    spritePalette: projectState.spritePalette.map((candidate, candidateIndex) => (candidateIndex === index ? nextColor : candidate)),
  };
  emitProjectStateChanged();

  return cloneSpritePaletteColor(nextColor);
}

export function updateSpritePaletteColor(index: number, rgba: string): SpritePaletteColor | null {
  const color = projectState.spritePalette[index];
  const nextRgba = normalizeRgba(rgba);

  if (color === undefined || nextRgba === null || (index === 0 && nextRgba !== "#00000000")) {
    return null;
  }

  const nextColor = {
    ...color,
    rgba: nextRgba,
  };

  projectState = {
    ...projectState,
    spritePalette: projectState.spritePalette.map((candidate, candidateIndex) => (candidateIndex === index ? nextColor : candidate)),
    assets: replaceSpriteColor(projectState.assets, color.rgba, nextRgba),
  };
  emitProjectStateChanged();

  return cloneSpritePaletteColor(nextColor);
}

export function deleteSpritePaletteColor(index: number): boolean {
  if (index <= 0 || index >= projectState.spritePalette.length || isSpritePaletteColorUsed(index)) {
    return false;
  }

  projectState = {
    ...projectState,
    spritePalette: projectState.spritePalette.filter((_, candidateIndex) => candidateIndex !== index),
  };
  emitProjectStateChanged();

  return true;
}

export function isSpritePaletteColorUsed(index: number): boolean {
  const color = projectState.spritePalette[index];

  if (color === undefined) {
    return false;
  }

  return projectState.assets.some((asset) => {
    if (asset.kind !== "sprite") {
      return false;
    }

    return isColorUsedInNodes(asset.sprite.nodes, color.rgba);
  });
}

function cloneProject(project: Project): Project {
  return {
    ...project,
    spritePalette: project.spritePalette.map(cloneSpritePaletteColor),
    assets: project.assets.map(cloneProjectAsset),
  };
}

function cloneSpritePaletteColor(color: SpritePaletteColor): SpritePaletteColor {
  return {
    name: color.name,
    rgba: color.rgba,
  };
}

function cloneProjectAsset(asset: ProjectAsset): ProjectAsset {
  if (asset.kind === "sprite") {
    return {
      ...asset,
      sprite: {
        ...asset.sprite,
        nodes: asset.sprite.nodes.map(cloneSceneNode),
      },
    };
  }

  if (asset.kind === "music") {
    return {
      ...asset,
      music: {
        ...asset.music,
        instruments: asset.music.instruments.map((instrument) => ({ ...instrument })),
        notes: asset.music.notes.map((note) => ({ ...note })),
      },
    };
  }

  return {
    ...asset,
    sfx: {
      ...asset.sfx,
      commands: asset.sfx.commands.map((command) => ({ ...command })),
    },
  };
}

function withAssetIdentity(asset: ProjectAsset, id: AssetId, name: string): ProjectAsset {
  const timestamp = new Date().toISOString();

  if (asset.kind === "sprite") {
    return {
      ...asset,
      id,
      name,
      createdAt: timestamp,
      updatedAt: timestamp,
      sprite: {
        ...asset.sprite,
        spriteId: id,
        nodes: asset.sprite.nodes.map(cloneSceneNode),
      },
    };
  }

  if (asset.kind === "music") {
    return {
      ...asset,
      id,
      name,
      createdAt: timestamp,
      updatedAt: timestamp,
      music: {
        ...asset.music,
        id,
        instruments: asset.music.instruments.map((instrument) => ({ ...instrument })),
        notes: asset.music.notes.map((note) => ({ ...note })),
      },
    };
  }

  return {
    ...asset,
    id,
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    sfx: {
      ...asset.sfx,
      id,
      commands: asset.sfx.commands.map((command) => ({ ...command })),
    },
  };
}

function toUniqueAssetId(name: string, kind: AssetKind, currentId: AssetId | null = null): AssetId {
  const baseId = toAssetId(name);
  let candidate = baseId;
  let suffix = 2;

  while (projectState.assets.some((asset) => asset.kind === kind && asset.id === candidate && asset.id !== currentId)) {
    candidate = `${baseId}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function toAssetId(value: string): AssetId {
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return id === "" ? "asset" : id;
}

function toDuplicateName(name: string): string {
  return `${name} copy`;
}

function cloneSceneNode(node: SceneNode): SceneNode {
  if (node.type === "primitive") {
    return {
      ...node,
      command: { ...node.command },
    };
  }

  return {
    ...node,
    children: node.children.map(cloneSceneNode),
  };
}

function createDefaultSpritePalette(): SpritePaletteColor[] {
  return [
    { name: "Transparent", rgba: "#00000000" },
    { name: "Ink", rgba: "#111111ff" },
    { name: "White", rgba: "#ffffffff" },
  ];
}

function ensureSpriteAssetColorsInPalette(asset: ProjectAsset): void {
  if (asset.kind !== "sprite") {
    return;
  }

  for (const rgba of getNodeColors(asset.sprite.nodes)) {
    addRgbaToProjectPalette(rgba);
  }
}

function ensureAllSpriteAssetColorsInPalette(): void {
  for (const asset of projectState.assets) {
    ensureSpriteAssetColorsInPalette(asset);
  }
}

function addRgbaToProjectPalette(rgba: string): void {
  if (projectState.spritePalette.some((color) => color.rgba === rgba) || projectState.spritePalette.length >= 256) {
    return;
  }

  projectState = {
    ...projectState,
    spritePalette: [
      ...projectState.spritePalette,
      {
        name: toUniquePaletteName("Color"),
        rgba,
      },
    ],
  };
}

function getNodeColors(nodes: readonly SceneNode[]): string[] {
  const colors: string[] = [];

  for (const node of nodes) {
    if (node.type === "group") {
      colors.push(...getNodeColors(node.children));
      continue;
    }

    colors.push(primitiveToRgba(node.command.color, node.command.alpha));
  }

  return colors;
}

function replaceSpriteColor(assets: readonly ProjectAsset[], oldRgba: string, nextRgba: string): ProjectAsset[] {
  const color = rgbaToPrimitiveColor(nextRgba);

  return assets.map((asset) => {
    if (asset.kind !== "sprite") {
      return cloneProjectAsset(asset);
    }

    return {
      ...asset,
      sprite: {
        ...asset.sprite,
        nodes: replaceNodeColor(asset.sprite.nodes, oldRgba, color),
      },
    };
  });
}

function replaceNodeColor(nodes: readonly SceneNode[], oldRgba: string, nextColor: { color: string; alpha: number }): SceneNode[] {
  return nodes.map((node) => {
    if (node.type === "group") {
      return {
        ...node,
        children: replaceNodeColor(node.children, oldRgba, nextColor),
      };
    }

    if (primitiveToRgba(node.command.color, node.command.alpha) !== oldRgba) {
      return cloneSceneNode(node);
    }

    return {
      ...node,
      command: {
        ...node.command,
        color: nextColor.color,
        alpha: nextColor.alpha,
      },
    };
  });
}

function isColorUsedInNodes(nodes: readonly SceneNode[], rgba: string): boolean {
  return nodes.some((node) => {
    if (node.type === "group") {
      return isColorUsedInNodes(node.children, rgba);
    }

    return primitiveToRgba(node.command.color, node.command.alpha) === rgba;
  });
}

function primitiveToRgba(color: string, alpha: number): string {
  const normalizedColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#000000";
  const normalizedAlpha = Math.min(255, Math.max(0, Number.isFinite(alpha) ? Math.round(alpha) : 255));

  return `${normalizedColor}${normalizedAlpha.toString(16).padStart(2, "0")}`;
}

function rgbaToPrimitiveColor(rgba: string): { color: string; alpha: number } {
  return {
    color: rgba.slice(0, 7),
    alpha: Number.parseInt(rgba.slice(7, 9), 16),
  };
}

function normalizeRgba(value: string): string | null {
  const trimmedValue = value.trim();
  const match = /^(?:#|0x)([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/i.exec(trimmedValue);

  if (match === null) {
    return null;
  }

  return `#${match[1].toLowerCase()}${(match[2] ?? "ff").toLowerCase()}`;
}

function toUniquePaletteName(baseName: string): string {
  let candidate = baseName;
  let suffix = projectState.spritePalette.length;

  while (projectState.spritePalette.some((color) => color.name === candidate)) {
    suffix += 1;
    candidate = `${baseName} ${suffix}`;
  }

  return candidate;
}

function toUniquePaletteRgba(baseRgba: string): string {
  if (!projectState.spritePalette.some((color) => color.rgba === baseRgba)) {
    return baseRgba;
  }

  for (let value = 0; value <= 255; value += 1) {
    const channel = value.toString(16).padStart(2, "0");
    const candidate = `#${channel}${channel}${channel}ff`;

    if (!projectState.spritePalette.some((color) => color.rgba === candidate)) {
      return candidate;
    }
  }

  return baseRgba;
}

function emitProjectStateChanged(): void {
  for (const listener of projectStateListeners) {
    listener();
  }
}
