import assert from 'node:assert/strict';
import test from 'node:test';
import type { DesignNode, Project } from '@forma/schema';
import { SceneCompiler } from '../src/canvas/scene.ts';
import { transform } from '../src/canvas/geometry.ts';

function node(id: string, patch: Partial<DesignNode> = {}): DesignNode {
  return { id, name: id, type: 'rectangle', x: 0, y: 0, width: 100, height: 100, ...patch };
}
function project(nodes: DesignNode[]): Project {
  return { id: 'p', name: 'p', description: '', category: '', status: 'draft', themeId: 'default', revision: 1,
    updatedAt: '', cover: 'blank', components: [], pages: [{ id: 'page', name: 'page', width: 1000, height: 1000, nodes }],
    tokens: { primary: '#f00', background: '#fff', surface: '#fff', text: '#000', muted: '#888', border: '#ddd', radius: 8, fontFamily: 'sans-serif', spacing: 8 } };
}

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
  const document = project([node('parent'), node('child', { parentId: 'parent' }), node('independent')]);
  const compiler = new SceneCompiler();
  const first = compiler.compile(document.pages[0], document);
  const nextPage = { ...document.pages[0], nodes: [node('parent', { rotation: 30 }), ...document.pages[0].nodes.slice(1)] };
  const next = compiler.compile(nextPage, document);
  assert.equal(first.nodes.get('independent'), next.nodes.get('independent'));
  assert.notEqual(first.nodes.get('child'), next.nodes.get('child'));
  const hidden = compiler.compile({ ...nextPage, nodes: [node('parent', { visible: false }), ...nextPage.nodes.slice(1)] }, document);
  assert.deepEqual(hidden.entries.map(entry => entry.node.id), ['independent']);
});

test('component expansion uses instance coordinates, overrides and instance selection targets', () => {
  const document = project([node('instance', { type: 'component', x: 400, y: 100, width: 200, height: 100, componentId: 'master', overrides: { child: { fill: '#00f' } } })]);
  document.components = [{ id: 'master', name: 'master', description: '', category: '', width: 100, height: 100,
    nodes: [node('child', { x: 10, y: 20, width: 20, height: 20, tokenBindings: { fill: 'primary' } })] }];
  const scene = new SceneCompiler().compile(document.pages[0], document);
  const child = scene.entries[1];
  assert.equal(child.node.fill, '#00f');
  assert.equal(child.target.id, 'instance');
  assert.deepEqual(transform(child.matrix, { x: 0, y: 0 }), { x: 420, y: 120 });
});

test('theme changes invalidate resolved values and malformed cycles terminate', () => {
  const document = project([node('a', { parentId: 'b', tokenBindings: { fill: 'primary' } }), node('b', { parentId: 'a' })]);
  const compiler = new SceneCompiler();
  assert.equal(compiler.compile(document.pages[0], document).nodes.get('a')!.node.fill, '#f00');
  const updated = { ...document, tokens: { ...document.tokens, primary: '#00f' } };
  assert.equal(compiler.compile(updated.pages[0], updated).nodes.get('a')!.node.fill, '#00f');
});
