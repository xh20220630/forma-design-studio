import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=',
  'base64',
);

/**
 * 在临时目录创建旧版工作空间，供兼容性场景使用。
 * @returns 样例工作空间信息。
 */
export async function createV1Workspace() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'forma-workbench-'));
  const root = path.join(projectRoot, 'design');
  await mkdir(root, { recursive: true });
  await mkdir(path.join(root, 'components'), { recursive: true });
  await mkdir(path.join(root, 'flows/order/images'), { recursive: true });
  await writeFile(
    path.join(root, 'project.json'),
    JSON.stringify({
      schema_version: 1,
      name: 'Demo system',
      theme: {
        id: 'demo',
        version: '1.0.0',
        status: 'approved',
        confirmation: 'Chosen',
        design_path: 'DESIGN.md',
        tokens_path: 'tokens.json',
      },
    }),
  );
  await writeFile(path.join(root, 'DESIGN.md'), '# Demo');
  await writeFile(path.join(root, 'flows/order/BRIEF.md'), '# Order flow');
  await writeFile(
    path.join(root, 'tokens.json'),
    JSON.stringify({
      schema_version: 1,
      theme_version: '1.0.0',
      tokens: { color: { primary: '#2563eb' } },
    }),
  );
  await writeFile(
    path.join(root, 'components/index.json'),
    JSON.stringify({ schema_version: 1, components: [] }),
  );
  await writeFile(
    path.join(root, 'flows/index.json'),
    JSON.stringify({
      schema_version: 1,
      flows: [
        { id: 'order', name: 'Order', scope: [], path: 'flows/order/flow.json', related_flows: [] },
      ],
    }),
  );
  await writeFile(path.join(root, 'flows/order/images/list-v1.png'), pixel);
  await writeFile(path.join(root, 'flows/order/images/detail-v1.png'), pixel);
  await writeFile(
    path.join(root, 'flows/order/flow.json'),
    JSON.stringify({
      schema_version: 1,
      id: 'order',
      name: 'Order',
      goal: 'Inspect an order',
      theme_version: '1.0.0',
      brief_path: 'flows/order/BRIEF.md',
      entry_page: 'list',
      consistency_notes: [],
      pages: [
        {
          id: 'list',
          name: 'List',
          kind: 'page',
          platform: 'desktop',
          goal: 'Find an order',
          image: 'flows/order/images/list-v1.png',
          width: 1,
          height: 1,
          component_usage: [],
          review: { status: 'approved', notes: [] },
          annotations: [],
        },
        {
          id: 'detail',
          name: 'Detail',
          kind: 'page',
          platform: 'desktop',
          goal: 'Inspect details',
          image: 'flows/order/images/detail-v1.png',
          width: 1,
          height: 1,
          component_usage: [],
          review: { status: 'needs-revision', notes: ['Missing action'] },
          annotations: [],
        },
      ],
      transitions: [
        {
          from: 'order/list',
          to: 'order/detail',
          trigger: 'Open',
          condition: 'Selected',
          effect: 'Show detail',
        },
      ],
    }),
  );
  return root;
}
