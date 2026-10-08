import { requireValue } from '../../shared/errors.ts';
import { findProject, mutateProject } from '../../infrastructure/storage/store.ts';
import { validateId, requireApproved, requireCurrentImage } from '../../services/validation.ts';
import { getReconstructionStatus } from '../../services/reconstruction.ts';
import { generateDesign, generateTheme } from '../../services/generation.ts';
import {
  approvePageImage,
  finishPageReconstruction,
  generatePlanPage,
  startPageGeneration,
} from '../../services/page-generation.ts';
import { maybeAutoSync } from '../../services/sync.ts';
import { Router } from 'express';
import type { ApiRequest } from '../types.ts';

export const generationRouter = Router();

generationRouter.post('/api/generate/image', async (req: ApiRequest, res) => {
  const snapshot = await findProject(validateId(req.body.projectId));
  if (req.body.revision !== undefined)
    requireValue(req.body.revision === snapshot.revision, '项目已更新，请刷新后重试。', 409);
  const project =
    req.body.pageId !== undefined
      ? await generatePlanPage(snapshot, req.body.planId, req.body.pageId)
      : await startPageGeneration(snapshot, req.body.prompt, req.body.pages, req.body.styleGuide);
  res.json({ imageUrl: project.generation?.imageUrl, project });
});

generationRouter.post('/api/generate/approve', async (req: ApiRequest, res) => {
  const project = await mutateProject(validateId(req.body.projectId), (current) => {
    requireValue(current.generation?.imageUrl, '请先生成设计图。', 409);
    if (req.body.revision !== undefined)
      requireValue(req.body.revision === current.revision, '项目已更新，请重新查看设计图。', 409);
    if (req.body.imageUrl !== undefined)
      requireValue(
        req.body.imageUrl === current.generation.imageUrl,
        '设计图已改变，请查看最新图片。',
        409,
      );
    requireCurrentImage(current);
    return approvePageImage(current);
  });
  res.json({ approved: true, project });
});

generationRouter.get('/api/projects/:id/reconstruction', async (req: ApiRequest, res) =>
  res.json(await getReconstructionStatus(await findProject(validateId(req.params.id)))),
);

generationRouter.post('/api/generate/design', async (req: ApiRequest, res) => {
  const snapshot = await findProject(validateId(req.body.projectId));
  requireApproved(snapshot);
  const design = await generateDesign(snapshot, req.body.prompt);
  const project = await mutateProject(snapshot.id, (current) => {
    requireValue(current.revision === snapshot.revision, '还原期间项目已变更，请刷新后重试。', 409);
    requireApproved(current);
    const next = { ...current, ...design, status: 'in-progress' as const };
    return finishPageReconstruction(next);
  });
  const sync = await maybeAutoSync(project);
  res.json({ ...design, ...sync });
});

generationRouter.post('/api/generate/theme', async (req: ApiRequest, res) =>
  res.json(await generateTheme(req.body.prompt)),
);
