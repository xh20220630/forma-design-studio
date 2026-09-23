import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { WorkspaceOperation } from '@forma/schema/workbench';
import { openDesignWorkspace, WorkspaceConflictError, WorkspaceInputError } from '../src/index.ts';
import { createV1Workspace } from './fixture.ts';

async function fixture() {
  const root = await createV1Workspace();
  await mkdir(path.join(root, 'components/card'));
  await writeFile(path.join(root, 'components/card/v1.md'), '# Card\n');
  await writeFile(path.join(root, 'components/index.json'), JSON.stringify({ schema_version: 2, components: [
    { id: 'card', version: '1.0.0', name: 'Card', status: 'approved', scope: [], excludes: [], tags: [], spec_path: 'components/card/v1.md' },
  ] }));
  const sourcePath = 'flows/order/custom.json';
  const raw = JSON.parse(await readFile(path.join(root, 'flows/order/flow.json'), 'utf8'));
  raw.pages[0].component_usage = [{ id: 'card', version: '1.0.0', adaptation: 'List' }];
  raw.pages[0].annotations = [{ id: 'note', label: 'Open', text: 'Old note', x: .1, y: .2, label_x: .3, label_y: .4, target: 'order/detail', extension: 'preserved' }];
  await writeFile(path.join(root, sourcePath), JSON.stringify(raw));
  await writeFile(path.join(root, 'flows/index.json'), JSON.stringify({ schema_version: 1, flows: [{ id: 'order', name: 'Order', path: sourcePath, related_flows: [] }] }));
  const workspace = await openDesignWorkspace({ root });
  return { root, workspace, sourcePath, cleanup: () => rm(path.dirname(root), { recursive: true, force: true }) };
}

test('persists Markdown and annotations in one revision and notifies live readers', async () => {
  const { root, workspace, sourcePath, cleanup } = await fixture();
  const reader = await openDesignWorkspace({ root });
  let notify!: (revision: number) => void;
  const event = new Promise<number>(resolve => { notify = resolve; });
  const watcher = await reader.watch(update => notify(update.revision));
  try {
    const initial = await workspace.read();
    assert.deepEqual(initial.flows[0].brief, { path: 'flows/order/BRIEF.md', content: '# Order flow' });
    assert.equal(initial.flows[0].sourcePath, sourcePath);
    const original = initial.flows[0].nodes[0].annotations[0];
    const content = '# 新规范\n\n| 状态 | 操作 |\n| --- | --- |\n| 默认 | 打开 |\n';
    const result = await workspace.apply({ baseRevision: 0, operations: [
      { type: 'set-component-spec', componentId: 'card', version: '1.0.0', content, expectedContent: '# Card\n' },
      { type: 'set-flow-brief', flowId: 'order', content: '# 新流程\n', expectedContent: '# Order flow' },
      { type: 'update-annotation', flowId: 'order', pageId: 'list', expectedAnnotation: original, annotation: { ...original, label: '新标题', text: '新说明', x: .5, labelY: .8, target: undefined } },
    ] });
    assert.equal(result.revision, 1);
    assert.equal(await readFile(path.join(root, 'components/card/v1.md'), 'utf8'), content);
    assert.equal(await readFile(path.join(root, 'flows/order/BRIEF.md'), 'utf8'), '# 新流程\n');
    const persisted = JSON.parse(await readFile(path.join(root, sourcePath), 'utf8'));
    assert.equal(persisted.pages[0].annotations[0].label_y, .8);
    assert.equal(persisted.pages[0].annotations[0].target, null);
    assert.equal(persisted.pages[0].annotations[0].extension, 'preserved');
    assert.equal(persisted.pages[0].review.status, 'approved');
    assert.equal(result.document.flows[0].nodes[0].annotations[0].text, '新说明');
    assert.equal(result.document.designSystem.components[0].specContent, content);
    assert.ok(result.changedFiles.includes(sourcePath));
    const timeout = setTimeout(() => notify(-1), 3000);
    try { assert.equal(await event, 1); } finally { clearTimeout(timeout); }
    assert.equal((await reader.read()).flows[0].brief?.content, '# 新流程\n');
  } finally { await watcher.dispose(); await cleanup(); }
});

test('rejects stale content and annotations even when external edits did not increment revision', async () => {
  const { root, workspace, sourcePath, cleanup } = await fixture();
  try {
    const initial = await workspace.read();
    await writeFile(path.join(root, 'components/card/v1.md'), '# External');
    await assert.rejects(workspace.apply({ baseRevision: 0, operations: [{ type: 'set-component-spec', componentId: 'card', version: '1.0.0', content: 'stale', expectedContent: '# Card\n' }] }), WorkspaceConflictError);
    const raw = JSON.parse(await readFile(path.join(root, sourcePath), 'utf8'));
    raw.pages[0].annotations[0].text = 'external note';
    await writeFile(path.join(root, sourcePath), JSON.stringify(raw));
    const original = initial.flows[0].nodes[0].annotations[0];
    await assert.rejects(workspace.apply({ baseRevision: 0, operations: [{ type: 'update-annotation', flowId: 'order', pageId: 'list', expectedAnnotation: original, annotation: { ...original, text: 'stale' } }] }), WorkspaceConflictError);
    assert.equal((await workspace.read()).revision, 0);
    assert.equal(await readFile(path.join(root, 'components/card/v1.md'), 'utf8'), '# External');
  } finally { await cleanup(); }
});

test('rejects invalid annotation targets and coordinates without partially saving Markdown', async () => {
  const { root, workspace, cleanup } = await fixture();
  try {
    const initial = await workspace.read();
    const original = initial.flows[0].nodes[0].annotations[0];
    for (const patch of [{ target: 'order/missing' }, { x: 2 }, { label: '' }]) {
      await assert.rejects(workspace.apply({ baseRevision: 0, operations: [
        { type: 'set-flow-brief', flowId: 'order', content: 'Do not persist', expectedContent: '# Order flow' },
        { type: 'update-annotation', flowId: 'order', pageId: 'list', expectedAnnotation: original, annotation: { ...original, ...patch } },
      ] }), WorkspaceInputError);
      assert.equal((await workspace.read()).revision, 0);
      assert.equal(await readFile(path.join(root, 'flows/order/BRIEF.md'), 'utf8'), '# Order flow');
    }
    const invalid = { type: 'set-flow-brief', flowId: 'order', content: 12 } as unknown as WorkspaceOperation;
    await assert.rejects(workspace.apply({ baseRevision: 0, operations: [invalid] }), WorkspaceInputError);
  } finally { await cleanup(); }
});

test('does not edit unregistered Markdown or follow documentation symlinks outside design', async () => {
  const { root, workspace, cleanup } = await fixture();
  try {
    await assert.rejects(workspace.apply({ baseRevision: 0, operations: [{ type: 'set-component-spec', componentId: '../outside', version: '1.0.0', content: 'bad', expectedContent: '' }] }), WorkspaceInputError);
    const outside = path.join(root, '..', 'outside.md');
    await writeFile(outside, '# Private');
    await rm(path.join(root, 'flows/order/BRIEF.md'));
    await symlink(outside, path.join(root, 'flows/order/BRIEF.md'));
    await assert.rejects(workspace.apply({ baseRevision: 0, operations: [{ type: 'set-flow-brief', flowId: 'order', content: 'bad', expectedContent: '# Private' }] }));
    assert.equal(await readFile(outside, 'utf8'), '# Private');
  } finally { await cleanup(); }
});
