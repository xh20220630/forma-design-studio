import assert from 'node:assert/strict';
import test from 'node:test';
import type { DesignNode, Project } from '@forma/schema';
import { SceneCompiler } from '../../src/canvas/scene.ts';
import { transform } from '../../src/canvas/geometry.ts';
import { translationLayers } from '../../src/canvas/translation.ts';

/**
 * 构造具有默认字段的设计节点，减少样例中无关字段的干扰。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @param patch - 仅包含本次要修改字段的局部更新。
 * @returns 合并指定属性后的节点。
 */
function node(id: string, patch: Partial<DesignNode> = {}): DesignNode {
  return { id, name: id, type: 'rectangle', x: 0, y: 0, width: 100, height: 100, ...patch };
}
/**
 * 构造包含指定页面与节点的项目，供渲染场景复用。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @returns 设计项目。
 */
function project(nodes: DesignNode[]): Project {
  return {
    id: 'p',
    name: 'p',
    description: '',
    category: '',
    status: 'draft',
    themeId: 'default',
    revision: 1,
    updatedAt: '',
    cover: 'blank',
    components: [],
    pages: [{ id: 'page', name: 'page', width: 1000, height: 1000, nodes }],
    tokens: {
      primary: '#f00',
      background: '#fff',
      surface: '#fff',
      text: '#000',
      muted: '#888',
      border: '#ddd',
      radius: 8,
      fontFamily: 'sans-serif',
      spacing: 8,
    },
  };
}

test('translation layers retain stacking and fall back for external clipping and backdrop blending', () => {
  const document = project([
    node('under'),
    node('group', { type: 'group' }),
    node('child', { parentId: 'group' }),
    node('over'),
  ]);
  const scene = new SceneCompiler().compile(document.pages[0], document);
  const layers = translationLayers(scene, new Set(['group', 'child']))!;
  assert.deepEqual(
    layers.map((layer) => layer.moving),
    [false, true, false],
  );
  assert.deepEqual(
    layers.map((layer) => layer.index.size),
    [1, 2, 1],
  );
  assert.equal(layers[0].background, true);
  const clipped = project([
    node('frame', { type: 'frame', clipContent: true }),
    node('child', { parentId: 'frame' }),
  ]);
  const clippedScene = new SceneCompiler().compile(clipped.pages[0], clipped);
  assert.equal(translationLayers(clippedScene, new Set(['child'])), undefined);
  assert.ok(translationLayers(clippedScene, new Set(['frame', 'child'])));
  const blended = project([node('a', { blendMode: 'multiply' })]);
  assert.equal(
    translationLayers(new SceneCompiler().compile(blended.pages[0], blended), new Set(['a'])),
    undefined,
  );
});

test('parent rotation, opacity, locks, and clips are inherited independent of array order', () => {
  const document = project([
    node('child', { parentId: 'parent', x: 110, y: 110, width: 20, height: 20, opacity: 0.5 }),
    node('parent', { x: 100, y: 100, rotation: 90, opacity: 0.5, locked: true, clipContent: true }),
  ]);
  const scene = new SceneCompiler().compile(document.pages[0], document);
  const child = scene.nodes.get('child')!;
  assert.deepEqual(transform(child.matrix, { x: 10, y: 10 }), { x: 180, y: 120 });
  assert.equal(child.opacity, 0.25);
  assert.equal(child.locked, true);
  assert.equal(child.clips.length, 1);
});

test('hidden descendants are excluded; unchanged geometry is reused and ancestors invalidate descendants', () => {
  const document = project([
    node('parent'),
    node('child', { parentId: 'parent' }),
    node('independent'),
  ]);
  const compiler = new SceneCompiler();
  const first = compiler.compile(document.pages[0], document);
  const nextPage = {
    ...document.pages[0],
    nodes: [node('parent', { rotation: 30 }), ...document.pages[0].nodes.slice(1)],
  };
  const next = compiler.compile(nextPage, document);
  assert.equal(first.nodes.get('independent'), next.nodes.get('independent'));
  assert.notEqual(first.nodes.get('child'), next.nodes.get('child'));
  const hidden = compiler.compile(
    { ...nextPage, nodes: [node('parent', { visible: false }), ...nextPage.nodes.slice(1)] },
    document,
  );
  assert.deepEqual(
    hidden.entries.map((entry) => entry.node.id),
    ['independent'],
  );
});

