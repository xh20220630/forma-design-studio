import test from 'node:test';
import assert from 'node:assert/strict';
import { booleanNodes } from '@forma/editor-core/boolean';

const rect = (id, x, y, width, height) => ({ id, name: id, type: 'rectangle', x, y, width, height, fill: '#0d99ff' });
const area = node => {
  let total = 0;
  for (const subpath of node.path.split('Z').filter(part => part.trim())) {
    const coordinates = subpath.match(/-?(?:\d*\.)?\d+/g).map(Number);
    const points = Array.from({ length: coordinates.length / 2 }, (_, index) => coordinates.slice(index * 2, index * 2 + 2));
    total += points.reduce((sum, [x, y], index) => { const next = points[(index + 1) % points.length]; return sum + x * next[1] - next[0] * y; }, 0) / 2;
  }
  return Math.abs(total);
};

test('boolean operations retain exact area and stacking for intersecting rectangles', () => {
  const first = rect('a', 0, 0, 100, 100), second = rect('b', 50, 0, 100, 100), unrelated = rect('c', 500, 0, 20, 20);
  for (const [operation, expected] of [['union', 15000], ['difference', 5000], ['intersection', 5000], ['xor', 10000]]) {
    const result = booleanNodes([first, second, unrelated], ['b', 'a'], operation);
    assert.equal(result.nodes.length, 2);
    assert.equal(result.nodes[0].id, result.selectedId);
    assert.equal(result.nodes[1], unrelated);
    assert.equal(area(result.nodes[0]), expected);
    assert.equal(result.nodes[0].fill, first.fill);
  }
});

test('boolean holes survive a second operation and preserve subtraction direction', () => {
  const first = rect('a', 0, 0, 100, 100), hole = rect('b', 25, 25, 50, 50);
  const donut = booleanNodes([first, hole], ['a', 'b'], 'difference').nodes[0];
  assert.equal(area(donut), 7500);
  const extension = rect('c', 90, 0, 30, 100);
  const next = booleanNodes([donut, extension], [donut.id, extension.id], 'union').nodes[0];
  assert.equal(area(next), 9500);
  const fragment = rect('d', 35, 35, 10, 10);
  assert.throws(() => booleanNodes([donut, fragment], [donut.id, fragment.id], 'intersection'), /为空/);
});

test('boolean transforms and shape approximation stay within expected bounds', () => {
  const rotated = { ...rect('a', 0, 0, 100, 50), rotation: 90 };
  const mask = rect('b', -100, -100, 400, 400);
  const result = booleanNodes([rotated, mask], ['a', 'b'], 'intersection').nodes[0];
  assert.ok(Math.abs(result.width - 50) < .00001);
  assert.ok(Math.abs(result.height - 100) < .00001);
  assert.equal(result.rotation, 0);
  const ellipse = { ...rect('c', 0, 0, 100, 100), type: 'ellipse' };
  const circle = booleanNodes([ellipse, mask], ['c', 'b'], 'intersection').nodes[0];
  assert.ok(Math.abs(area(circle) - Math.PI * 2500) < 8);
  assert.throws(() => booleanNodes([rect('a', 0, 0, 10, 10), rect('b', 50, 50, 10, 10)], ['a', 'b'], 'intersection'), /为空/);
});

test('boolean rejects incompatible and locked sources without mutating input', () => {
  const nodes = [rect('a', 0, 0, 100, 100), { ...rect('b', 0, 0, 40, 40), locked: true }];
  const original = structuredClone(nodes);
  assert.throws(() => booleanNodes(nodes, ['a', 'b'], 'union'), /解锁/);
  assert.deepEqual(nodes, original);
  assert.throws(() => booleanNodes([nodes[0], { ...nodes[1], locked: false, type: 'text' }], ['a', 'b'], 'union'), /支持/);
});

