import type { DesignNode, ThemeTokens } from '../types';

export const uid = (): string => crypto.randomUUID();
export const containers = new Set(['frame', 'group', 'section']);
export const descendants = (nodes: DesignNode[], initial: string[]) => {
  const ids = new Set(initial);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) { ids.add(node.id); changed = true; }
  }
  return [...ids];
};
export const rootSelection = (nodes: DesignNode[], ids: string[]) => ids.filter(id => {
  let node = nodes.find(item => item.id === id);
  const visited = new Set<string>();
  while (node?.parentId && !visited.has(node.parentId)) {
    if (ids.includes(node.parentId)) return false;
    visited.add(node.parentId);
    node = nodes.find(item => item.id === node!.parentId);
  }
  return true;
});
export function boundsOf(nodes: DesignNode[]) {
  if (!nodes.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...nodes.map(node => node.x)), y = Math.min(...nodes.map(node => node.y));
  return { x, y, width: Math.max(...nodes.map(node => node.x + node.width)) - x, height: Math.max(...nodes.map(node => node.y + node.height)) - y };
}
export function visibleNode(node: DesignNode, nodes: DesignNode[]) {
  const visited = new Set<string>();
  let current: DesignNode | undefined = node;
  while (current && !visited.has(current.id)) {
    if (current.visible === false) return false;
    visited.add(current.id);
    current = nodes.find(item => item.id === current!.parentId);
  }
  return true;
}
export function moveNodes(nodes: DesignNode[], ids: string[], dx: number, dy: number) {
  const all = new Set(descendants(nodes, ids));
  return nodes.map(node => all.has(node.id) ? { ...node, x: Math.round(node.x + dx), y: Math.round(node.y + dy) } : node);
}
export function scalePath(path: string, sx: number, sy: number): string {
  if (sx === 1 && sy === 1 || !Number.isFinite(sx) || !Number.isFinite(sy)) return path;
  if (!/^[MmLlHhVvCcSsQqTtAaZzEe0-9+.,\s-]+$/.test(path)) return path;
  const tokens = path.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const arity: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  const output: string[] = [];
  let command = '', index = 0;
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    const upper = command.toUpperCase();
    if (upper === 'Z') { output.push(command); command = ''; continue; }
    const count = arity[upper];
    if (!count || index + count > tokens.length) return path;
    const values = tokens.slice(index, index + count).map(Number);
    if (!values.every(Number.isFinite)) return path;
    index += count;
    if (upper === 'H') values[0] *= sx;
    else if (upper === 'V') values[0] *= sy;
    else if (upper === 'A') {
      const [rx, ry, degrees] = values, angle = degrees * Math.PI / 180;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      // Nonuniform scaling changes a rotated ellipse's principal axes.
      const a = sx * sx * (rx * rx * cos * cos + ry * ry * sin * sin);
      const b = sx * sy * cos * sin * (rx * rx - ry * ry);
      const d = sy * sy * (rx * rx * sin * sin + ry * ry * cos * cos);
      const delta = Math.hypot(a - d, 2 * b);
      values[0] = Math.sqrt(Math.max(0, (a + d + delta) / 2));
      values[1] = Math.sqrt(Math.max(0, (a + d - delta) / 2));
      values[2] = Math.atan2(2 * b, a - d) * 90 / Math.PI;
      if (sx * sy < 0) values[4] = values[4] ? 0 : 1;
      values[5] *= sx; values[6] *= sy;
    } else for (let coordinate = 0; coordinate < values.length; coordinate++) values[coordinate] *= coordinate % 2 ? sy : sx;
    output.push(command, ...values.map(value => String(Number(value.toFixed(8)))));
    if (upper === 'M') command = command === 'm' ? 'l' : 'L';
  }
  return output.join(' ');
}
export function resizeNodes(nodes: DesignNode[], id: string, patch: Partial<DesignNode>, layoutPrepared = false) {
  const original = nodes.find(node => node.id === id);
  if (!original) return nodes;
  const next = { ...original, ...patch };
  const sx = original.width ? next.width / original.width : 1, sy = original.height ? next.height / original.height : 1;
  if (sx !== 1 || sy !== 1) {
    if (original.points && patch.points === undefined) next.points = original.points.map(point => ({ x: point.x * sx, y: point.y * sy }));
    if (original.path && patch.path === undefined) next.path = scalePath(original.path, sx, sy);
  }
  let result = nodes.map(node => node.id === id ? next : node);
  const dx = next.x - original.x, dy = next.y - original.y;
  const dw = next.width - original.width, dh = next.height - original.height;
  for (const child of nodes.filter(node => node.parentId === id && (!next.layout || next.layout === 'none' || node.visible === false))) {
    const c = child.constraints ?? (original.type === 'group' ? { horizontal: 'scale', vertical: 'scale' } : { horizontal: 'left', vertical: 'top' });
    const relativeX = child.x - original.x, relativeY = child.y - original.y;
    let x = child.x + dx, y = child.y + dy, width = child.width, height = child.height;
    if (c.horizontal === 'right') x += dw;
    if (c.horizontal === 'center') x += dw / 2;
    if (c.horizontal === 'left-right') width = Math.max(1, width + dw);
    if (c.horizontal === 'scale') { x = next.x + relativeX * sx; width *= sx; }
    if (c.vertical === 'bottom') y += dh;
    if (c.vertical === 'center') y += dh / 2;
    if (c.vertical === 'top-bottom') height = Math.max(1, height + dh);
    if (c.vertical === 'scale') { y = next.y + relativeY * sy; height *= sy; }
    result = resizeNodes(result, child.id, { x, y, width, height }, layoutPrepared);
  }
  return layoutNodes(result, id, !layoutPrepared);
}
export function applyAutoLayout(nodes: DesignNode[], frameId: string): DesignNode[] {
  return layoutNodes(nodes, frameId, true);
}
function layoutNodes(nodes: DesignNode[], frameId: string, measureChildren: boolean): DesignNode[] {
  const frame = nodes.find(node => node.id === frameId);
  if (!frame?.layout || frame.layout === 'none') return nodes;
  let result = nodes;
  if (measureChildren) for (const child of nodes.filter(node => node.parentId === frame.id && node.visible !== false && node.layout && node.layout !== 'none')) result = layoutNodes(result, child.id, true);
  const children = result.filter(node => node.parentId === frame.id && node.visible !== false);
  const px = frame.paddingX ?? frame.padding ?? 16, py = frame.paddingY ?? frame.padding ?? 16, gap = frame.gap ?? 16;
  const horizontal = frame.layout !== 'vertical';
  const mainSize = horizontal ? 'width' : 'height', crossSize = horizontal ? 'height' : 'width';
  const mainSizing = horizontal ? 'sizingHorizontal' : 'sizingVertical', crossSizing = horizontal ? 'sizingVertical' : 'sizingHorizontal';
  const mainHug = frame[mainSizing] === 'hug', crossHug = frame[crossSizing] === 'hug';
  const available = Math.max(0, frame[mainSize] - (horizontal ? px : py) * 2);
  const lines: DesignNode[][] = [[]];
  let lineWidth = 0;
  for (const child of children) {
    const line = lines[lines.length - 1];
    if (frame.layout === 'wrap' && !mainHug && line.length && lineWidth + gap + child.width > available) { lines.push([child]); lineWidth = child.width; }
    else { line.push(child); lineWidth += child[mainSize] + (line.length > 1 ? gap : 0); }
  }
  let rowY = 0;
  for (const line of lines) {
    const fillChildren = mainHug ? [] : line.filter(child => child[mainSizing] === 'fill');
    const fixed = line.reduce((sum, child) => sum + (fillChildren.includes(child) ? 0 : child[mainSize]), 0);
    const fillSize = fillChildren.length ? Math.max(1, (available - fixed - gap * Math.max(0, line.length - 1)) / fillChildren.length) : 0;
    const occupied = fixed + fillSize * fillChildren.length;
    const target = mainHug ? occupied + gap * Math.max(0, line.length - 1) : available;
    const distributedGap = frame.justifyContent === 'space-between' && line.length > 1 ? Math.max(gap, (target - occupied) / (line.length - 1)) : gap;
    const used = occupied + distributedGap * Math.max(0, line.length - 1);
    let cursor = frame.justifyContent === 'center' ? Math.max(0, (target - used) / 2) : frame.justifyContent === 'end' ? Math.max(0, target - used) : 0;
    const naturalCross = Math.max(0, ...line.map(child => child[crossSize]));
    const crossAvailable = crossHug || frame.layout === 'wrap' ? naturalCross : Math.max(0, frame[crossSize] - (horizontal ? py : px) * 2);
    for (const child of line) {
      const main = fillChildren.includes(child) ? fillSize : child[mainSize];
      const cross = !crossHug && (frame.alignItems === 'stretch' || child[crossSizing] === 'fill') ? Math.max(1, crossAvailable) : child[crossSize];
      const crossOffset = frame.alignItems === 'center' ? Math.max(0, (crossAvailable - cross) / 2) : frame.alignItems === 'end' ? Math.max(0, crossAvailable - cross) : 0;
      const x = frame.x + px + (horizontal ? cursor : crossOffset);
      const y = frame.y + py + (horizontal ? rowY + crossOffset : cursor);
      result = resizeNodes(result, child.id, { x, y, width: horizontal ? main : cross, height: horizontal ? cross : main }, true);
      cursor += main + distributedGap;
    }
    rowY += crossAvailable + gap;
  }
  if (frame.sizingHorizontal === 'hug' || frame.sizingVertical === 'hug') {
    const bounds = boundsOf(result.filter(node => node.parentId === frame.id && node.visible !== false));
    result = result.map(node => node.id === frame.id ? { ...node, width: frame.sizingHorizontal === 'hug' ? bounds.width + px * 2 : node.width, height: frame.sizingVertical === 'hug' ? bounds.height + py * 2 : node.height } : node);
  }
  return result;
}
export function cloneNodes(nodes: DesignNode[], ids: string[], offset = 24) {
  const included = new Set(descendants(nodes, ids));
  const idMap = new Map([...included].map(id => [id, uid()]));
  return { nodes: nodes.filter(node => included.has(node.id)).map(node => ({ ...structuredClone(node), id: idMap.get(node.id)!, x: node.x + offset, y: node.y + offset, name: `${node.name} 副本`, parentId: node.parentId ? idMap.get(node.parentId) ?? node.parentId : undefined })), ids: ids.map(id => idMap.get(id)!).filter(Boolean) };
}
export function nodeCss(node: DesignNode, tokens: ThemeTokens) {
  const value = (key: string, fallback: string) => node.tokenBindings?.[key] ? `var(--forma-${node.tokenBindings[key]})` : fallback;
  return [`position: absolute;`, `left: ${node.x}px;`, `top: ${node.y}px;`, `width: ${node.width}px;`, `height: ${node.height}px;`, `background: ${value('fill', node.fill ?? 'transparent')};`, `color: ${value('color', node.color ?? tokens.text)};`, `border-radius: ${value('radius', `${node.radius ?? 0}px`)};`, node.stroke ? `border: ${node.strokeWidth ?? 1}px solid ${node.stroke};` : '', node.rotation ? `transform: rotate(${node.rotation}deg);` : '', node.fontSize ? `font: ${node.fontWeight ?? 400} ${node.fontSize}px/${node.lineHeight ?? 1.4} ${node.fontFamily ?? tokens.fontFamily};` : '', node.layout && node.layout !== 'none' ? `display: flex;\nflex-direction: ${node.layout === 'vertical' ? 'column' : 'row'};\ngap: ${node.gap ?? 16}px;\npadding: ${node.padding ?? 16}px;` : ''].filter(Boolean).join('\n');
}
