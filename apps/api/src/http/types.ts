import type { Request } from 'express';

// requireJsonObject 在业务路由执行前拒绝非对象正文。
export type ApiRequest = Request<Record<string, string>, unknown, Record<string, unknown>>;
