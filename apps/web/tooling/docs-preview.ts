import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { normalizePath, type Plugin } from 'vite';

// Keep historical design studies in docs/, outside the application's public assets.
export function docsPreview(docsRoot: string): Plugin {
  return {
    name: 'forma-docs-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/docs/')) return next();
        const [pathname, query] = request.url.split('?');
        // Vite owns the cached modules generated from inline HTML scripts.
        if (new URLSearchParams(query).has('html-proxy')) return next();
        let relative: string;
        try { relative = decodeURIComponent(pathname.slice('/docs/'.length)); }
        catch { return next(); }
        const filename = path.resolve(docsRoot, relative + (relative.endsWith('/') || !relative ? 'index.html' : ''));
        if (!filename.startsWith(`${docsRoot}${path.sep}`)) return next();
        if (filename.endsWith('.html')) {
          try {
            const html = await readFile(filename, 'utf8');
            const url = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
            const transformed = await server.transformIndexHtml(url, html);
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end(transformed);
          } catch (error) { next(error); }
          return;
        }
        request.url = `/@fs/${normalizePath(filename)}${query ? `?${query}` : ''}`;
        next();
      });
    },
  };
}
