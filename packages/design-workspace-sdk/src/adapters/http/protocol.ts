import type { IncomingMessage, ServerResponse } from 'node:http';

/** 把数据转换为统一的 JSON 表达。 */
export function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(`${JSON.stringify(value)}\n`);
}
/** 收集并解析 HTTP 请求正文，同时限制体积以避免无界内存增长。 */
export async function body(req: IncomingMessage) {
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
