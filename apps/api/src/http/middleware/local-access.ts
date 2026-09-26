import { timingSafeEqual } from 'node:crypto';
import { allowedOrigins } from '../../config/runtime.ts';
import type { RequestHandler } from 'express';

// 避免凭据比较时间泄露匹配前缀。
function constantEqual(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const localAccess: RequestHandler = (req, res, next) => {
  const hostname = req.hostname;
  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname))
    return res.status(403).json({ error: '仅允许本机访问。' });
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin))
    return res.status(403).json({ error: '请求来源未授权。' });
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.sendStatus(204);
  }
  const token = process.env.FORMA_AGENT_TOKEN;
  if (
    token &&
    !origin &&
    req.get('sec-fetch-site') !== 'same-origin' &&
    req.path.startsWith('/api') &&
    req.path !== '/api/health'
  ) {
    const supplied = (req.get('authorization') || '').replace(/^Bearer /, '');
    if (!constantEqual(supplied, token))
      return res.status(401).json({ error: '需要 Agent Bearer Token。' });
  }
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json'))
    return res.status(415).json({ error: '请求必须使用 application/json。' });
  res.set('X-Content-Type-Options', 'nosniff');
  next();
};
