import type { DesignNode } from '@forma/schema';
import { uid } from './identity.ts';
import { descendants } from './hierarchy.ts';

/**
 * 同时平移目标节点及其后代，保持容器内部的相对位置。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param ids - 参与当前操作的对象标识集合。
 * @param dx - 水平方向的位移。
 * @param dy - 垂直方向的位移。
 * @returns 坐标已更新的节点数组。
 */
export function moveNodes(nodes: DesignNode[], ids: string[], dx: number, dy: number) {
  const all = new Set(descendants(nodes, ids));
  return nodes.map((node) =>
    all.has(node.id) ? { ...node, x: node.x + Math.round(dx), y: node.y + Math.round(dy) } : node,
  );
}

/**
 * 复制完整子树并重建内部 ID 引用，确保副本可以独立编辑。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param ids - 参与当前操作的对象标识集合。
 * @param offset - 相对起点的偏移量。
 * @returns 复制的节点及新选区 ID。
 */
export function cloneNodes(nodes: DesignNode[], ids: string[], offset = 24) {
  const included = new Set(descendants(nodes, ids));
  const idMap = new Map([...included].map((id) => [id, uid()]));
  return {
    nodes: nodes
      .filter((node) => included.has(node.id))
      .map((node) => ({
        ...structuredClone(node),
        id: idMap.get(node.id)!,
        x: node.x + offset,
        y: node.y + offset,
        name: `${node.name} 副本`,
        parentId: node.parentId ? (idMap.get(node.parentId) ?? node.parentId) : undefined,
      })),
    ids: ids.map((id) => idMap.get(id)!).filter(Boolean),
  };
}
