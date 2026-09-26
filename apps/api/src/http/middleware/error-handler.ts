import type { ErrorRequestHandler } from 'express';
import { errorProperty, errorMessage, errorStatus, ApiError } from '../../shared/errors.ts';

export const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const status =
    errorStatus(error) || (errorProperty(error, 'type') === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500 && !(error instanceof ApiError)) console.error(errorMessage(error));
  res.status(status).json({
    error:
      error instanceof ApiError
        ? error.message
        : status === 400
          ? '请求 JSON 格式无效。'
          : status === 413
            ? '请求数据过大。'
            : status === 404
              ? '资源不存在。'
              : '服务器无法完成请求，请查看终端日志。',
  });
};
