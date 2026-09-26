import { findProject, mutateProject } from '../../infrastructure/storage/store.ts';
import { validateId } from '../../services/validation.ts';
import { previewSync } from '../../services/exporter.ts';
import { bindWorkspace } from '../../services/workspaces.ts';
import { synchronize } from '../../services/sync.ts';
import { Router } from 'express';
import type { ApiRequest } from '../types.ts';

export const workspaceRouter = Router();

workspaceRouter.post('/api/workspace/bind', async (req: ApiRequest, res) => {
  const snapshot = await findProject(validateId(req.body.projectId));
  const workspace = await bindWorkspace(snapshot, req.body);
  const project = await mutateProject(snapshot.id, (current) => ({
    ...current,
    workspace,
    lastSyncedRevision: undefined,
  }));
  res.json({ workspace, project });
});

workspaceRouter.post('/api/sync/preview', async (req: ApiRequest, res) =>
  res.json(await previewSync(await findProject(validateId(req.body.projectId)))),
);

workspaceRouter.post('/api/sync/apply', async (req: ApiRequest, res) =>
  res.json(
    await synchronize(validateId(req.body.projectId), { expectedRevision: req.body.revision }),
  ),
);
