import type { DesignNode } from '@forma/schema';
import { boundsOf } from '../geometry/bounds.ts';
import { scalePath } from '../geometry/path.ts';

/**
 * 更新节点尺寸并按约束调整后代，再衔接自动布局以保持层级一致。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @param patch - 仅包含本次要修改字段的局部更新。
 * @param layoutPrepared - 子布局是否已经测量，避免递归中重复计算。
 * @returns 完成尺寸和布局联动的节点数组。
 */
export function resizeNodes(
  nodes: DesignNode[],
  id: string,
  patch: Partial<DesignNode>,
  layoutPrepared = false,
) {
  const original = nodes.find((node) => node.id === id);
  if (!original) return nodes;
  const next = { ...original, ...patch };
  const sx = original.width ? next.width / original.width : 1,
    sy = original.height ? next.height / original.height : 1;
  if (sx !== 1 || sy !== 1) {
    if (original.points && patch.points === undefined)
      next.points = original.points.map((point) => ({ x: point.x * sx, y: point.y * sy }));
    if (original.path && patch.path === undefined) next.path = scalePath(original.path, sx, sy);
  }
  let result = nodes.map((node) => (node.id === id ? next : node));
  const dx = next.x - original.x,
    dy = next.y - original.y;
  const dw = next.width - original.width,
    dh = next.height - original.height;
  for (const child of nodes.filter(
    (node) =>
      node.parentId === id && (!next.layout || next.layout === 'none' || node.visible === false),
  )) {
    const c =
      child.constraints ??
      (original.type === 'group'
        ? { horizontal: 'scale', vertical: 'scale' }
        : { horizontal: 'left', vertical: 'top' });
    const relativeX = child.x - original.x,
      relativeY = child.y - original.y;
    let x = child.x + dx,
      y = child.y + dy,
      width = child.width,
      height = child.height;
    if (c.horizontal === 'right') x += dw;
    if (c.horizontal === 'center') x += dw / 2;
    if (c.horizontal === 'left-right') width = Math.max(1, width + dw);
    if (c.horizontal === 'scale') {
      x = next.x + relativeX * sx;
      width *= sx;
    }
    if (c.vertical === 'bottom') y += dh;
    if (c.vertical === 'center') y += dh / 2;
    if (c.vertical === 'top-bottom') height = Math.max(1, height + dh);
    if (c.vertical === 'scale') {
      y = next.y + relativeY * sy;
      height *= sy;
    }
    result = resizeNodes(result, child.id, { x, y, width, height }, layoutPrepared);
  }
  return layoutNodes(result, id, !layoutPrepared);
}

/**
 * 从指定容器开始重新计算自动布局，让属性修改及时反映到子节点位置。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param frameId - 目标自动布局容器的标识。
 * @returns 完成自动布局的节点数组。
 */
export function applyAutoLayout(nodes: DesignNode[], frameId: string): DesignNode[] {
  return layoutNodes(nodes, frameId, true);
}

/**
 * 先测量子容器，再分配主轴空间和交叉轴尺寸，避免嵌套布局重复计算。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param frameId - 目标自动布局容器的标识。
 * @param measureChildren - 是否先测量子容器尺寸。
 * @returns 重新排列并按需调整容器尺寸后的节点数组。
 */
