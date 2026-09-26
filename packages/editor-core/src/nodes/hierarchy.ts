import type { DesignNode } from '@forma/schema';

export const containers = new Set(['frame', 'group', 'section']);

/**
 * 沿父子关系收集完整子树，保证移动、删除和复制包含所有后代。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param initial - 初始值。
 * @returns 包含初始节点及所有后代的去重 ID 列表。
 */
export const descendants = (nodes: DesignNode[], initial: string[]) => {
  const ids = new Set(initial);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes)
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
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
export const rootSelection = (nodes: DesignNode[], ids: string[]) =>
  ids.filter((id) => {
    let node = nodes.find((item) => item.id === id);
    const visited = new Set<string>();
    while (node?.parentId && !visited.has(node.parentId)) {
      if (ids.includes(node.parentId)) return false;
      visited.add(node.parentId);
      node = nodes.find((item) => item.id === node!.parentId);
    }
    return true;
  });

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
    current = nodes.find((item) => item.id === current!.parentId);
  }
  return true;
}
