import type { DesignNode } from '@forma/schema';

/**
 * 计算节点集合的轴对齐包围盒，供对齐、编组和视图定位共用。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @returns 包围盒；空集合返回零尺寸区域。
 */
export function boundsOf(nodes: DesignNode[]) {
  if (!nodes.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...nodes.map((node) => node.x)),
    y = Math.min(...nodes.map((node) => node.y));
  return {
    x,
    y,
    width: Math.max(...nodes.map((node) => node.x + node.width)) - x,
    height: Math.max(...nodes.map((node) => node.y + node.height)) - y,
  };
}
