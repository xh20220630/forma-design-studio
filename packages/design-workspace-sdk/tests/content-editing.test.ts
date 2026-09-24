import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { WorkspaceOperation } from '@forma/schema/workbench';
import { openDesignWorkspace, WorkspaceConflictError, WorkspaceInputError } from '../src/index.ts';
import { createV1Workspace } from './fixture.ts';

/**
 * 创建隔离的样例数据与运行环境，让行为检查不依赖用户工作空间。
 * @returns 样例环境及清理所需信息。
 */
async function fixture() {
  const root = await createV1Workspace();
  await mkdir(path.join(root, 'components/card'));
  await writeFile(path.join(root, 'components/card/v1.md'), '# Card\n');
  await writeFile(
    path.join(root, 'components/index.json'),
    JSON.stringify({
      schema_version: 2,
      components: [
        {
          id: 'card',
          version: '1.0.0',
          name: 'Card',
          status: 'approved',
          scope: [],
          excludes: [],
          tags: [],
          spec_path: 'components/card/v1.md',
        },
      ],
    }),
  );
  const sourcePath = 'flows/order/custom.json';
  const raw = JSON.parse(await readFile(path.join(root, 'flows/order/flow.json'), 'utf8'));
  raw.pages[0].component_usage = [{ id: 'card', version: '1.0.0', adaptation: 'List' }];
  raw.pages[0].annotations = [
    {
      id: 'note',
      label: 'Open',
      text: 'Old note',
      x: 0.1,
      y: 0.2,
      label_x: 0.3,
      label_y: 0.4,
      target: 'order/detail',
      extension: 'preserved',
    },
  ];
  await writeFile(path.join(root, sourcePath), JSON.stringify(raw));
  await writeFile(
    path.join(root, 'flows/index.json'),
    JSON.stringify({
      schema_version: 1,
      flows: [{ id: 'order', name: 'Order', path: sourcePath, related_flows: [] }],
    }),
  );
  const workspace = await openDesignWorkspace({ root });
  return {
    root,
    workspace,
    sourcePath,
    /**
     * 关闭临时服务或删除临时数据，避免一个场景影响后续场景。
     * @returns 清理完成后的结果。
     */
    cleanup: () => rm(path.dirname(root), { recursive: true, force: true }),
  };
}

/**
 * 验证persists Markdown and annotations in one revision and notifies live readers。
 * @returns 完成当前检查或生命周期操作。
 */
test('persists Markdown and annotations in one revision and notifies live readers', async () => {
  const { root, workspace, sourcePath, cleanup } = await fixture();
  const reader = await openDesignWorkspace({ root });
  let notify!: (revision: number) => void;
  const event = new Promise<number>(
    /**
     * 把content-editing.test中的回调式操作接入 Promise，以便调用方等待完成或处理失败。
     *
     * @param resolve - 异步操作成功时调用的完成函数。
     * @returns 无返回值；通过 resolve 或 reject 结束等待。
     */
    (resolve) => {
      notify = resolve;
    },
  );
  const watcher = await reader.watch(
    /** 执行content-editing.test传入的局部处理步骤，使调用处能够控制结果如何更新。 @param update - 根据旧值计算新值的更新函数。 @returns 无返回值；通过副作用完成当前操作。 */
    (update) => notify(update.revision),
  );
  try {
    const initial = await workspace.read();
    assert.deepEqual(initial.flows[0].brief, {
      path: 'flows/order/BRIEF.md',
      content: '# Order flow',
    });
    assert.equal(initial.flows[0].sourcePath, sourcePath);
    const original = initial.flows[0].nodes[0].annotations[0];
    const content = '# 新规范\n\n| 状态 | 操作 |\n| --- | --- |\n| 默认 | 打开 |\n';
    const result = await workspace.apply({
      baseRevision: 0,
      operations: [
        {
          type: 'set-component-spec',
          componentId: 'card',
          version: '1.0.0',
          content,
          expectedContent: '# Card\n',
        },
        {
          type: 'set-flow-brief',
          flowId: 'order',
          content: '# 新流程\n',
          expectedContent: '# Order flow',
        },
        {
          type: 'update-annotation',
          flowId: 'order',
          pageId: 'list',
          expectedAnnotation: original,
          annotation: {
            ...original,
            label: '新标题',
            text: '新说明',
            x: 0.5,
            labelY: 0.8,
            target: undefined,
          },
        },
      ],
    });
    assert.equal(result.revision, 1);
    assert.equal(await readFile(path.join(root, 'components/card/v1.md'), 'utf8'), content);
    assert.equal(await readFile(path.join(root, 'flows/order/BRIEF.md'), 'utf8'), '# 新流程\n');
    const persisted = JSON.parse(await readFile(path.join(root, sourcePath), 'utf8'));
    assert.equal(persisted.pages[0].annotations[0].label_y, 0.8);
    assert.equal(persisted.pages[0].annotations[0].target, null);
    assert.equal(persisted.pages[0].annotations[0].extension, 'preserved');
    assert.equal(persisted.pages[0].review.status, 'approved');
    assert.equal(result.document.flows[0].nodes[0].annotations[0].text, '新说明');
    assert.equal(result.document.designSystem.components[0].specContent, content);
    assert.ok(result.changedFiles.includes(sourcePath));
    const timeout = setTimeout(
      /** 基于最新状态计算 Timeout 的下一份值，避免连续更新时读到旧状态。 @returns 供 React 保存的新状态。 */
      () => notify(-1),
      3000,
    );
    try {
      assert.equal(await event, 1);
    } finally {
      clearTimeout(timeout);
    }
    assert.equal((await reader.read()).flows[0].brief?.content, '# 新流程\n');
  } finally {
    await watcher.dispose();
    await cleanup();
  }
});

