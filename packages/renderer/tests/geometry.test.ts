import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inverse,
  multiply,
  nodeMatrix,
  SpatialIndex,
  transform,
  transformedBounds,
} from '../src/canvas/geometry.ts';

/**
 * 验证nested rotations and flips round-trip between screen and local coordinates。
 * @returns 完成当前检查或生命周期操作。
 */
test('nested rotations and flips round-trip between screen and local coordinates', () => {
  const parent = nodeMatrix({ x: 100, y: 200, width: 300, height: 200, rotation: 35, flipX: true });
  const child = nodeMatrix({ x: 130, y: 230, width: 40, height: 60, rotation: -15, flipY: true });
  const world = multiply(multiply(parent, [1, 0, 0, 1, -100, -200]), child);
  const point = { x: 17, y: 29 };
  const local = transform(inverse(world)!, transform(world, point));
  assert.ok(Math.abs(local.x - point.x) < 1e-9);
  assert.ok(Math.abs(local.y - point.y) < 1e-9);
  assert.equal(inverse([0, 0, 0, 0, 0, 0]), undefined);
});

/**
 * 验证rotated bounds include corners outside the unrotated rectangle。
 * @returns 完成当前检查或生命周期操作。
 */
test('rotated bounds include corners outside the unrotated rectangle', () => {
  const matrix = nodeMatrix({ x: 0, y: 0, width: 100, height: 100, rotation: 45 });
  const bounds = transformedBounds(matrix, { x: 0, y: 0, width: 100, height: 100 });
  assert.ok(bounds.x < -20 && bounds.y < -20);
  assert.ok(bounds.width > 141 && bounds.height > 141);
});

/**
 * 验证spatial queries deduplicate spanning shapes and include large, negative and zero-height geometry。
 * @returns 完成当前检查或生命周期操作。
 */
test('spatial queries deduplicate spanning shapes and include large, negative and zero-height geometry', () => {
  const index = new SpatialIndex<{
    /** 唯一标识，用于查找、更新和建立引用。 */
    id: string;
    /** 用于布局、查询或素材定位的矩形范围。 */
    bounds: {
      /** 水平方向的位置。 */
      x: number;
      /** 垂直方向的位置。 */
      y: number;
      /** 对象的宽度。 */
      width: number;
      /** 对象的高度。 */
      height: number;
    };
  }>();
  index.insert({ id: 'page', bounds: { x: -100000, y: -100000, width: 200000, height: 200000 } });
  index.insert({ id: 'line', bounds: { x: -100, y: 0, width: 1000, height: 0 } });
  index.insert({ id: 'offscreen', bounds: { x: 10000, y: 10000, width: 20, height: 20 } });
  assert.deepEqual(
    new Set(
      index.query({ x: -50, y: -10, width: 600, height: 20 }).map(
        /** 提取条目的标识，供后续计算或展示使用。 @param item - 当前遍历的条目。 @returns 条目的标识。 */
        (item) => item.id,
      ),
    ),
    new Set(['page', 'line']),
  );
  assert.equal(index.query({ x: -1e6, y: -1e6, width: 2e6, height: 2e6 }).length, 3);
});

/**
 * 验证ten thousand nodes return only the local visible candidates。
 * @returns 完成当前检查或生命周期操作。
 */
test('ten thousand nodes return only the local visible candidates', () => {
  const index = new SpatialIndex<{
    /** 用于布局、查询或素材定位的矩形范围。 */
    bounds: {
      /** 水平方向的位置。 */
      x: number;
      /** 垂直方向的位置。 */
      y: number;
      /** 对象的宽度。 */
      width: number;
      /** 对象的高度。 */
      height: number;
    };
  }>();
  for (let y = 0; y < 100; y++)
    for (let x = 0; x < 100; x++)
      index.insert({ bounds: { x: x * 100, y: y * 100, width: 50, height: 50 } });
  assert.equal(index.query({ x: 0, y: 0, width: 999, height: 999 }).length, 100);
});
