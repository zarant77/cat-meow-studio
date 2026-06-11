import type { Primitive } from "../primitives/Primitive.js";
import { getPathBounds, pathToShapePrimitives, translatePath } from "../primitives/pathPrimitive.js";

export type SpriteCommand = Primitive;

export type PrimitiveNode = {
  id: string;
  type: "primitive";
  name: string;
  visible: boolean;
  locked: boolean;
  command: SpriteCommand;
};

export type GroupNode = {
  id: string;
  type: "group";
  name: string;
  visible: boolean;
  locked: boolean;
  children: SceneNode[];
};

export type SceneNode = PrimitiveNode | GroupNode;

export type PrimitiveNodeEntry = {
  node: PrimitiveNode;
  command: SpriteCommand;
};

export type SceneNodeEntry = {
  node: SceneNode;
  parent: GroupNode | null;
  index: number;
  depth: number;
};

export type EditablePrimitiveNodeEntry = PrimitiveNodeEntry & {
  locked: boolean;
};

export type NodeBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function createPrimitiveNode(command: SpriteCommand, index: number): PrimitiveNode {
  return {
    id: createNodeId("primitive"),
    type: "primitive",
    name: `Primitive ${index + 1}`,
    visible: true,
    locked: false,
    command: clonePrimitive(command),
  };
}

export function createGroupNode(children: readonly SceneNode[], index: number): GroupNode {
  return {
    id: createNodeId("group"),
    type: "group",
    name: `Group ${index + 1}`,
    visible: true,
    locked: false,
    children: cloneNodes(children),
  };
}

export function createPrimitiveNodes(commands: readonly SpriteCommand[]): PrimitiveNode[] {
  return commands.map((command, index) => createPrimitiveNode(command, index));
}

export function cloneNodes(nodes: readonly SceneNode[]): SceneNode[] {
  return nodes.map(cloneNodeDeep);
}

export function cloneNodesWithNewIds(nodes: readonly SceneNode[], offset: { x: number; y: number }): SceneNode[] {
  return nodes.map((node) => cloneNodeWithNewIds(node, offset));
}

export function flattenNodes(nodes: readonly SceneNode[]): SpriteCommand[] {
  const commands: SpriteCommand[] = [];

  for (const node of nodes) {
    if (!node.visible) {
      continue;
    }

    if (node.type === "primitive") {
      commands.push(node.command);
      continue;
    }

    commands.push(...flattenNodes(node.children));
  }

  return commands;
}

export function flattenNodesForRuntime(nodes: readonly SceneNode[]): SpriteCommand[] {
  const commands: SpriteCommand[] = [];

  for (const node of nodes) {
    if (!node.visible) {
      continue;
    }

    if (node.type === "primitive") {
      commands.push(...primitiveToRuntimeCommands(node.command));
      continue;
    }

    commands.push(...flattenNodesForRuntime(node.children));
  }

  return commands;
}

export function getSceneNodeEntries(nodes: readonly SceneNode[]): SceneNodeEntry[] {
  return collectSceneNodeEntries(nodes, null, 0);
}

export function getSceneNodeById(nodes: readonly SceneNode[], nodeId: string): SceneNode | null {
  return findNodeById(nodes, nodeId);
}

export function findNodeById(nodes: readonly SceneNode[], nodeId: string): SceneNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    if (node.type === "group") {
      const child = findNodeById(node.children, nodeId);

      if (child) {
        return child;
      }
    }
  }

  return null;
}

export function removeNodeById(nodes: readonly SceneNode[], nodeId: string): SceneNode[] {
  const result: SceneNode[] = [];

  for (const node of nodes) {
    if (node.id === nodeId) {
      continue;
    }

    if (node.type === "primitive") {
      result.push(node);
      continue;
    }

    result.push({
      ...node,
      children: removeNodeById(node.children, nodeId),
    });
  }

  return result;
}

export function insertNodeIntoGroup(nodes: readonly SceneNode[], groupId: string | null, insertedNode: SceneNode): SceneNode[] {
  if (groupId === null) {
    return [...nodes, insertedNode];
  }

  if (insertedNode.id === groupId || collectGroupIds(insertedNode).includes(groupId)) {
    return [...nodes];
  }

  return nodes.map((node) => {
    if (node.type === "primitive") {
      return node;
    }

    if (node.id === groupId) {
      return {
        ...node,
        children: [...node.children, insertedNode],
      };
    }

    return {
      ...node,
      children: insertNodeIntoGroup(node.children, groupId, insertedNode),
    };
  });
}

export function getParentGroup(nodes: readonly SceneNode[], nodeId: string): GroupNode | null {
  return getParentGroupFromNodes(nodes, nodeId, null);
}