test('component expansion uses instance coordinates, overrides and instance selection targets', () => {
  const document = project([
    node('instance', {
      type: 'component',
      x: 400,
      y: 100,
      width: 200,
      height: 100,
      componentId: 'master',
      overrides: { child: { fill: '#00f' } },
    }),
  ]);
  document.components = [
    {
      id: 'master',
      name: 'master',
      description: '',
      category: '',
      width: 100,
      height: 100,
      nodes: [
        node('child', { x: 10, y: 20, width: 20, height: 20, tokenBindings: { fill: 'primary' } }),
      ],
    },
  ];
  const scene = new SceneCompiler().compile(document.pages[0], document);
  const child = scene.entries[1];
  assert.equal(child.node.fill, '#00f');
  assert.equal(child.target.id, 'instance');
  assert.deepEqual(transform(child.matrix, { x: 0, y: 0 }), { x: 420, y: 120 });
});

test('theme changes invalidate resolved values and malformed cycles terminate', () => {
  const document = project([
    node('a', { parentId: 'b', tokenBindings: { fill: 'primary' } }),
    node('b', { parentId: 'a' }),
  ]);
  const compiler = new SceneCompiler();
  assert.equal(compiler.compile(document.pages[0], document).nodes.get('a')!.node.fill, '#f00');
  const updated = { ...document, tokens: { ...document.tokens, primary: '#00f' } };
  assert.equal(compiler.compile(updated.pages[0], updated).nodes.get('a')!.node.fill, '#00f');
});

test('a single edit in ten thousand nodes updates only the changed spatial entry', () => {
  const document = project(
    Array.from({ length: 10000 }, (_, i) => node(String(i), { x: i * 120 })),
  );
  const compiler = new SceneCompiler();
  const first = compiler.compile(document.pages[0], document);
  assert.equal(compiler.compile(document.pages[0], document), first);
  const original = first.nodes.get('0')!;
  const page = { ...document.pages[0], nodes: [...document.pages[0].nodes] };
  page.nodes[0] = { ...page.nodes[0], x: -1000 };
  const next = compiler.compile(page, document);
  assert.equal(next.index, first.index);
  assert.equal(next.index.size, 10000);
  assert.equal(next.changes!.full, false);
  assert.equal(next.changes!.added.length, 1);
  assert.deepEqual(next.changes!.removed, [original]);
  assert.equal(next.changes!.bounds.length, 2);
  assert.equal(next.index.query(original.bounds).length, 0);
  assert.equal(next.nodes.get('9999'), first.nodes.get('9999'));
  const removed = compiler.compile({ ...page, nodes: page.nodes.slice(1) }, document);
  assert.equal(removed.index.size, 9999);
  assert.equal(removed.index.query(next.nodes.get('0')!.bounds).length, 0);
});

test('instance children retain identity across unrelated edits and stacking changes invalidate blocks', () => {
  const document = project([
    node('instance', { type: 'component', componentId: 'master' }),
    node('other'),
  ]);
  document.components = [
    {
      id: 'master',
      name: 'Master',
      description: '',
      category: '',
      width: 100,
      height: 100,
      nodes: [node('nested')],
    },
  ];
  const compiler = new SceneCompiler();
  const first = compiler.compile(document.pages[0], document);
  const page = {
    ...document.pages[0],
    nodes: [document.pages[0].nodes[0], node('other', { x: 500 })],
  };
  const next = compiler.compile(page, document);
  assert.equal(next.entries[1], first.entries[1]);
  assert.equal(next.changes!.added.length, 1);
  const reordered = compiler.compile({ ...page, nodes: [...page.nodes].reverse() }, document);
  assert.equal(reordered.changes!.added.length, 0);
  assert.ok(reordered.changes!.bounds.length > 0);
  assert.equal(reordered.index.size, 3);
});
