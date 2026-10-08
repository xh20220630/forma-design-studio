import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { AgentProcess } from './process.ts';
import { findExecutable, agentDefinitions } from './discovery.ts';
import type { BridgeOptions, LocalAgentId, AgentModelCatalog } from './types.ts';

export async function listAgentModels(
  agentId: LocalAgentId,
  options: BridgeOptions,
  signal?: AbortSignal,
): Promise<AgentModelCatalog> {
  const definition = agentDefinitions.find((agent) => agent.id === agentId);
  if (!definition) throw new Error('不支持此本地 Agent。');
  const executable = await findExecutable(agentId, options.executables?.[agentId]);
  if (!executable) throw new Error('未找到本地 Agent，请安装 CLI 并确保它位于 PATH。');
  signal?.throwIfAborted();
  if (agentId !== 'codex')
    return {
      models: [{ id: 'default', name: `${definition.name} · CLI 默认模型` }],
      source: 'default-only',
    };
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'forma-agent-models-'));
  let child: AgentProcess | undefined;
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason || new Error('模型列表查询已取消。'));
  const stop = () => child?.fail(controller.signal.reason);
  signal?.addEventListener('abort', abort, { once: true });
  controller.signal.addEventListener('abort', stop, { once: true });
  const timer = setTimeout(
    () => controller.abort(new Error('读取 CLI 模型列表超时，请检查登录状态和 CLI 版本。')),
    20000,
  );
  try {
    child = await AgentProcess.start(executable, ['app-server', '--stdio'], cwd);
    controller.signal.throwIfAborted();
    signal?.throwIfAborted();
    await child.request('initialize', {
      clientInfo: { name: 'forma-model-catalog', version: '0.1.0' },
    });
    child.send({ jsonrpc: '2.0', method: 'initialized' });
    const models = new Map<string, AgentModelCatalog['models'][number]>();
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const result = await child.request('model/list', {
        limit: 100,
        includeHidden: false,
        ...(cursor ? { cursor } : {}),
      });
      if (!Array.isArray(result?.data))
        throw new Error('CLI 未返回有效模型列表，请更新 CLI 后重试。');
      for (const item of result.data) {
        if (typeof item.model !== 'string' || !item.model || item.hidden === true) continue;
        models.set(item.model, {
          id: item.model,
          name: typeof item.displayName === 'string' ? item.displayName : item.model,
          isDefault: item.isDefault === true,
        });
      }
      if (!result.nextCursor) return { models: [...models.values()], source: 'cli' };
      if (typeof result.nextCursor !== 'string' || seen.has(result.nextCursor))
        throw new Error('CLI 模型目录分页无效。');
      const nextCursor: string = result.nextCursor;
      cursor = nextCursor;
      seen.add(nextCursor);
    }
    throw new Error('CLI 模型目录超过分页限制。');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', stop);
    if (child) {
      await child.stop();
      await child.closed.catch(() => {});
    }
    await rm(cwd, { recursive: true, force: true });
  }
}
