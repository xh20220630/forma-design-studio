import type { DesignNode } from '@forma/schema';

export const vectorTypes = new Set(['ellipse', 'line', 'polygon', 'star', 'path']);

export function shapePath(node: DesignNode, inset = 0): Path2D {
  const path = new Path2D();
  const width = Math.max(0, node.width), height = Math.max(0, node.height);
  if (node.type === 'ellipse') {
    path.ellipse(width / 2, height / 2, Math.max(0, width / 2 - inset), Math.max(0, height / 2 - inset), 0, 0, Math.PI * 2);
  } else if (node.type === 'line') {
    path.moveTo(node.points?.[0]?.x ?? 0, node.points?.[0]?.y ?? 0);
    path.lineTo(node.points?.[1]?.x ?? width, node.points?.[1]?.y ?? height);
  } else if (node.type === 'path' && node.path) {
    try { return new Path2D(node.path); } catch { return path; }
  } else if (node.type === 'path' || node.type === 'star' || node.type === 'polygon') {
    const sides = Math.max(3, Math.min(64, Math.round(node.polygonSides ?? (node.type === 'star' ? 5 : 3))));
    const count = node.type === 'star' ? sides * 2 : sides;
    const points = node.points?.length ? node.points : Array.from({ length: count }, (_, index) => {
      const angle = index * Math.PI * 2 / count - Math.PI / 2;
      const ratio = node.type === 'star' && index % 2 ? node.starRatio ?? 0.45 : 1;
      return { x: width / 2 + Math.cos(angle) * width / 2 * ratio, y: height / 2 + Math.sin(angle) * height / 2 * ratio };
    });
    points.forEach((point, index) => index ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y));
    if (node.type !== 'path' || node.closed) path.closePath();
  } else {
    path.roundRect(inset, inset, Math.max(0, width - inset * 2), Math.max(0, height - inset * 2), Math.max(0, (node.radius ?? 0) - inset));
  }
  return path;
}

export class PathCache {
  private paths = new WeakMap<DesignNode, Map<number, Path2D>>();
  private clips = new WeakMap<DesignNode, Path2D>();
  clip(node: DesignNode) {
    let path = this.clips.get(node);
    if (!path) { path = shapePath({ ...node, type: 'rectangle' }); this.clips.set(node, path); }
    return path;
  }
  get(node: DesignNode, inset = 0) {
    let variants = this.paths.get(node);
    if (!variants) { variants = new Map(); this.paths.set(node, variants); }
    let path = variants.get(inset);
    if (!path) { path = shapePath(node, inset); variants.set(inset, path); }
    return path;
  }
}
