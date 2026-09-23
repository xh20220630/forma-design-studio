import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAutoLayout, cloneNodes, resizeNodes, rootSelection, scalePath } from '@forma/editor-core/geometry';

const node = (id, fields = {}) => ({ id, name: id, type: 'rectangle', x: 0, y: 0, width: 40, height: 20, ...fields });
const geometry = entry => [entry.x, entry.y, entry.width, entry.height];
const get = (nodes, id) => nodes.find(item => item.id === id);

test('nested frame resizing preserves constraints and unrelated nodes without mutating input', () => {
  const nodes = [node('root', { type: 'frame', x: 100, y: 100, width: 200, height: 200 }), node('child', { type: 'frame', parentId: 'root', x: 120, y: 120, width: 100, height: 80, constraints: { horizontal: 'left-right', vertical: 'top-bottom' } }), node('leaf', { parentId: 'child', x: 190, y: 170, width: 20, height: 10, constraints: { horizontal: 'right', vertical: 'bottom' } }), node('center', { parentId: 'root', x: 250, y: 110, width: 30, height: 20, constraints: { horizontal: 'center', vertical: 'top' } }), node('unrelated')];
  const original = structuredClone(nodes);
  const result = resizeNodes(nodes, 'root', { x: 120, y: 140, width: 300, height: 250 });
  assert.deepEqual(geometry(get(result, 'child')), [140, 160, 200, 130]);
  assert.deepEqual(geometry(get(result, 'leaf')), [310, 260, 20, 10]);
  assert.deepEqual(geometry(get(result, 'center')), [320, 150, 30, 20]);
  assert.equal(get(result, 'unrelated'), get(nodes, 'unrelated'));
  assert.deepEqual(nodes, original);
});

test('horizontal and vertical auto-layout apply padding, gaps and cross-axis alignment', () => {
  const horizontal = [node('frame', { type: 'frame', x: 100, y: 40, width: 300, height: 100, layout: 'horizontal', padding: 10, gap: 20, alignItems: 'center' }), node('a', { parentId: 'frame', width: 40, height: 20 }), node('b', { parentId: 'frame', width: 60, height: 40 }), node('hidden', { parentId: 'frame', x: 999, visible: false })];
  const row = applyAutoLayout(horizontal, 'frame');
  assert.deepEqual(geometry(get(row, 'a')), [110, 80, 40, 20]);
  assert.deepEqual(geometry(get(row, 'b')), [170, 70, 60, 40]);
  assert.equal(get(row, 'hidden'), get(horizontal, 'hidden'));
  const column = applyAutoLayout([node('frame', { type: 'frame', x: 20, y: 30, width: 200, height: 200, layout: 'vertical', padding: 10, gap: 5, alignItems: 'end' }), node('a', { parentId: 'frame', width: 60, height: 20 }), node('b', { parentId: 'frame', width: 80, height: 30 })], 'frame');
  assert.deepEqual(geometry(get(column, 'a')), [150, 40, 60, 20]);
  assert.deepEqual(geometry(get(column, 'b')), [130, 65, 80, 30]);
});

test('wrap layout moves overflowing children to rows using the previous row height', () => {
  const result = applyAutoLayout([node('frame', { type: 'frame', width: 150, height: 200, layout: 'wrap', padding: 10, gap: 10 }), node('a', { parentId: 'frame', width: 70, height: 20 }), node('b', { parentId: 'frame', width: 60, height: 40 }), node('c', { parentId: 'frame', width: 30, height: 10 })], 'frame');
  assert.deepEqual(geometry(get(result, 'a')), [10, 10, 70, 20]);
  assert.deepEqual(geometry(get(result, 'b')), [10, 40, 60, 40]);
  assert.deepEqual(geometry(get(result, 'c')), [80, 40, 30, 10]);
});

test('hug layout measures visible content and keeps padding around empty containers', () => {
  const frame = node('frame', { type: 'frame', width: 200, height: 300, layout: 'vertical', padding: 8, gap: 4, sizingHorizontal: 'hug', sizingVertical: 'hug' });
  const result = applyAutoLayout([frame, node('a', { parentId: 'frame', width: 50, height: 20 }), node('b', { parentId: 'frame', width: 80, height: 30 }), node('hidden', { parentId: 'frame', x: 1000, y: 1000, width: 1000, height: 1000, visible: false })], 'frame');
  assert.deepEqual(geometry(get(result, 'frame')), [0, 0, 96, 70]);
  assert.deepEqual(geometry(applyAutoLayout([frame], 'frame')[0]), [0, 0, 16, 16]);
});

test('fill shares the remaining main-axis space and independently fills the cross-axis', () => {
  const row = applyAutoLayout([node('frame', { type: 'frame', width: 400, height: 120, layout: 'horizontal', padding: 10, gap: 10 }), node('fixed', { parentId: 'frame', width: 100 }), node('fill-a', { parentId: 'frame', width: 20, sizingHorizontal: 'fill', sizingVertical: 'fill' }), node('fill-b', { parentId: 'frame', width: 20, sizingHorizontal: 'fill' })], 'frame');
  assert.deepEqual(geometry(get(row, 'fixed')), [10, 10, 100, 20]);
  assert.deepEqual(geometry(get(row, 'fill-a')), [120, 10, 130, 100]);
  assert.deepEqual(geometry(get(row, 'fill-b')), [260, 10, 130, 20]);
  const column = applyAutoLayout([node('frame', { type: 'frame', width: 200, height: 300, layout: 'vertical', padding: 10, gap: 10 }), node('fixed', { parentId: 'frame', height: 40 }), node('fill', { parentId: 'frame', width: 40, height: 20, sizingVertical: 'fill', sizingHorizontal: 'fill' })], 'frame');
  assert.deepEqual(geometry(get(column, 'fill')), [10, 60, 180, 230]);
});