export function getPrimitiveNodeEntries(nodes: readonly SceneNode[]): PrimitiveNodeEntry[] {
  const entries: PrimitiveNodeEntry[] = [];

  for (const node of nodes) {
    if (node.type === "primitive") {
      entries.push({ node, command: node.command });
    } else {
      entries.push(...getPrimitiveNodeEntries(node.children));
    }
  }

  return entries;
}

export function getEditablePrimitiveNodeEntries(nodes: readonly SceneNode[]): EditablePrimitiveNodeEntry[] {
  return collectEditablePrimitiveNodeEntries(nodes, false);
}

export function getPrimitiveCommandsForNode(node: SceneNode): SpriteCommand[] {
  if (node.type === "primitive") {
    return [node.command];
  }

  return getPrimitiveNodeEntries(node.children).map((entry) => entry.command);
}

export function collectPrimitiveIds(node: SceneNode): string[] {
  if (node.type === "primitive") {
    return [node.id];
  }

  return node.children.flatMap(collectPrimitiveIds);
}

export function calculateNodeBounds(node: SceneNode): NodeBounds | null {
  const primitives = getPrimitiveCommandsForNode(node);

  if (primitives.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const primitive of primitives) {
    if (primitive.kind === "path") {
      const bounds = getPathBounds(primitive);

      if (bounds) {
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
      }

      continue;
    }

    const height = primitive.kind === "circle" && primitive.h <= 0 ? primitive.w : primitive.h;

    minX = Math.min(minX, primitive.x - primitive.w / 2);
    minY = Math.min(minY, primitive.y - height / 2);
    maxX = Math.max(maxX, primitive.x + primitive.w / 2);
    maxY = Math.max(maxY, primitive.y + height / 2);
  }

  return { minX, minY, maxX, maxY };
}

export function getVisiblePrimitiveNodeEntries(nodes: readonly SceneNode[]): PrimitiveNodeEntry[] {
  const entries: PrimitiveNodeEntry[] = [];

  for (const node of nodes) {
    if (!node.visible) {
      continue;
    }

    if (node.type === "primitive") {
      entries.push({ node, command: node.command });
    } else {
      entries.push(...getVisiblePrimitiveNodeEntries(node.children));
    }
  }

  return entries;
}

export function cloneNodeDeep(node: SceneNode): SceneNode {
  if (node.type === "primitive") {
    return {
      ...node,
      command: clonePrimitive(node.command),
    };
  }

  return {
    ...node,
    children: cloneNodes(node.children),
  };
}

function getParentGroupFromNodes(nodes: readonly SceneNode[], nodeId: string, parent: GroupNode | null): GroupNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return parent;
    }

    if (node.type === "group") {
      const childParent = getParentGroupFromNodes(node.children, nodeId, node);

      if (childParent !== null) {
        return childParent;
      }
    }
  }

  return null;
}

function collectGroupIds(node: SceneNode): string[] {
  if (node.type === "primitive") {
    return [];
  }

  return [node.id, ...node.children.flatMap(collectGroupIds)];
}

function cloneNodeWithNewIds(node: SceneNode, offset: { x: number; y: number }): SceneNode {
  if (node.type === "primitive") {
    const command = clonePrimitive(node.command);

    if (command.kind === "path") {
      translatePath(command, offset.x, offset.y);
    } else {
      command.x += offset.x;
      command.y += offset.y;
    }

    return {
      ...node,
      id: createNodeId("primitive"),
      command,
    };
  }

  return {
    ...node,
    id: createNodeId("group"),
    children: cloneNodesWithNewIds(node.children, offset),
  };
}

function collectSceneNodeEntries(nodes: readonly SceneNode[], parent: GroupNode | null, depth: number): SceneNodeEntry[] {
  const entries: SceneNodeEntry[] = [];

  nodes.forEach((node, index) => {
    entries.push({ node, parent, index, depth });

    if (node.type === "group") {
      entries.push(...collectSceneNodeEntries(node.children, node, depth + 1));
    }
  });

  return entries;
}

function collectEditablePrimitiveNodeEntries(nodes: readonly SceneNode[], isAncestorLocked: boolean): EditablePrimitiveNodeEntry[] {
  const entries: EditablePrimitiveNodeEntry[] = [];

  for (const node of nodes) {
    if (!node.visible) {
      continue;
    }

    const locked = isAncestorLocked || node.locked;

    if (node.type === "primitive") {
      entries.push({ node, command: node.command, locked });
    } else {
      entries.push(...collectEditablePrimitiveNodeEntries(node.children, locked));
    }
  }

  return entries;
}

function createNodeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clonePrimitive(primitive: Primitive): Primitive {
  if (primitive.kind === "path") {
    return {
      ...primitive,
      points: primitive.points.map((point) => [...point]),
    };
  }

  return { ...primitive };
}

function primitiveToRuntimeCommands(primitive: Primitive): Primitive[] {
  return primitive.kind === "path" ? pathToShapePrimitives(primitive) : [primitive];
}
