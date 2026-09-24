import test from 'node:test';
import assert from 'node:assert/strict';
import { booleanNodes } from '@forma/editor-core/boolean';

/**
 * 构造指定范围的矩形节点，供几何场景复用。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @param x - 水平方向的位置。
 * @param y - 垂直方向的位置。
 * @param width - 对象的宽度。
 * @param height - 对象的高度。
 * @returns 矩形设计节点。
 */
const rect = (id, x, y, width, height) => ({
  id,
  name: id,
  type: 'rectangle',
  x,
  y,
  width,
  height,
  fill: '#0d99ff',
});
/**
 * 计算几何结果面积，用于比较布尔运算前后的区域。
 *
 * @param node - 当前处理的设计节点。
 * @returns 几何面积。
 */
const area = (node) => {
  let total = 0;
  for (const subpath of node.path.split('Z').filter(
    /** 检查去掉 part 的首尾空白，供集合筛选或定位使用。 @param part - 当前处理的消息内容块。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (part) => part.trim(),
  )) {
    const coordinates = subpath.match(/-?(?:\d*\.)?\d+/g).map(Number);
    const points = Array.from(
      { length: coordinates.length / 2 },
      /** 执行 area 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param _ - 当前步骤不使用的占位参数。 @param index - 空间查询索引或当前条目的位置。 @returns 当前步骤的处理结果。 */
      (_, index) => coordinates.slice(index * 2, index * 2 + 2),
    );
    total +=
      points.reduce(
        /**
         * 累积 area 中的条目结果，供后续计算使用。
         *
         * @param sum - 累加到当前项之前的结果。
         * @param arg2 - 按顺序解构的当前条目。
         * @param arg2.x - 水平方向的位置。
         * @param arg2.y - 垂直方向的位置。
         * @param index - 空间查询索引或当前条目的位置。
         * @returns 纳入当前条目后的累计结果。
         */
        (sum, [x, y], index) => {
          const next = points[(index + 1) % points.length];
          return sum + x * next[1] - next[0] * y;
        },
        0,
      ) / 2;
  }
  return Math.abs(total);
};

/**
 * 验证boolean operations retain exact area and stacking for intersecting rectangles。
 * @returns 完成当前检查或生命周期操作。
 */
test('boolean operations retain exact area and stacking for intersecting rectangles', () => {
  const first = rect('a', 0, 0, 100, 100),
    second = rect('b', 50, 0, 100, 100),
    unrelated = rect('c', 500, 0, 20, 20);
  for (const [operation, expected] of [
    ['union', 15000],
    ['difference', 5000],
    ['intersection', 5000],
    ['xor', 10000],
  ]) {
    const result = booleanNodes([first, second, unrelated], ['b', 'a'], operation);
    assert.equal(result.nodes.length, 2);
    assert.equal(result.nodes[0].id, result.selectedId);
    assert.equal(result.nodes[1], unrelated);
    assert.equal(area(result.nodes[0]), expected);
    assert.equal(result.nodes[0].fill, first.fill);
  }
});

/**
 * 验证boolean holes survive a second operation and preserve subtraction direction。
 * @returns 完成当前检查或生命周期操作。
 */
test('boolean holes survive a second operation and preserve subtraction direction', () => {
  const first = rect('a', 0, 0, 100, 100),
    hole = rect('b', 25, 25, 50, 50);
  const donut = booleanNodes([first, hole], ['a', 'b'], 'difference').nodes[0];
  assert.equal(area(donut), 7500);
  const extension = rect('c', 90, 0, 30, 100);
  const next = booleanNodes([donut, extension], [donut.id, extension.id], 'union').nodes[0];
  assert.equal(area(next), 9500);
  const fragment = rect('d', 35, 35, 10, 10);
  assert.throws(
    /** 执行 boolean.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => booleanNodes([donut, fragment], [donut.id, fragment.id], 'intersection'),
    /为空/,
  );
});

/**
 * 验证boolean transforms and shape approximation stay within expected bounds。
 * @returns 完成当前检查或生命周期操作。
 */
test('boolean transforms and shape approximation stay within expected bounds', () => {
  const rotated = { ...rect('a', 0, 0, 100, 50), rotation: 90 };
  const mask = rect('b', -100, -100, 400, 400);
  const result = booleanNodes([rotated, mask], ['a', 'b'], 'intersection').nodes[0];
  assert.ok(Math.abs(result.width - 50) < 0.00001);
  assert.ok(Math.abs(result.height - 100) < 0.00001);
  assert.equal(result.rotation, 0);
  const ellipse = { ...rect('c', 0, 0, 100, 100), type: 'ellipse' };
  const circle = booleanNodes([ellipse, mask], ['c', 'b'], 'intersection').nodes[0];
  assert.ok(Math.abs(area(circle) - Math.PI * 2500) < 8);
  assert.throws(
    /** 执行 boolean.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () =>
      booleanNodes(
        [rect('a', 0, 0, 10, 10), rect('b', 50, 50, 10, 10)],
        ['a', 'b'],
        'intersection',
      ),
    /为空/,
  );
});

/**
 * 验证boolean rejects incompatible and locked sources without mutating input。
 * @returns 完成当前检查或生命周期操作。
 */
test('boolean rejects incompatible and locked sources without mutating input', () => {
  const nodes = [rect('a', 0, 0, 100, 100), { ...rect('b', 0, 0, 40, 40), locked: true }];
  const original = structuredClone(nodes);
  assert.throws(
    /** 执行 boolean.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () => booleanNodes(nodes, ['a', 'b'], 'union'),
    /解锁/,
  );
  assert.deepEqual(nodes, original);
  assert.throws(
    /** 执行 boolean.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
    () =>
      booleanNodes([nodes[0], { ...nodes[1], locked: false, type: 'text' }], ['a', 'b'], 'union'),
    /支持/,
  );
});
