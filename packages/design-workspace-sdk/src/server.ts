import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { WorkspaceChangeSet } from '@forma/schema/workbench';
import {
  openDesignWorkspace,
  WorkspaceConflictError,
  WorkspaceInputError,
  WorkspaceValidationError,
} from './index.ts';

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

/**
 * 把数据转换为统一的 JSON 表达。
 *
 * @param res - 当前 HTTP 响应对象。
 * @param status - 对象当前所处状态，决定后续可执行操作。
 * @param value - 当前字段、模式或控件的取值。
 * @returns 无返回值；通过副作用完成当前操作。
 */
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(`${JSON.stringify(value)}\n`);
}

/**
 * 收集并解析 HTTP 请求正文，同时限制体积以避免无界内存增长。
 *
 * @param req - 当前 HTTP 请求。
 * @returns 解析后的请求数据。
 */
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
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('请求 body 必须是 JSON 对象。');
  return value as Record<string, unknown>;
}

/**
 * 将请求路径约束在静态目录内，避免静态资源接口读取任意文件。
 *
 * @param root - 路径解析与访问检查共同使用的根目录。
 * @param pathname - 请求 URL 中的路径部分。
 * @returns 安全的静态文件路径。
 */
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
  } catch {
    return;
  }
}

/** 本地工作台 HTTP 服务的生命周期接口。 */
export interface WorkbenchServer {
  /** 资源或服务的访问地址。 */
  url: string;
  /** 服务监听端口；0 通常表示由系统分配可用端口。 */
  port: number;
  /**
   * 关闭当前界面或服务，结束其生命周期。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  close(): Promise<void>;
}

/**
 * 把工作空间访问封装为 HTTP 与事件流接口，供本地工作台使用。
 *
 * @param options - 本次操作的配置选项。
 * @returns 可监听和关闭的工作台服务。
 */
export async function createWorkbenchServer(options: {
  /** 设计文档与素材所在的根目录。 */
  designRoot: string;
  /** 前端静态文件的根目录。 */
  staticRoot: string;
  /** 服务监听端口；0 通常表示由系统分配可用端口。 */
  port?: number;
  /** HTTP 服务监听的主机地址。 */
  host?: string;
}): Promise<WorkbenchServer> {
  const host = options.host || '127.0.0.1';
  const workspace = await openDesignWorkspace({ root: options.designRoot });
  const staticRoot = await realpath(options.staticRoot);
  const eventClients = new Set<ServerResponse>();
  const disposable = await workspace.watch(
    /**
     * 执行 createWorkbenchServer 传入的局部处理步骤，使调用处能够控制结果如何更新。
     *
     * @param event - 当前事件及其触发位置。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    (event) => {
      const payload = `event: revision\ndata: ${JSON.stringify(event)}\n\n`;
      for (const client of eventClients) client.write(payload);
    },
  );

  const server = createServer(
    /**
     * 执行 createWorkbenchServer 传入的局部处理步骤，使调用处能够控制结果如何更新。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 完成当前异步操作的 Promise，不携带业务数据。
     */
    async (req, res) => {
      try {
        const method = req.method || 'GET';
        const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${host}:0`}`);
        const hostname = (req.headers.host || '').split(':')[0].replace(/^\[|\]$/g, '');
        if (!['127.0.0.1', 'localhost', '::1'].includes(hostname))
          return json(res, 403, { error: '仅允许本机访问。' });
        const origin = req.headers.origin;
        if (origin && origin !== `http://${req.headers.host}`)
          return json(res, 403, { error: '请求来源未授权。' });

        if (method === 'GET' && requestUrl.pathname === '/api/document')
          return json(res, 200, await workspace.read());
        if (method === 'GET' && requestUrl.pathname === '/api/validation')
          return json(res, 200, await workspace.validate());
        if (method === 'GET' && requestUrl.pathname === '/api/local-state')
          return json(res, 200, await workspace.readLocalState());
        if (method === 'POST' && requestUrl.pathname === '/api/local-state/viewport') {
          if (!(req.headers['content-type'] || '').startsWith('application/json'))
            return json(res, 415, { error: '请求必须使用 application/json。' });
          const value = await body(req);
          if (
            typeof value.flowId !== 'string' ||
            typeof value.x !== 'number' ||
            typeof value.y !== 'number' ||
            typeof value.zoom !== 'number'
          )
            throw new WorkspaceInputError('本机视口请求格式无效。');
          return json(
            res,
            200,
            await workspace.setLocalViewport(value.flowId, {
              x: value.x,
              y: value.y,
              zoom: value.zoom,
            }),
          );
        }
        if (method === 'POST' && requestUrl.pathname === '/api/changes') {
          if (!(req.headers['content-type'] || '').startsWith('application/json'))
            return json(res, 415, { error: '请求必须使用 application/json。' });
          return json(
            res,
            200,
            await workspace.apply((await body(req)) as unknown as WorkspaceChangeSet),
          );
        }
        if (method === 'GET' && requestUrl.pathname === '/api/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Content-Type-Options': 'nosniff',
          });
          res.write('event: ready\ndata: {}\n\n');
          eventClients.add(res);
          req.once(
            'close',
            /** 响应 close 事件，推进 createWorkbenchServer 的状态更新。 @returns 条件是否成立的布尔值。 */
            () => eventClients.delete(res),
          );
          return;
        }
        if (method === 'GET' && requestUrl.pathname.startsWith('/assets/')) {
          const relative = requestUrl.pathname
            .slice('/assets/'.length)
            .split('/')
            .map(decodeURIComponent)
            .join('/');
          const file = await workspace.resolveAsset(relative);
          res.writeHead(200, {
            'Content-Type':
              mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
            'X-Content-Type-Options': 'nosniff',
          });
          createReadStream(file).pipe(res);
          return;
        }
        if (requestUrl.pathname.startsWith('/api/'))
          return json(res, 404, { error: '路径不存在。' });

        const staticFile =
          (await safeStaticFile(staticRoot, requestUrl.pathname)) ||
          path.join(staticRoot, 'index.html');
        const content = await readFile(staticFile);
        res.writeHead(200, {
          'Content-Type': mimeTypes[path.extname(staticFile)] || 'application/octet-stream',
          'Cache-Control':
            path.basename(staticFile) === 'index.html'
              ? 'no-cache'
              : 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(content);
      } catch (error) {
        if (error instanceof WorkspaceConflictError)
          return json(res, 409, {
            error: error.message,
            currentRevision: error.currentRevision,
            conflict: error.details,
          });
        if (error instanceof WorkspaceInputError) return json(res, 400, { error: error.message });
        if (error instanceof WorkspaceValidationError)
          return json(res, 422, { error: error.message, report: error.report });
        /** 集中维护 status 的约定值或当前状态，供相关分支保持一致。 */
        const status = error instanceof SyntaxError ? 400 : 500;
        json(res, status, {
          error: error instanceof Error ? error.message : '服务器无法完成请求。',
        });
      }
    },
  );

