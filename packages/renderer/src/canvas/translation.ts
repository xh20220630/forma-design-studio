import type { SpatialIndex, Bounds } from './geometry.ts';
import type { CanvasScene, SceneEntry } from './scene.ts';

export interface TranslationLayer {
  moving: boolean;
  background: boolean;
  index: Pick<SpatialIndex<SceneEntry>, 'query' | 'size'>;
}

/** 保持绘制顺序分层；依赖外部裁剪或混合背景的选区仍用正常场景更新。 */
export function translationLayers(
  scene: CanvasScene,
  ids: Set<string>,
): TranslationLayer[] | undefined {
  for (const entry of scene.entries) {
    if (entry.node.blendMode && !['normal', 'source-over'].includes(entry.node.blendMode)) return;
    if (!ids.has(entry.target.id)) continue;
    if (entry.clips.some((clip) => !ids.has(clip.node.id))) return;
    const parent = scene.nodes.get(entry.target.parentId ?? '');
    if (
      parent &&
      !ids.has(parent.target.id) &&
      parent.matrix.slice(0, 4).some((value, i) => Math.abs(value - [1, 0, 0, 1][i]) > 1e-8)
    )
      return;
  }
  const ranges: { moving: boolean; start: number; end: number }[] = [
    { moving: false, start: 0, end: 0 },
  ];
  for (const entry of scene.entries) {
    const moving = ids.has(entry.target.id);
    let layer = ranges[ranges.length - 1];
    if (layer.moving !== moving) {
      if (ranges.length >= 8) return;
      layer = { moving, start: entry.order, end: entry.order };
      ranges.push(layer);
    }
    layer.end = entry.order + 1;
  }
  // 分层共用场景索引，开始拖动时不复制整场景的空间桶。
  return ranges.map((range, i) => ({
    moving: range.moving,
    background: i === 0,
    index: {
      size: range.end - range.start,
      query: (bounds) =>
        range.end === range.start
          ? []
          : range.start === 0 && range.end === scene.entries.length
            ? scene.index.query(bounds)
            : scene.index
                .query(bounds)
                .filter((entry) => entry.order >= range.start && entry.order < range.end),
    },
  }));
}

export function selectionBounds(scene: CanvasScene, ids: string[]): Bounds | undefined {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const id of ids) {
    const entry = scene.nodes.get(id);
    if (!entry?.visible) continue;
    const bounds = entry.bounds;
    left = Math.min(left, bounds.x);
    top = Math.min(top, bounds.y);
    right = Math.max(right, bounds.x + bounds.width);
    bottom = Math.max(bottom, bounds.y + bounds.height);
  }
  if (!Number.isFinite(left)) return;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
