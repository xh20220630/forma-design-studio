import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { openDesignWorkspace, WorkspaceConflictError } from '../src/index.ts';
import { exportStaticReview } from '../src/static-review.ts';
import { createV1Workspace } from './fixture.ts';

/**
 * 验证reads a v1 delivery as an image-node flow document。
 * @returns 完成当前检查或生命周期操作。
 */
test('reads a v1 delivery as an image-node flow document', async () => {
  const root = await createV1Workspace();
  try {
    const workspace = await openDesignWorkspace({ root });
    const document = await workspace.read();
    assert.equal(document.project.schemaVersion, 1);
    assert.equal(document.revision, 0);
    assert.equal(document.flows[0].nodes[0].id, 'order/list');
    assert.deepEqual(document.flows[0].nodes[0].image, {
      id: 'order/list/image',
      type: 'image',
      assetPath: 'flows/order/images/list-v1.png',
      width: 1,
      height: 1,
      intrinsicWidth: 1,
      intrinsicHeight: 1,
      locked: true,
    });
    assert.deepEqual(
      document.flows[0].edges.map(
        /** 转换 workspace.test 中的集合条目，供后续处理或展示。 @param edge - 连接两个页面的流程边。 @returns 当前条目转换后的结果。 */
        (edge) => [edge.id, edge.from, edge.to],
      ),
      [['order/list-to-order/detail', 'order/list', 'order/detail']],
    );
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

/**
 * 验证applies layout changes with revision conflict protection。
 * @returns 完成当前检查或生命周期操作。
 */
test('applies layout changes with revision conflict protection', async () => {
  const root = await createV1Workspace();
  try {
    const workspace = await openDesignWorkspace({ root });
    const result = await workspace.apply({
      baseRevision: 0,
      operations: [
        { type: 'set-node-position', flowId: 'order', pageId: 'detail', x: 2400, y: 320 },
        { type: 'set-default-viewport', flowId: 'order', x: 120, y: 80, zoom: 0.42 },
      ],
    });
    assert.equal(result.revision, 1);
    assert.deepEqual(result.document.flows[0].nodes[1].frame, {
      x: 2400,
      y: 320,
      width: 1,
      height: 1,
    });
    assert.deepEqual(result.document.flows[0].defaultViewport, { x: 120, y: 80, zoom: 0.42 });
    const revisions = JSON.parse(
      await readFile(path.join(root, 'revisions/index.json'), 'utf8'),
    ) as {
      /** 收到或记录的文档修订号序列。 */
      revisions: Array<{
        /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
        revision: number;
        /** 当前操作涉及的文件或文件摘要集合。 */
        files: string[];
      }>;
    };
    assert.equal(revisions.revisions[0].revision, 1);
    assert.equal(revisions.revisions[0].files.includes('flows/order/layout.json'), true);
    await assert.rejects(
      /** 执行 workspace.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 当前步骤的处理结果。 */
      () => workspace.apply({ baseRevision: 0, operations: [] }),
      /** 执行 workspace.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param error - 当前操作的失败信息，供界面反馈或重试判断。 @returns 条件是否成立的布尔值。 */
      (error) =>
        error instanceof WorkspaceConflictError &&
        error.currentRevision === 1 &&
        error.details?.changedFiles.includes('flows/order/layout.json') === true,
    );
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

/**
 * 验证ignores legacy review metadata and reports token and component upgrade impacts。
 * @returns 完成当前检查或生命周期操作。
 */
test('ignores legacy review metadata and reports token and component upgrade impacts', async () => {
  const root = await createV1Workspace();
  try {
    await mkdir(path.join(root, 'components/resource-card'), { recursive: true });
    await writeFile(path.join(root, 'components/resource-card/v1.md'), '# Resource Card 1.0.0');
    await writeFile(path.join(root, 'components/resource-card/v2.md'), '# Resource Card 2.0.0');
    await writeFile(
      path.join(root, 'components/index.json'),
      JSON.stringify({
        schema_version: 2,
        components: [
          {
            id: 'resource-card',
            version: '1.0.0',
            name: 'Resource Card',
            status: 'approved',
            scope: [],
            excludes: [],
            tags: [],
            spec_path: 'components/resource-card/v1.md',
          },
          {
            id: 'resource-card',
            version: '2.0.0',
            name: 'Resource Card',
            status: 'approved',
            scope: [],
            excludes: [],
            tags: [],
            spec_path: 'components/resource-card/v2.md',
          },
        ],
      }),
    );
    const flowPath = path.join(root, 'flows/order/flow.json');
    const flow = JSON.parse(await readFile(flowPath, 'utf8')) as {
      /** 文件格式中保存的主题版本。 */
      theme_version: string;
      /** 项目包含的设计页面。 */
      pages: Array<Record<string, unknown>>;
    };
    flow.theme_version = '0.9.0';
    flow.pages[0].image_revision = 2;
    flow.pages[0].component_usage = [
      { id: 'resource-card', version: '1.0.0', adaptation: 'legacy card' },
    ];
    flow.pages[0].review = { status: 'approved', notes: [], reviewed_image_revision: 1 };
    await writeFile(flowPath, JSON.stringify(flow));

    const workspace = await openDesignWorkspace({ root });
    const document = await workspace.read();
    const page = document.flows[0].nodes[0];
    assert.equal('review' in page, false);
    assert.deepEqual(
      document.designSystem.impacts
        .find(
          /** 检查 impact 的pageRef等于页面的pageRef，供集合筛选或定位使用。 @param impact - 当前页面的版本影响记录。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (impact) => impact.pageRef === page.pageRef,
        )
        ?.reasons.map(
          /** 提取 reason 的类型，供后续计算或展示使用。 @param reason - 本次影响或失败的原因。 @returns reason的类型。 */
          (reason) => reason.type,
        )
        .sort(),
      ['component', 'tokens'],
    );
    const report = await workspace.validate();
    assert.equal(report.valid, true);
    assert.equal(
      report.issues.some(
        /** 检查条目的code包含“review”，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (item) => item.code.includes('review'),
      ),
      false,
    );
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

/**
 * 验证requires all seven v2 token groups and a semantic modal exit。
 * @returns 完成当前检查或生命周期操作。
 */
test('requires all seven v2 token groups and a semantic modal exit', async () => {
  const root = await createV1Workspace();
  try {
    await writeFile(
      path.join(root, 'tokens.json'),
      JSON.stringify({ schema_version: 2, theme_version: '1.0.0', tokens: { color: {} } }),
    );
    const flowPath = path.join(root, 'flows/order/flow.json');
    const flow = JSON.parse(await readFile(flowPath, 'utf8')) as {
      /** 项目包含的设计页面。 */
      pages: Array<Record<string, unknown>>;
      /** 页面之间的跳转定义集合。 */
      transitions: Array<Record<string, unknown>>;
    };
    flow.pages[1].kind = 'modal';
    flow.pages[1].parent = 'order/list';
    flow.transitions.push({
      from: 'order/detail',
      to: 'order/list',
      trigger: '继续浏览',
      condition: '已查看',
      effect: '显示列表',
    });
    await writeFile(flowPath, JSON.stringify(flow));
    const report = await (await openDesignWorkspace({ root })).validate();
    assert.equal(report.valid, false);
    assert.equal(
      report.issues.some(
        /** 检查条目的code等于“missing-token-group”，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (item) => item.code === 'missing-token-group',
      ),
      true,
    );
    assert.equal(
      report.issues.some(
        /** 检查条目的code等于“missing-close-transition”，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (item) => item.code === 'missing-close-transition',
      ),
      true,
    );
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

/**
 * 验证exports a portable review with embedded image assets。
 * @returns 完成当前检查或生命周期操作。
 */
test('exports a portable review with embedded image assets', async () => {
  const root = await createV1Workspace();
  const output = path.join(root, '..', `${path.basename(root)}-review.html`);
  try {
    await exportStaticReview({ designRoot: root, output });
    const html = await readFile(output, 'utf8');
    assert.match(html, /src="data:image\/png;base64,/);
    assert.equal(html.includes('flows/order/images/list-v1.png'), false);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
    await rm(output, { force: true });
  }
});