  /**
   * 启动本地监听并处理端口占用，让命令行拿到实际可访问的地址。
   *
   * @param port - 服务监听端口；0 通常表示由系统分配可用端口。
   * @returns 服务开始监听后的结果。
   */
  const listen = (port: number) =>
    new Promise<void>(
      /**
       * 把 listen 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。
       *
       * @param resolve - 异步操作成功时调用的完成函数。
       * @param reject - 异步操作失败时调用的拒绝函数。
       * @returns 无返回值；通过 resolve 或 reject 结束等待。
       */
      (resolve, reject) => {
        /**
         * 把启动阶段的监听错误交给等待方，避免启动流程一直挂起。
         *
         * @param error - 当前操作的失败信息，供界面反馈或重试判断。
         * @returns 无返回值；拒绝当前启动等待。
         */
        const onError = (error: Error) => reject(error);
        server.once('error', onError);
        server.listen(
          port,
          host,
          /**
           * 执行 listen 传入的局部处理步骤，使调用处能够控制结果如何更新。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          () => {
            server.off('error', onError);
            resolve();
          },
        );
      },
    );
  try {
    await listen(options.port ?? 0);
  } catch (error) {
    if (options.port && isAddressInUse(error)) await listen(0);
    else throw error;
  }
  const address = server.address() as AddressInfo;
  return {
    url: `http://${host}:${address.port}`,
    port: address.port,
    /**
     * 关闭当前界面或服务，结束其生命周期。
     * @returns 完成当前异步操作的 Promise，不携带业务数据。
     */
    async close() {
      for (const client of eventClients) client.end();
      eventClients.clear();
      await disposable.dispose();
      await new Promise<void>(
        /**
         * 把 close 中的回调式操作接入 Promise，以便调用方等待完成或处理失败。
         *
         * @param resolve - 异步操作成功时调用的完成函数。
         * @param reject - 异步操作失败时调用的拒绝函数。
         * @returns 无返回值；通过 resolve 或 reject 结束等待。
         */
        (resolve, reject) =>
          server.close(
            /** 执行 close 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param error - 当前操作的失败信息，供界面反馈或重试判断。 @returns 无返回值；通过副作用完成当前操作。 */
            (error) => (error ? reject(error) : resolve()),
          ),
      );
    },
  };
}

/**
 * 识别端口占用错误，以便服务选择可用端口或给出明确提示。
 *
 * @param error - 当前操作的失败信息，供界面反馈或重试判断。
 * @returns 是否为 EADDRINUSE 错误。
 */
function isAddressInUse(error: unknown): error is NodeJS.ErrnoException {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
  );
}
