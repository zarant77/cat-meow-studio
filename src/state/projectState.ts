import type { AssetId, AssetKind, Project, ProjectAsset } from "../model/assets.js";
import type { SceneNode } from "../sprites/document/CatPaintDocument.js";

export type SelectedAssetIds = Record<AssetKind, AssetId | null>;

type ProjectStateListener = () => void;

const initialProject: Project = {
  id: "cat-meow-studio",
  name: "Cat Meow Studio",
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

function cloneProject(project: Project): Project {
  return {
    ...project,
    assets: project.assets.map(cloneProjectAsset),
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

function emitProjectStateChanged(): void {
  for (const listener of projectStateListeners) {
    listener();
  }
}
