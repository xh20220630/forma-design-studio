import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export const mimeTypes: Record<string, string> = {
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
/** 将请求路径约束在静态目录内，避免静态资源接口读取任意文件。 */
export async function safeStaticFile(root: string, pathname: string) {
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
