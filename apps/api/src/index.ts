import type { Request, ErrorRequestHandler } from 'express';
import { errorProperty, errorMessage, errorStatus } from './errors.ts';

// The JSON middleware below rejects non-object bodies before any route executes.
/** 路由请求约定，用于描述请求参数或正文。 */
type ApiRequest = Request<Record<string, string>, unknown, Record<string, unknown>>;
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { apiPort, allowedOrigins, webDist } from './config.ts';
import { ApiError, requireValue } from './errors.ts';
import { dataRoot, findProject, getState, mutateProject, removeProject } from './store.ts';
import { validateId, validateProject, requireApproved, requireCurrentImage } from './validate.ts';
import { currentGeneration, designContextHash } from './design-context.ts';
import { generateFiles, previewSync } from './exporter.ts';
import { getReconstructionStatus } from './reconstruction.ts';
import {
  generateDesign,
  generateImage,
  generateTheme,
  getProviderSettings,
  saveProviderSettings,
} from './provider.ts';
import {
  saveProvider,
  deleteProvider,
  getPrivateProvider,
  validateProvider,
  saveModelBindings,
} from './provider-settings.ts';
import { listProviderModels } from './provider-transport.ts';
import { bindWorkspace } from './workspaces.ts';
import {
  createAgentSession,
  getAgentSession,
  listAgentSessions,
  sendAgentMessage,
} from './agent.ts';
import { maybeAutoSync, synchronize } from './sync.ts';

/**
 * 采用等时比较核对访问凭据，减少比较过程泄露内容的可能性。
 *
 * @param actual - 实际读取或计算得到的值。
 * @param expected - 用于比较的预期值或基线版本。
 * @returns 两个凭据是否相同。
 */
