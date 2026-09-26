import { requireValue } from '../../shared/errors.ts';
import { findProject, mutateProject, removeProject } from '../../infrastructure/storage/store.ts';
import { validateId, validateProject } from '../../services/validation.ts';
import { currentGeneration } from '../../domain/design-context.ts';
import { generateFiles } from '../../services/exporter.ts';
import { maybeAutoSync } from '../../services/sync.ts';
import { Router } from 'express';
import type { ApiRequest } from '../types.ts';

export const projectsRouter = Router();

projectsRouter.get('/api/projects/:id', async (req: ApiRequest, res) =>
  res.json(await findProject(validateId(req.params.id))),
);

projectsRouter.put('/api/projects/:id', async (req: ApiRequest, res) => {
  const id = validateId(req.params.id);
  requireValue(req.body.id === id, '路径 ID 与项目 ID 不一致。');
  const incoming = validateProject(req.body);
  let project = await mutateProject(
    id,
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
});

projectsRouter.delete('/api/projects/:id', async (req: ApiRequest, res) => {
  await removeProject(validateId(req.params.id));
  res.json({ ok: true });
});

projectsRouter.get('/api/projects/:id/export', async (req: ApiRequest, res) => {
  const project = await findProject(validateId(req.params.id));
  res.set('Content-Disposition', `attachment; filename="${project.id}-export.json"`);
  res.json({
    projectId: project.id,
    revision: project.revision,
    files: generateFiles(project).map((file) => ({
      ...file,
      path: `forma-generated/${file.path}`,
    })),
  });
});