/**
 * 验证rejects stale content and annotations even when external edits did not increment revision。
 * @returns 完成当前检查或生命周期操作。
 */
test('rejects stale content and annotations even when external edits did not increment revision', async () => {
  const { root, workspace, sourcePath, cleanup } = await fixture();
  try {
    const initial = await workspace.read();
    await writeFile(path.join(root, 'components/card/v1.md'), '# External');
    await assert.rejects(
      workspace.apply({
        baseRevision: 0,
        operations: [
          {
            type: 'set-component-spec',
            componentId: 'card',
            version: '1.0.0',
            content: 'stale',
            expectedContent: '# Card\n',
          },
        ],
      }),
      WorkspaceConflictError,
    );
    const raw = JSON.parse(await readFile(path.join(root, sourcePath), 'utf8'));
    raw.pages[0].annotations[0].text = 'external note';
    await writeFile(path.join(root, sourcePath), JSON.stringify(raw));
    const original = initial.flows[0].nodes[0].annotations[0];
    await assert.rejects(
      workspace.apply({
        baseRevision: 0,
        operations: [
          {
            type: 'update-annotation',
            flowId: 'order',
            pageId: 'list',
            expectedAnnotation: original,
            annotation: { ...original, text: 'stale' },
          },
        ],
      }),
      WorkspaceConflictError,
    );
    assert.equal((await workspace.read()).revision, 0);
    assert.equal(await readFile(path.join(root, 'components/card/v1.md'), 'utf8'), '# External');
  } finally {
    await cleanup();
  }
});

/**
 * 验证rejects invalid annotation targets and coordinates without partially saving Markdown。
 * @returns 完成当前检查或生命周期操作。
 */
test('rejects invalid annotation targets and coordinates without partially saving Markdown', async () => {
  const { root, workspace, cleanup } = await fixture();
  try {
    const initial = await workspace.read();
    const original = initial.flows[0].nodes[0].annotations[0];
    for (const patch of [{ target: 'order/missing' }, { x: 2 }, { label: '' }]) {
      await assert.rejects(
        workspace.apply({
          baseRevision: 0,
          operations: [
            {
              type: 'set-flow-brief',
              flowId: 'order',
              content: 'Do not persist',
              expectedContent: '# Order flow',
            },
            {
              type: 'update-annotation',
              flowId: 'order',
              pageId: 'list',
              expectedAnnotation: original,
              annotation: { ...original, ...patch },
            },
          ],
        }),
        WorkspaceInputError,
      );
      assert.equal((await workspace.read()).revision, 0);
      assert.equal(await readFile(path.join(root, 'flows/order/BRIEF.md'), 'utf8'), '# Order flow');
    }
    const invalid = {
      type: 'set-flow-brief',
      flowId: 'order',
      content: 12,
    } as unknown as WorkspaceOperation;
    await assert.rejects(
      workspace.apply({ baseRevision: 0, operations: [invalid] }),
      WorkspaceInputError,
    );
  } finally {
    await cleanup();
  }
});

/**
 * 验证does not edit unregistered Markdown or follow documentation symlinks outside design。
 * @returns 完成当前检查或生命周期操作。
 */
test('does not edit unregistered Markdown or follow documentation symlinks outside design', async () => {
  const { root, workspace, cleanup } = await fixture();
  try {
    await assert.rejects(
      workspace.apply({
        baseRevision: 0,
        operations: [
          {
            type: 'set-component-spec',
            componentId: '../outside',
            version: '1.0.0',
            content: 'bad',
            expectedContent: '',
          },
        ],
      }),
      WorkspaceInputError,
    );
    const outside = path.join(root, '..', 'outside.md');
    await writeFile(outside, '# Private');
    await rm(path.join(root, 'flows/order/BRIEF.md'));
    await symlink(outside, path.join(root, 'flows/order/BRIEF.md'));
    await assert.rejects(
      workspace.apply({
        baseRevision: 0,
        operations: [
          { type: 'set-flow-brief', flowId: 'order', content: 'bad', expectedContent: '# Private' },
        ],
      }),
    );
    assert.equal(await readFile(outside, 'utf8'), '# Private');
  } finally {
    await cleanup();
  }
});
