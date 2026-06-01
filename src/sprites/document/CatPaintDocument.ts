import type { Primitive } from "../primitives/Primitive.js";

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

export function createPrimitiveNode(command: SpriteCommand, index: number): PrimitiveNode {
  return {
    id: createNodeId("primitive"),
    type: "primitive",
    name: `Primitive ${index + 1}`,
    visible: true,
    locked: false,
    command: { ...command },
  };
}

export function createGroupNode(children: readonly SceneNode[], index: number): GroupNode {
  if (children.length === 0) {
    throw new Error("Group nodes must contain at least one child.");
  }

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
  return nodes.map(cloneNode);
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

export function getSceneNodeEntries(nodes: readonly SceneNode[]): SceneNodeEntry[] {
  return collectSceneNodeEntries(nodes, null, 0);
}

export function getSceneNodeById(nodes: readonly SceneNode[], nodeId: string): SceneNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    if (node.type === "group") {
      const child = getSceneNodeById(node.children, nodeId);

      if (child) {
        return child;
      }
    }
  }

  return null;
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

function cloneNode(node: SceneNode): SceneNode {
  if (node.type === "primitive") {
    return {
      ...node,
      command: { ...node.command },
    };
  }

  return {
    ...node,
    children: cloneNodes(node.children),
  };
}

function cloneNodeWithNewIds(node: SceneNode, offset: { x: number; y: number }): SceneNode {
  if (node.type === "primitive") {
    return {
      ...node,
      id: createNodeId("primitive"),
      command: {
        ...node.command,
        x: node.command.x + offset.x,
        y: node.command.y + offset.y,
      },
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

function collectEditablePrimitiveNodeEntries(
  nodes: readonly SceneNode[],
  isAncestorLocked: boolean,
): EditablePrimitiveNodeEntry[] {
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
