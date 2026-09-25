import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { openDesignWorkspace, WorkspaceConflictError } from '@forma/design-workspace-sdk';
import { exportStaticReview } from '@forma/design-workspace-sdk/static-review';
import { createV1Workspace } from '../helpers/fixture.ts';

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
      document.flows[0].edges.map((edge) => [edge.id, edge.from, edge.to]),
      [['order/list-to-order/detail', 'order/list', 'order/detail']],
    );
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

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
      () => workspace.apply({ baseRevision: 0, operations: [] }),
      (error) =>
        error instanceof WorkspaceConflictError &&
        error.currentRevision === 1 &&
        error.details?.changedFiles.includes('flows/order/layout.json') === true,
    );
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

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
        .find((impact) => impact.pageRef === page.pageRef)
        ?.reasons.map((reason) => reason.type)
        .sort(),
      ['component', 'tokens'],
    );
    const report = await workspace.validate();
    assert.equal(report.valid, true);
    assert.equal(
      report.issues.some((item) => item.code.includes('review')),
      false,
    );
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

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
      report.issues.some((item) => item.code === 'missing-token-group'),
      true,
    );
    assert.equal(
      report.issues.some((item) => item.code === 'missing-close-transition'),
      true,
    );
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

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
