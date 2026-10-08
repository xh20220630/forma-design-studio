import { createServer, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { LocalAgentBridge } from './index.ts';
import { LocalAgentRequestError } from './errors.ts';
import type { AgentRunOptions, BridgeOptions } from './types.ts';

export interface BridgeServerOptions extends BridgeOptions {
  token: string;
  allowedOrigins?: string[];
}

/** The host grants access with a token and exact client origins; arbitrary web pages cannot launch local processes. */
export function createBridgeServer(options: BridgeServerOptions) {
  if (!options.token || options.token.length < 16)
    throw new Error('桥接 Token 至少需要 16 个字符。');
  const bridge = new LocalAgentBridge(options);
  const origins = new Set(options.allowedOrigins || []);
  const runs = new Map<string, AbortController>();
  const json = (res: ServerResponse, status: number, payload: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  };
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    const host = (req.headers.host || '').split(':')[0];
    if (!['localhost', '127.0.0.1'].includes(host))
      return json(res, 403, { error: '仅允许本机访问。' });
    const origin = req.headers.origin;
    if (origin && !origins.has(origin)) return json(res, 403, { error: '请求来源未授权。' });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization,Content-Type,Accept',
      });
      return res.end();
    }
    const supplied = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
    const expected = Buffer.from(options.token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      return json(res, 401, { error: '需要桥接 Bearer Token。' });
    let runId = '';
    let streaming = false;
    try {
      const route = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      if (req.method === 'GET' && route === '/agents')
        return json(res, 200, { agents: await bridge.discover() });
      if (req.method === 'GET' && /^\/agents\/(codex|claude|kimi)\/models$/.test(route))
        return json(
          res,
          200,
          await bridge.listModels(route.split('/')[2] as AgentRunOptions['agentId']),
        );
      if (req.method === 'DELETE' && /^\/runs\/[^/]+$/.test(route)) {
        const controller = runs.get(route.slice('/runs/'.length));
        if (!controller) return json(res, 404, { error: '运行任务不存在。' });
        controller.abort(new Error('客户端已取消本地 Agent 请求。'));
        return json(res, 200, { cancelled: true });
      }
      if (req.method !== 'POST' || route !== '/runs')
        return json(res, 404, { error: '桥接路径不存在。' });
      if (!req.headers['content-type']?.startsWith('application/json'))
        return json(res, 415, { error: '请求必须使用 application/json。' });
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 25 * 1024 * 1024) return json(res, 413, { error: '请求超过 25 MB 限制。' });
        chunks.push(chunk);
      }
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return json(res, 400, { error: '请求 JSON 无效。' });
      }
      if (!input || Array.isArray(input) || typeof input !== 'object')
        return json(res, 400, { error: '请求必须是 JSON 对象。' });
      const controller = new AbortController();
      res.once('close', () => {
        if (!res.writableEnded) controller.abort(new Error('客户端已断开连接。'));
      });
      streaming = req.headers.accept?.includes('text/event-stream') || false;
      const event = (type: string, payload: unknown) => {
        if (!res.destroyed) res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
      };
      if (streaming) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          Connection: 'keep-alive',
        });
        res.flushHeaders();
      }
      const result = await bridge.run({
        agentId: input.agentId as AgentRunOptions['agentId'],
        messages: input.messages as AgentRunOptions['messages'],
        model: input.model as string | undefined,
        reasoningEffort: input.reasoningEffort as AgentRunOptions['reasoningEffort'],
        task: input.task as AgentRunOptions['task'],
        transparentBackground: input.transparentBackground as boolean | undefined,
        timeoutMs: input.timeoutMs as number | undefined,
        signal: controller.signal,
        onEvent: (update) => {
          if (update.type === 'started') {
            runId = update.runId;
            runs.set(runId, controller);
          }
          if (streaming && (update.type === 'started' || update.type === 'text'))
            event(update.type, update);
        },
      });
      if (streaming) {
        event('completed', result);
        res.end();
      } else json(res, 200, result);
    } catch (error) {
      const details =
        error instanceof LocalAgentRequestError
          ? { upstreamStatus: error.upstreamStatus, upstreamCode: error.upstreamCode }
          : {};
      if (!res.destroyed) {
        if (streaming) {
          res.write(
            `event: error\ndata: ${JSON.stringify({ runId, error: (error as Error).message, ...details })}\n\n`,
          );
          res.end();
        } else json(res, 502, { error: (error as Error).message, ...details });
      }
    } finally {
      if (runId) runs.delete(runId);
    }
  });
  server.on('close', () => bridge.close());
  return { server, bridge };
}
