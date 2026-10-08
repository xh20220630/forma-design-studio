import type { DesignNode } from '@forma/schema';

export const containers = new Set(['frame', 'group', 'section']);

const indexes = new WeakMap<
  DesignNode[],
  { byId: Map<string, DesignNode>; children: Map<string, string[]> }
>();

/** 节点数组按不可变值使用；索引随数组生命周期释放。 */
export function nodeIndex(nodes: DesignNode[]) {
  let index = indexes.get(nodes);
  if (!index) {
    const byId = new Map<string, DesignNode>();
    const children = new Map<string, string[]>();
    for (const node of nodes) {
      byId.set(node.id, node);
      if (node.parentId) {
        const siblings = children.get(node.parentId);
        if (siblings) siblings.push(node.id);
        else children.set(node.parentId, [node.id]);
      }
    }
    index = { byId, children };
    indexes.set(nodes, index);
  }
  return index;
}

/**
 * 沿父子关系收集完整子树，保证移动、删除和复制包含所有后代。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param initial - 初始值。
 * @returns 包含初始节点及所有后代的去重 ID 列表。
 */
export const descendants = (nodes: DesignNode[], initial: string[]) => {
  const ids = new Set(initial);
  const { children } = nodeIndex(nodes);
  const queue = [...ids];
  for (let i = 0; i < queue.length; i++) {
    for (const id of children.get(queue[i]) ?? [])
      if (!ids.has(id)) {
        ids.add(id);
        queue.push(id);
      }
  }
  return [...ids];
};

/**
 * 剔除祖先已被选中的节点，防止同一子树被重复移动或缩放。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param ids - 参与当前操作的对象标识集合。
 * @returns 只保留选区根节点的 ID 列表。
 */
export const rootSelection = (nodes: DesignNode[], ids: string[]) => {
  const { byId } = nodeIndex(nodes);
  const selected = new Set(ids);
  const ancestors = new Map<string, boolean>();
  return ids.filter((id) => {
    let node = byId.get(id);
    const visited = new Set<string>();
    let covered = false;
    while (node?.parentId && !visited.has(node.parentId)) {
      if (selected.has(node.parentId)) {
        covered = true;
        break;
      }
      const known = ancestors.get(node.parentId);
      if (known !== undefined) {
        covered = known;
        break;
      }
      visited.add(node.parentId);
      node = byId.get(node.parentId);
    }
    for (const parent of visited) ancestors.set(parent, covered);
    return !covered;
  });
};

/**
 * 沿祖先链检查可见性，使隐藏父容器下的节点也保持隐藏。
 *
 * @param node - 当前处理的设计节点。
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @returns 节点及祖先是否都可见。
 */
export function visibleNode(node: DesignNode, nodes: DesignNode[]) {
  const visited = new Set<string>();
  let current: DesignNode | undefined = node;
  while (current && !visited.has(current.id)) {
    if (current.visible === false) return false;
    visited.add(current.id);
    current = nodeIndex(nodes).byId.get(current.parentId ?? '');
  }
  return true;
}
