import assert from 'node:assert/strict';
import test from 'node:test';
import type { DesignNode } from '@forma/schema';
import {
  descendants,
  rootSelection,
  nodeIndex,
  hasNodeChanges,
  nearestSnap,
  moveNodes,
  resizeNodes,
} from '../../src/geometry.ts';

const node = (id: string, parentId?: string): DesignNode => ({
  id,
  parentId,
  name: id,
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  height: 20,
});

test('indexed selection handles reversed trees, cycles, missing parents and ten thousand roots', () => {
  const tree = [
    node('leaf', 'child'),
    node('child', 'root'),
    node('root'),
    node('orphan', 'missing'),
  ];
  assert.deepEqual(rootSelection(tree, ['leaf', 'root', 'child', 'orphan']), ['root', 'orphan']);
  assert.deepEqual(new Set(descendants(tree, ['root'])), new Set(['root', 'child', 'leaf']));
  const cycle = [node('a', 'b'), node('b', 'a')];
  assert.deepEqual(new Set(descendants(cycle, ['a'])), new Set(['a', 'b']));
  assert.deepEqual(rootSelection(cycle, ['a', 'b']), []);
  const large = Array.from({ length: 10000 }, (_, i) => node(String(i)));
  assert.deepEqual(
    rootSelection(
      large,
      large.map((n) => n.id),
    ),
    large.map((n) => n.id),
  );
  assert.equal(nodeIndex(large), nodeIndex(large));
});

test('immutable edits share image payloads and detect no-op gestures without serializing', () => {
  const image = Object.freeze({
    ...node('image'),
    type: 'image' as const,
    src: 'data:image/png;base64,' + 'a'.repeat(1000000),
  });
  const other = Object.freeze(node('other'));
  const before = Object.freeze([image, other]) as unknown as DesignNode[];
  const moved = moveNodes(before, ['image'], 10, 20);
  assert.equal(moved[0].src, image.src);
  assert.equal(moved[1], other);
  assert.equal(image.x, 0);
  assert.equal(hasNodeChanges(before, moved), true);
  assert.equal(hasNodeChanges(before, moveNodes(moved, ['image'], -10, -20)), false);
  const resized = resizeNodes(before, 'image', { width: 40 });
  assert.equal(resized[0].src, image.src);
  assert.equal(image.width, 20);
  const path = { ...node('path'), points: [{ x: 0, y: 0 }] };
  assert.equal(hasNodeChanges([path], [{ ...path, points: [{ x: 0, y: 0 }] }]), false);
  assert.equal(hasNodeChanges([path], [{ ...path, points: [{ x: 1, y: 0 }] }]), true);
});

test('binary snapping finds nearest coordinates at either end and respects the threshold', () => {
  const values = [-100, 0, 10, 10, 100];
  assert.equal(nearestSnap(values, -99, 5), -100);
  assert.equal(nearestSnap(values, 104, 5), 100);
  assert.equal(nearestSnap(values, 5, 5), undefined);
  assert.equal(nearestSnap(values, 7, 5), 10);
  assert.equal(nearestSnap([], 0, 5), undefined);
});