export function layoutNodes(
  nodes: DesignNode[],
  frameId: string,
  measureChildren: boolean,
): DesignNode[] {
  const frame = nodes.find((node) => node.id === frameId);
  if (!frame?.layout || frame.layout === 'none') return nodes;
  let result = nodes;
  if (measureChildren)
    for (const child of nodes.filter(
      (node) =>
        node.parentId === frame.id &&
        node.visible !== false &&
        node.layout &&
        node.layout !== 'none',
    ))
      result = layoutNodes(result, child.id, true);
  const children = result.filter((node) => node.parentId === frame.id && node.visible !== false);
  const px = frame.paddingX ?? frame.padding ?? 16,
    py = frame.paddingY ?? frame.padding ?? 16,
    gap = frame.gap ?? 16;
  const horizontal = frame.layout !== 'vertical';
  const mainSize = horizontal ? 'width' : 'height',
    crossSize = horizontal ? 'height' : 'width';
  const mainSizing = horizontal ? 'sizingHorizontal' : 'sizingVertical',
    crossSizing = horizontal ? 'sizingVertical' : 'sizingHorizontal';
  const mainHug = frame[mainSizing] === 'hug',
    crossHug = frame[crossSizing] === 'hug';
  const available = Math.max(0, frame[mainSize] - (horizontal ? px : py) * 2);
  const lines: DesignNode[][] = [[]];
  let lineWidth = 0;
  for (const child of children) {
    const line = lines[lines.length - 1];
    if (
      frame.layout === 'wrap' &&
      !mainHug &&
      line.length &&
      lineWidth + gap + child.width > available
    ) {
      lines.push([child]);
      lineWidth = child.width;
    } else {
      line.push(child);
      lineWidth += child[mainSize] + (line.length > 1 ? gap : 0);
    }
  }
  let rowY = 0;
  for (const line of lines) {
    const fillChildren = mainHug ? [] : line.filter((child) => child[mainSizing] === 'fill');
    const fixed = line.reduce(
      (sum, child) => sum + (fillChildren.includes(child) ? 0 : child[mainSize]),
      0,
    );
    const fillSize = fillChildren.length
      ? Math.max(1, (available - fixed - gap * Math.max(0, line.length - 1)) / fillChildren.length)
      : 0;
    const occupied = fixed + fillSize * fillChildren.length;
    const target = mainHug ? occupied + gap * Math.max(0, line.length - 1) : available;
    const distributedGap =
      frame.justifyContent === 'space-between' && line.length > 1
        ? Math.max(gap, (target - occupied) / (line.length - 1))
        : gap;
    const used = occupied + distributedGap * Math.max(0, line.length - 1);
    let cursor =
      frame.justifyContent === 'center'
        ? Math.max(0, (target - used) / 2)
        : frame.justifyContent === 'end'
          ? Math.max(0, target - used)
          : 0;
    const naturalCross = Math.max(0, ...line.map((child) => child[crossSize]));
    const crossAvailable =
      crossHug || frame.layout === 'wrap'
        ? naturalCross
        : Math.max(0, frame[crossSize] - (horizontal ? py : px) * 2);
    for (const child of line) {
      const main = fillChildren.includes(child) ? fillSize : child[mainSize];
      const cross =
        !crossHug && (frame.alignItems === 'stretch' || child[crossSizing] === 'fill')
          ? Math.max(1, crossAvailable)
          : child[crossSize];
      const crossOffset =
        frame.alignItems === 'center'
          ? Math.max(0, (crossAvailable - cross) / 2)
          : frame.alignItems === 'end'
            ? Math.max(0, crossAvailable - cross)
            : 0;
      const x = frame.x + px + (horizontal ? cursor : crossOffset);
      const y = frame.y + py + (horizontal ? rowY + crossOffset : cursor);
      result = resizeNodes(
        result,
        child.id,
        { x, y, width: horizontal ? main : cross, height: horizontal ? cross : main },
        true,
      );
      cursor += main + distributedGap;
    }
    rowY += crossAvailable + gap;
  }
  if (frame.sizingHorizontal === 'hug' || frame.sizingVertical === 'hug') {
    const bounds = boundsOf(
      result.filter((node) => node.parentId === frame.id && node.visible !== false),
    );
    result = result.map((node) =>
      node.id === frame.id
        ? {
            ...node,
            width: frame.sizingHorizontal === 'hug' ? bounds.width + px * 2 : node.width,
            height: frame.sizingVertical === 'hug' ? bounds.height + py * 2 : node.height,
          }
        : node,
    );
  }
  return result;
}