test('group resizing scales geometry while frame resizing honors child constraints', () => {
  const child = node('child', { parentId: 'container', x: 30, y: 40, width: 30, height: 20 });
  const container = node('container', { type: 'group', x: 10, y: 20, width: 100, height: 80 });
  assert.deepEqual(geometry(get(resizeNodes([container, child], 'container', { width: 200, height: 40 }), 'child')), [50, 30, 60, 10]);
  assert.deepEqual(geometry(get(resizeNodes([{ ...container, type: 'frame' }, child], 'container', { width: 200, height: 40 }), 'child')), [30, 40, 30, 20]);
});

test('resizing vector paths scales local points and closed linear path coordinates', () => {
  const path = node('path', { type: 'path', width: 40, height: 50, closed: true, points: [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 40, y: 50 }] });
  const result = resizeNodes([path], 'path', { x: 100, y: 200, width: 80, height: 25 })[0];
  assert.deepEqual(result.points, [{ x: 0, y: 0 }, { x: 20, y: 10 }, { x: 80, y: 25 }]);
  const linear = resizeNodes([{ ...path, points: undefined, path: 'M0 0 L40 0 L40 50 Z' }], 'path', { width: 80, height: 25 })[0];
  assert.deepEqual(linear.path.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g).map(Number), [0, 0, 80, 0, 80, 25]);
  assert.deepEqual(path.points, [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 40, y: 50 }]);
});

test('cloning a selection remaps its entire parent graph and isolates mutable overrides', () => {
  const nodes = [node('parent', { type: 'group', parentId: 'external' }), node('child', { type: 'component', parentId: 'parent', componentId: 'master', overrides: { label: { text: 'Original' } } }), node('leaf', { parentId: 'child' }), node('unrelated')];
  assert.deepEqual(rootSelection(nodes, ['parent', 'child', 'leaf']), ['parent']);
  const result = cloneNodes(nodes, ['parent'], 24);
  assert.equal(result.nodes.length, 3);
  const [parent, child, leaf] = result.nodes;
  assert.deepEqual(result.ids, [parent.id]);
  assert.equal(parent.parentId, 'external');
  assert.equal(child.parentId, parent.id);
  assert.equal(leaf.parentId, child.id);
  assert.equal(child.componentId, 'master');
  assert.equal(new Set([...nodes.map(item => item.id), ...result.nodes.map(item => item.id)]).size, 7);
  assert.deepEqual(geometry(child), [24, 24, 40, 20]);
  child.overrides.label.text = 'Changed';
  assert.equal(nodes[1].overrides.label.text, 'Original');
});

test('path scaling preserves relative commands and transforms rotated arc geometry', () => {
  const scaled = scalePath('m1 2 c3 4 5 6 7 8 h9 v10 z', 2, 3);
  assert.equal(scaled, 'm 2 6 c 6 12 10 18 14 24 h 18 v 30 z');
  const arc = scalePath('M0 0 A30 10 45 0 1 40 20', 2, 1);
  const values = arc.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g).map(Number).slice(2);
  const [rx, ry, angle, large, sweep, x, y] = values;
  const radians = angle * Math.PI / 180;
  const xx = rx * rx * Math.cos(radians) ** 2 + ry * ry * Math.sin(radians) ** 2;
  const yy = rx * rx * Math.sin(radians) ** 2 + ry * ry * Math.cos(radians) ** 2;
  assert.ok(Math.abs(xx - 2000) < 0.00001 && Math.abs(yy - 500) < 0.00001);
  assert.deepEqual([large, sweep, x, y], [0, 1, 80, 20]);
});

test('nested auto-layout fill remains stable when the outer frame is resized', () => {
  const nodes = [node('outer', { type: 'frame', width: 500, height: 300, layout: 'vertical', padding: 10 }), node('inner', { type: 'frame', parentId: 'outer', layout: 'horizontal', width: 100, height: 100, padding: 10, sizingHorizontal: 'fill', sizingVertical: 'fill' }), node('leaf', { parentId: 'inner', width: 20, height: 20, sizingHorizontal: 'fill', sizingVertical: 'fill' })];
  const arranged = applyAutoLayout(nodes, 'outer');
  assert.deepEqual(geometry(get(arranged, 'inner')), [10, 10, 480, 280]);
  assert.deepEqual(geometry(get(arranged, 'leaf')), [20, 20, 460, 260]);
  const resized = resizeNodes(arranged, 'outer', { width: 600, height: 400 });
  assert.deepEqual(geometry(get(resized, 'leaf')), [20, 20, 560, 360]);
  assert.deepEqual(applyAutoLayout(resized, 'outer'), resized);
});
