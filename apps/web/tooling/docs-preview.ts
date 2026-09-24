import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { normalizePath, type Plugin } from 'vite';

// Keep historical design studies in docs/, outside the application's public assets.
/**
 * 创建文档预览插件，使开发服务能够访问仓库根目录下的设计文档。
 *
 * @param docsRoot - 文档预览允许访问的根目录。
 * @returns Vite 插件定义。
 */
export function docsPreview(docsRoot: string): Plugin {
  return {
    name: 'forma-docs-preview',
    apply: 'serve',
    /**
     * 给开发服务挂载文档目录入口，避免将工程素材复制到生产资源。
     *
     * @param server - 当前 HTTP 或开发服务器对象。
     * @returns 无返回值；注册开发中间件。
     */
    configureServer(server) {
      server.middlewares.use(
        /**
         * 执行 configureServer 传入的局部处理步骤，使调用处能够控制结果如何更新。
         *
         * @param request - 当前请求或待处理的请求参数。
         * @param response - 上游或本地服务的响应。
         * @param next - 后续值或中间件入口。
         * @returns 当前步骤的处理结果。
         */
        async (request, response, next) => {
          if (!request.url?.startsWith('/docs/')) return next();
          const [pathname, query] = request.url.split('?');
          // Vite owns the cached modules generated from inline HTML scripts.
          if (new URLSearchParams(query).has('html-proxy')) return next();
          let relative: string;
          try {
            relative = decodeURIComponent(pathname.slice('/docs/'.length));
          } catch {
            return next();
          }
          const filename = path.resolve(
            docsRoot,
            relative + (relative.endsWith('/') || !relative ? 'index.html' : ''),
          );
          if (!filename.startsWith(`${docsRoot}${path.sep}`)) return next();
          if (filename.endsWith('.html')) {
            try {
              const html = await readFile(filename, 'utf8');
              const url = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
              const transformed = await server.transformIndexHtml(url, html);
              response.setHeader('Content-Type', 'text/html; charset=utf-8');
              response.end(transformed);
            } catch (error) {
              next(error);
            }
            return;
          }
          request.url = `/@fs/${normalizePath(filename)}${query ? `?${query}` : ''}`;
          next();
        },
      );
    },
  };
}
