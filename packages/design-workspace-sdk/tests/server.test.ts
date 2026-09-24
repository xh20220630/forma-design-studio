import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createWorkbenchServer } from '../src/server.ts';
import { createV1Workspace } from './fixture.ts';

/**
 * 验证serves the workbench document, assets, writes, and rejects foreign origins。
 * @returns 完成当前检查或生命周期操作。
 */
test('serves the workbench document, assets, writes, and rejects foreign origins', async () => {
  const designRoot = await createV1Workspace();
  const staticRoot = await mkdtemp(path.join(os.tmpdir(), 'forma-workbench-static-'));
  await mkdir(path.join(staticRoot, 'assets'), { recursive: true });
  await writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>Workbench</title>');
  await writeFile(path.join(staticRoot, 'assets/app.js'), 'console.log("workbench")');
  await symlink(path.join(designRoot, 'project.json'), path.join(staticRoot, 'leak.json'));
  const blocker = createServer(
    /** 执行 server.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param _request - 当前处理步骤不使用的请求对象。 @param response - 上游或本地服务的响应。 @returns 当前步骤的处理结果。 */
    (_request, response) => response.end('occupied'),
  );
  await new Promise<void>(
    /**
     * 把 server.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。
     *
     * @param resolve - 异步操作成功时调用的完成函数。
     * @param reject - 异步操作失败时调用的拒绝函数。
     * @returns 无返回值；通过 resolve 或 reject 结束等待。
     */
    (resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(0, '127.0.0.1', resolve);
    },
  );
  const occupiedPort = (blocker.address() as AddressInfo).port;
  const server = await createWorkbenchServer({ designRoot, staticRoot, port: occupiedPort });
  assert.notEqual(server.port, occupiedPort);
  try {
    const documentResponse = await fetch(`${server.url}/api/document`);
    assert.equal(documentResponse.status, 200);
    const document = (await documentResponse.json()) as {
      /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
      revision: number;
      /** 工作空间包含的业务流程。 */
      flows: Array<{
        /** 按约定顺序保存的设计节点集合。 */
        nodes: unknown[];
      }>;
    };
    assert.equal(document.revision, 0);
    assert.equal(document.flows[0].nodes.length, 2);

    const assetResponse = await fetch(`${server.url}/assets/flows/order/images/list-v1.png`);
    assert.equal(assetResponse.status, 200);
    assert.equal(assetResponse.headers.get('content-type'), 'image/png');

    const viewportResponse = await fetch(`${server.url}/api/local-state/viewport`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: server.url },
      body: JSON.stringify({ flowId: 'order', x: 80, y: 64, zoom: 0.4 }),
    });
    assert.equal(viewportResponse.status, 200);
    assert.deepEqual(
      (
        (await viewportResponse.json()) as {
          /** 各流程在本机最后使用的视口位置。 */
          viewports: Record<string, unknown>;
        }
      ).viewports.order,
      { x: 80, y: 64, zoom: 0.4 },
    );

    const changeResponse = await fetch(`${server.url}/api/changes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: server.url },
      body: JSON.stringify({
        baseRevision: 0,
        operations: [{ type: 'set-node-position', flowId: 'order', pageId: 'list', x: 120, y: 80 }],
      }),
    });
    assert.equal(changeResponse.status, 200);
    assert.equal(
      (
        (await changeResponse.json()) as {
          /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
          revision: number;
        }
      ).revision,
      1,
    );

    const removedReviewResponse = await fetch(`${server.url}/api/changes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: server.url },
      body: JSON.stringify({
        baseRevision: 1,
        operations: [
          { type: 'set-review', pageRef: 'order/list', review: { status: 'approved', notes: [] } },
        ],
      }),
    });
    assert.equal(removedReviewResponse.status, 400);

    const conflictResponse = await fetch(`${server.url}/api/changes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: server.url },
      body: JSON.stringify({ baseRevision: 0, operations: [] }),
    });
    assert.equal(conflictResponse.status, 409);

    const foreignResponse = await fetch(`${server.url}/api/document`, {
      headers: { origin: 'https://malicious.example' },
    });
    assert.equal(foreignResponse.status, 403);
    assert.deepEqual(await foreignResponse.json(), { error: '请求来源未授权。' });

    const appResponse = await fetch(`${server.url}/deep/link`);
    assert.equal(await appResponse.text(), '<!doctype html><title>Workbench</title>');
    const symlinkResponse = await fetch(`${server.url}/leak.json`);
    assert.equal(await symlinkResponse.text(), '<!doctype html><title>Workbench</title>');

    const invalidChange = await fetch(`${server.url}/api/changes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: server.url },
      body: JSON.stringify({
        baseRevision: 1,
        operations: [
          { type: 'set-node-position', flowId: 'order', pageId: 'list', x: 'bad', y: 1 },
        ],
      }),
    });
    assert.equal(invalidChange.status, 400);
  } finally {
    await server.close();
    await new Promise<void>(
      /**
       * 把 server.test 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。
       *
       * @param resolve - 异步操作成功时调用的完成函数。
       * @param reject - 异步操作失败时调用的拒绝函数。
       * @returns 无返回值；通过 resolve 或 reject 结束等待。
       */
      (resolve, reject) =>
        blocker.close(
          /** 执行 server.test 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param error - 当前操作的失败信息，供界面反馈或重试判断。 @returns 无返回值；通过副作用完成当前操作。 */
          (error) => (error ? reject(error) : resolve()),
        ),
    );
    await rm(path.dirname(designRoot), { recursive: true, force: true });
    await rm(staticRoot, { recursive: true, force: true });
  }
});
