import type { DesignNode } from '@forma/schema';

export const vectorTypes = new Set(['ellipse', 'line', 'polygon', 'star', 'path']);

/**
 * 将节点的图形参数转换为 Canvas 路径，供绘制和精确命中检测共用。
 *
 * @param node - 当前处理的设计节点。
 * @param inset - 是否将阴影绘制在图形内部。
 * @returns 对应节点形状的 Path2D。
 */
export function shapePath(node: DesignNode, inset = 0): Path2D {
  const path = new Path2D();
  const width = Math.max(0, node.width),
    height = Math.max(0, node.height);
  if (node.type === 'ellipse') {
    path.ellipse(
      width / 2,
      height / 2,
      Math.max(0, width / 2 - inset),
      Math.max(0, height / 2 - inset),
      0,
      0,
      Math.PI * 2,
    );
  } else if (node.type === 'line') {
    path.moveTo(node.points?.[0]?.x ?? 0, node.points?.[0]?.y ?? 0);
    path.lineTo(node.points?.[1]?.x ?? width, node.points?.[1]?.y ?? height);
  } else if (node.type === 'path' && node.path) {
    try {
      return new Path2D(node.path);
    } catch {
      return path;
    }
  } else if (node.type === 'path' || node.type === 'star' || node.type === 'polygon') {
    const sides = Math.max(
      3,
      Math.min(64, Math.round(node.polygonSides ?? (node.type === 'star' ? 5 : 3))),
    );
    const count = node.type === 'star' ? sides * 2 : sides;
    const points = node.points?.length
      ? node.points
      : Array.from(
          { length: count },
          /**
           * 执行 shapePath 传入的局部处理步骤，使调用处能够控制结果如何更新。
           *
           * @param _ - 当前步骤不使用的占位参数。
           * @param index - 空间查询索引或当前条目的位置。
           * @returns 当前步骤的处理结果。
           */
          (_, index) => {
            const angle = (index * Math.PI * 2) / count - Math.PI / 2;
            const ratio = node.type === 'star' && index % 2 ? (node.starRatio ?? 0.45) : 1;
            return {
              x: width / 2 + ((Math.cos(angle) * width) / 2) * ratio,
              y: height / 2 + ((Math.sin(angle) * height) / 2) * ratio,
            };
          },
        );
    points.forEach(
      /** 逐项处理 shapePath 中的内容，把结果写入外层维护的集合或绘制上下文。 @param point - 当前处理的坐标点。 @param index - 空间查询索引或当前条目的位置。 @returns 无返回值；当前项的处理通过副作用完成。 */
      (point, index) => (index ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y)),
    );
    if (node.type !== 'path' || node.closed) path.closePath();
  } else {
    path.roundRect(
      inset,
      inset,
      Math.max(0, width - inset * 2),
      Math.max(0, height - inset * 2),
      Math.max(0, (node.radius ?? 0) - inset),
    );
  }
  return path;
}

/** 按节点复用 Path2D，使绘图与命中检测使用相同路径。 */
export class PathCache {
  /** 按节点复用的绘制和裁剪路径。 */
  private paths = new WeakMap<DesignNode, Map<number, Path2D>>();
  /** 从祖先继承的裁剪区域序列。 */
  private clips = new WeakMap<DesignNode, Path2D>();
  /**
   * 缓存节点的裁剪路径，避免每次绘制或命中检测都重新构造。
   *
   * @param node - 当前处理的设计节点。
   * @returns 用于裁剪的 Path2D。
   */
  clip(node: DesignNode) {
    let path = this.clips.get(node);
    if (!path) {
      path = shapePath({ ...node, type: 'rectangle' });
      this.clips.set(node, path);
    }
    return path;
  }
  /**
   * 按节点身份复用图形路径，让绘制与命中检测无需反复构造 Path2D。
   *
   * @param node - 当前处理的设计节点。
   * @param inset - 是否将阴影绘制在图形内部。
   * @returns 对应节点的缓存路径。
   */
  get(node: DesignNode, inset = 0) {
    let variants = this.paths.get(node);
    if (!variants) {
      variants = new Map();
      this.paths.set(node, variants);
    }
    let path = variants.get(inset);
    if (!path) {
      path = shapePath(node, inset);
      variants.set(inset, path);
    }
    return path;
  }
}
