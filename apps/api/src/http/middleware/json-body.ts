import { requireValue } from '../../shared/errors.ts';
import type { RequestHandler } from 'express';

export const requireJsonObject: RequestHandler = (req, _res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method))
    requireValue(
      req.body && typeof req.body === 'object' && !Array.isArray(req.body),
      '请求 body 必须是 JSON 对象。',
    );
  next();
};