function constantEqual(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * 组装 API 路由、中间件和静态资源入口，让服务启动和独立调用共用配置。
 * @returns 配置完成的 Express 应用。
 */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    /**
     * 处理 USE 中间件请求，在此处衔接输入校验与业务操作。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @param next - 后续值或中间件入口。
     * @returns 通过 HTTP 响应或后续中间件返回结果。
     */
    (req, res, next) => {
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
    },
  );
  app.use(express.json({ limit: '25mb' }));
  app.use(
    /**
     * 处理 USE 中间件请求，在此处衔接输入校验与业务操作。
     *
     * @param req - 当前 HTTP 请求。
     * @param _res - 本处理器不使用的响应对象。
     * @param next - 后续值或中间件入口。
     * @returns 通过 HTTP 响应或后续中间件返回结果。
     */
    (req, _res, next) => {
      if (['POST', 'PUT', 'PATCH'].includes(req.method))
        requireValue(
          req.body && typeof req.body === 'object' && !Array.isArray(req.body),
          '请求 body 必须是 JSON 对象。',
        );
      next();
    },
  );
  app.get(
    '/api/health',
    /** 处理 GET /api/health，在此处衔接输入校验与业务操作。 @param _req - 本处理器不使用的请求对象。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (_req, res) =>
      res.json({
        ok: true,
        service: 'forma',
        providerConfigured: (await getProviderSettings()).configured,
      }),
  );
  app.get(
    '/api/state',
    /** 处理 GET /api/state，在此处衔接输入校验与业务操作。 @param _req - 本处理器不使用的请求对象。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (_req, res) => res.json(await getState()),
  );
  app.get(
    '/api/agent/sessions',
    /** 处理 GET /api/agent/sessions，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) =>
      res.json({ sessions: await listAgentSessions(req.query.projectId) }),
  );
  app.post(
    '/api/agent/sessions',
    /** 处理 POST /api/agent/sessions，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) => res.status(201).json(await createAgentSession(req.body)),
  );
  app.get(
    '/api/agent/sessions/:id',
    /** 处理 GET /api/agent/sessions/:id，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) => res.json(await getAgentSession(req.params.id)),
  );
  app.post(
    '/api/agent/sessions/:id/messages',
    /**
     * 处理 POST /api/agent/sessions/:id/messages，在此处衔接输入校验与业务操作。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 通过 HTTP 响应或后续中间件返回结果。
     */
    async (req: ApiRequest, res) => {
      const result = await sendAgentMessage(req.params.id, req.body);
      res.status(result.status).json(result.body);
    },
  );
  app.get(
    '/api/projects/:id',
    /** 处理 GET /api/projects/:id，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) => res.json(await findProject(validateId(req.params.id))),
  );
  app.put(
    '/api/projects/:id',
    /**
     * 处理 PUT /api/projects/:id，在此处衔接输入校验与业务操作。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 通过 HTTP 响应或后续中间件返回结果。
     */
    async (req: ApiRequest, res) => {
      const id = validateId(req.params.id);
      requireValue(req.body.id === id, '路径 ID 与项目 ID 不一致。');
      const incoming = validateProject(req.body);
      let project = await mutateProject(
        id,
        /**
         * 执行 createApp 传入的局部处理步骤，使调用处能够控制结果如何更新。
         *
         * @param current - 更新前的当前值。
         * @returns 当前步骤的处理结果。
         */
        (current) => {
          if (current)
            requireValue(
              Number(incoming.revision) === current.revision,
              '项目已被其他会话更新，请刷新后再保存。',
              409,
            );
          return {
            ...incoming,
            workspace: current?.workspace
              ? { ...current.workspace, autoSync: Boolean(incoming.workspace?.autoSync) }
              : undefined,
            generation: currentGeneration(current, incoming),
            lastSyncedRevision: current?.lastSyncedRevision,
            status: current?.status === 'synced' ? 'in-progress' : incoming.status || 'draft',
          };
        },
        { create: true },
      );
      const sync = await maybeAutoSync(project);
      project = sync.project;
      res.json({ ...project, ...(sync.syncWarning ? { syncWarning: sync.syncWarning } : {}) });
    },
  );
  app.delete(
    '/api/projects/:id',
    /**
     * 处理 DELETE /api/projects/:id，在此处衔接输入校验与业务操作。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 通过 HTTP 响应或后续中间件返回结果。
     */
    async (req: ApiRequest, res) => {
      await removeProject(validateId(req.params.id));
      res.json({ ok: true });
    },
  );
  app.get(
    '/api/settings',
    /** 处理 GET /api/settings，在此处衔接输入校验与业务操作。 @param _req - 本处理器不使用的请求对象。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (_req, res) => res.json(await getProviderSettings()),
  );
  app.post(
    '/api/settings',
    /** 处理 POST /api/settings，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) => res.json(await saveProviderSettings(req.body)),
  );
  app.post(
    '/api/providers',
    /** 处理 POST /api/providers，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) => res.status(201).json(await saveProvider(req.body)),
  );
  app.put(
    '/api/providers/:id',
    /** 处理 PUT /api/providers/:id，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) => res.json(await saveProvider(req.body, req.params.id)),
  );
  app.delete(
    '/api/providers/:id',
    /** 处理 DELETE /api/providers/:id，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) => res.json(await deleteProvider(req.params.id)),
  );
  app.post(
    '/api/settings/models',
    /** 处理 POST /api/settings/models，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) => res.json(await saveModelBindings(req.body)),
  );
  app.get(
    '/api/providers/:id/models',
    /** 处理 GET /api/providers/:id/models，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) =>
      res.json(await listProviderModels(await getPrivateProvider(req.params.id))),
  );
  app.post(
    '/api/providers/probe',
    /**
     * 处理 POST /api/providers/probe，在此处衔接输入校验与业务操作。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 通过 HTTP 响应或后续中间件返回结果。
     */
    async (req: ApiRequest, res) => {
      const current =
        typeof req.body.id === 'string' ? await getPrivateProvider(req.body.id) : undefined;
      const provider = validateProvider(req.body, current);
      const start = Date.now();
      const result = await listProviderModels(provider);
      res.json({ ...result, latencyMs: Date.now() - start });
    },
  );
  app.post(
    '/api/generate/image',
    /**
     * 处理 POST /api/generate/image，在此处衔接输入校验与业务操作。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 通过 HTTP 响应或后续中间件返回结果。
     */
    async (req: ApiRequest, res) => {
      const snapshot = await findProject(validateId(req.body.projectId));
      const generation = await generateImage(snapshot, req.body.prompt);
      const project = await mutateProject(
        snapshot.id,
        /**
         * 执行 createApp 传入的局部处理步骤，使调用处能够控制结果如何更新。
         *
         * @param current - 更新前的当前值。
         * @returns 当前步骤的处理结果。
         */
        (current) => {
          requireValue(
            current.revision === snapshot.revision,
            '生成期间项目已变更，请重试以保持设计一致。',
            409,
          );
          return { ...current, generation, status: 'in-progress' };
        },
      );
      res.json({ imageUrl: generation.imageUrl, project });
    },
  );
  app.post(
    '/api/generate/approve',
    /**
     * 处理 POST /api/generate/approve，在此处衔接输入校验与业务操作。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 通过 HTTP 响应或后续中间件返回结果。
     */
    async (req: ApiRequest, res) => {
      const project = await mutateProject(
        validateId(req.body.projectId),
        /**
         * 执行 createApp 传入的局部处理步骤，使调用处能够控制结果如何更新。
         *
         * @param current - 更新前的当前值。
         * @returns 当前步骤的处理结果。
         */
        (current) => {
          requireValue(current.generation?.imageUrl, '请先生成设计图。', 409);
          requireCurrentImage(current);
          return { ...current, generation: { ...current.generation, approved: true } };
        },
      );
      res.json({ approved: true, project });
    },
  );
  app.get(
    '/api/projects/:id/reconstruction',
    /** 处理 GET /api/projects/:id/reconstruction，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) =>
      res.json(await getReconstructionStatus(await findProject(validateId(req.params.id)))),
  );
  app.post(
    '/api/generate/design',
    /**
     * 处理 POST /api/generate/design，在此处衔接输入校验与业务操作。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 通过 HTTP 响应或后续中间件返回结果。
     */
    async (req: ApiRequest, res) => {
      const snapshot = await findProject(validateId(req.body.projectId));
      requireApproved(snapshot);
      const design = await generateDesign(snapshot, req.body.prompt);
      const project = await mutateProject(
        snapshot.id,
        /**
         * 执行 createApp 传入的局部处理步骤，使调用处能够控制结果如何更新。
         *
         * @param current - 更新前的当前值。
         * @returns 当前步骤的处理结果。
         */
        (current) => {
          requireValue(
            current.revision === snapshot.revision,
            '还原期间项目已变更，请刷新后重试。',
            409,
          );
          requireApproved(current);
          const next = { ...current, ...design, status: 'in-progress' as const };
          next.generation = { ...current.generation, contextHash: designContextHash(next) };
          return next;
        },
      );
      const sync = await maybeAutoSync(project);
      res.json({ ...design, ...sync });
    },
  );
  app.post(
    '/api/generate/theme',
    /** 处理 POST /api/generate/theme，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) => res.json(await generateTheme(req.body.prompt)),
  );
  app.post(
    '/api/workspace/bind',
    /**
     * 处理 POST /api/workspace/bind，在此处衔接输入校验与业务操作。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 通过 HTTP 响应或后续中间件返回结果。
     */
    async (req: ApiRequest, res) => {
      const snapshot = await findProject(validateId(req.body.projectId));
      const workspace = await bindWorkspace(snapshot, req.body);
      const project = await mutateProject(
        snapshot.id,
        /** 执行 createApp 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param current - 更新前的当前值。 @returns 当前步骤的处理结果。 */
        (current) => ({ ...current, workspace, lastSyncedRevision: undefined }),
      );
      res.json({ workspace, project });
    },
  );
  app.post(
    '/api/sync/preview',
    /** 处理 POST /api/sync/preview，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) =>
      res.json(await previewSync(await findProject(validateId(req.body.projectId)))),
  );
  app.post(
    '/api/sync/apply',
    /** 处理 POST /api/sync/apply，在此处衔接输入校验与业务操作。 @param req - 当前 HTTP 请求。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    async (req: ApiRequest, res) =>
      res.json(
        await synchronize(validateId(req.body.projectId), { expectedRevision: req.body.revision }),
      ),
  );
  app.get(
    '/api/projects/:id/export',
    /**
     * 处理 GET /api/projects/:id/export，在此处衔接输入校验与业务操作。
     *
     * @param req - 当前 HTTP 请求。
     * @param res - 当前 HTTP 响应对象。
     * @returns 通过 HTTP 响应或后续中间件返回结果。
     */
    async (req: ApiRequest, res) => {
      const project = await findProject(validateId(req.params.id));
      res.set('Content-Disposition', `attachment; filename="${project.id}-export.json"`);
      res.json({
        projectId: project.id,
        revision: project.revision,
        files: generateFiles(project).map(
          /** 转换 createApp 中的集合条目，供后续处理或展示。 @param file - 需要读取、写入或导入的文件。 @returns 当前条目转换后的结果。 */
          (file) => ({ ...file, path: `forma-generated/${file.path}` }),
        ),
      });
    },
  );
  app.use(
    '/api/assets',
    express.static(path.join(dataRoot, 'assets'), {
      dotfiles: 'deny',
      fallthrough: false,
      immutable: true,
      maxAge: '1y',
    }),
  );
  app.use(
    '/api',
    /** 处理 USE /api，在此处衔接输入校验与业务操作。 @param _req - 本处理器不使用的请求对象。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
    (_req, res) => res.status(404).json({ error: 'API 路径不存在。' }),
  );
  const dist = webDist;
  if (existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(
      '/{*path}',
      /** 处理 GET /{*path}，在此处衔接输入校验与业务操作。 @param _req - 本处理器不使用的请求对象。 @param res - 当前 HTTP 响应对象。 @returns 通过 HTTP 响应或后续中间件返回结果。 */
      (_req, res) => res.sendFile(path.join(dist, 'index.html')),
    );
  }
  /**
   * 将异常统一转换为 JSON 响应，使客户端可以一致地处理失败。
   *
   * @param error - 当前操作的失败信息，供界面反馈或重试判断。
   * @param _req - 本处理器不使用的请求对象。
   * @param res - 当前 HTTP 响应对象。
   * @param _next - 本错误处理中不使用的后续中间件入口。
   * @returns 无返回值；错误通过 HTTP 响应发出。
   */
  const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    /** 集中维护 status 的约定值或当前状态，供相关分支保持一致。 */
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
  app.use(handleError);
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(
    apiPort,
    '127.0.0.1',
    /** 执行 index 传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 无返回值；通过副作用完成当前操作。 */
    () => console.log(`Forma API: http://127.0.0.1:${apiPort}`),
  );
}
