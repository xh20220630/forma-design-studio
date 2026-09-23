import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { WorkspaceChangeSet } from '@forma/schema/workbench';
import { openDesignWorkspace, WorkspaceConflictError, WorkspaceInputError, WorkspaceValidationError } from './index.ts';

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(`${JSON.stringify(value)}\n`);
}

async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 1_000_000) throw new Error('请求数据过大。');
    chunks.push(bytes);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('请求 body 必须是 JSON 对象。');
  return value as Record<string, unknown>;
}

async function safeStaticFile(root: string, pathname: string) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(root, requested);
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return;
  try {
    const resolved = await realpath(candidate);
    const resolvedRelative = path.relative(root, resolved);
    if (resolvedRelative.startsWith('..') || path.isAbsolute(resolvedRelative)) return;
    const info = await stat(resolved);
    if (info.isFile()) return resolved;
  } catch { return; }
}

export interface WorkbenchServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

export async function createWorkbenchServer(options: {
  designRoot: string;
  staticRoot: string;
  port?: number;
  host?: string;
}): Promise<WorkbenchServer> {
  const host = options.host || '127.0.0.1';
  const workspace = await openDesignWorkspace({ root: options.designRoot });
  const staticRoot = await realpath(options.staticRoot);
  const eventClients = new Set<ServerResponse>();
  const disposable = await workspace.watch(event => {
    const payload = `event: revision\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of eventClients) client.write(payload);
  });

  const server = createServer(async (req, res) => {
    try {
      const method = req.method || 'GET';
      const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${host}:0`}`);
      const hostname = (req.headers.host || '').split(':')[0].replace(/^\[|\]$/g, '');
      if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) return json(res, 403, { error: '仅允许本机访问。' });
      const origin = req.headers.origin;
      if (origin && origin !== `http://${req.headers.host}`) return json(res, 403, { error: '请求来源未授权。' });

      if (method === 'GET' && requestUrl.pathname === '/api/document') return json(res, 200, await workspace.read());
      if (method === 'GET' && requestUrl.pathname === '/api/validation') return json(res, 200, await workspace.validate());
      if (method === 'GET' && requestUrl.pathname === '/api/local-state') return json(res, 200, await workspace.readLocalState());
      if (method === 'POST' && requestUrl.pathname === '/api/local-state/viewport') {
        if (!(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: '请求必须使用 application/json。' });
        const value = await body(req);
        if (typeof value.flowId !== 'string' || typeof value.x !== 'number' || typeof value.y !== 'number' || typeof value.zoom !== 'number') throw new WorkspaceInputError('本机视口请求格式无效。');
        return json(res, 200, await workspace.setLocalViewport(value.flowId, { x: value.x, y: value.y, zoom: value.zoom }));
      }
      if (method === 'POST' && requestUrl.pathname === '/api/changes') {
        if (!(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: '请求必须使用 application/json。' });
        return json(res, 200, await workspace.apply(await body(req) as unknown as WorkspaceChangeSet));
      }
      if (method === 'GET' && requestUrl.pathname === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive',
          'X-Content-Type-Options': 'nosniff',
        });
        res.write('event: ready\ndata: {}\n\n');
        eventClients.add(res);
        req.once('close', () => eventClients.delete(res));
        return;
      }
      if (method === 'GET' && requestUrl.pathname.startsWith('/assets/')) {
        const relative = requestUrl.pathname.slice('/assets/'.length).split('/').map(decodeURIComponent).join('/');
        const file = await workspace.resolveAsset(relative);
        res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
        createReadStream(file).pipe(res); return;
      }
      if (requestUrl.pathname.startsWith('/api/')) return json(res, 404, { error: '路径不存在。' });

      const staticFile = await safeStaticFile(staticRoot, requestUrl.pathname) || path.join(staticRoot, 'index.html');
      const content = await readFile(staticFile);
      res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(staticFile)] || 'application/octet-stream', 'Cache-Control': path.basename(staticFile) === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
      res.end(content);
    } catch (error) {
      if (error instanceof WorkspaceConflictError) return json(res, 409, { error: error.message, currentRevision: error.currentRevision, conflict: error.details });
      if (error instanceof WorkspaceInputError) return json(res, 400, { error: error.message });
      if (error instanceof WorkspaceValidationError) return json(res, 422, { error: error.message, report: error.report });
      const status = error instanceof SyntaxError ? 400 : 500;
      json(res, status, { error: error instanceof Error ? error.message : '服务器无法完成请求。' });
    }
  });

  const listen = (port: number) => new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(port, host, () => { server.off('error', onError); resolve(); });
  });
  try { await listen(options.port ?? 0); }
  catch (error) {
    if (options.port && isAddressInUse(error)) await listen(0);
    else throw error;
  }
  const address = server.address() as AddressInfo;
  return {
    url: `http://${host}:${address.port}`,
    port: address.port,
    async close() {
      for (const client of eventClients) client.end();
      eventClients.clear();
      await disposable.dispose();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}

function isAddressInUse(error: unknown): error is NodeJS.ErrnoException {
  return error !== null && typeof error === 'object' && 'code' in error && (error as NodeJS.ErrnoException).code === 'EADDRINUSE';
}
