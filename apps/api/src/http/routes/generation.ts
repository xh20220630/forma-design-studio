import { requireValue } from '../../shared/errors.ts';
import { findProject, mutateProject } from '../../infrastructure/storage/store.ts';
import { validateId, requireApproved, requireCurrentImage } from '../../services/validation.ts';
import { designContextHash } from '../../domain/design-context.ts';
import { getReconstructionStatus } from '../../services/reconstruction.ts';
import { generateDesign, generateImage, generateTheme } from '../../services/generation.ts';
import { maybeAutoSync } from '../../services/sync.ts';
import { Router } from 'express';
import type { ApiRequest } from '../types.ts';

export const generationRouter = Router();

generationRouter.post('/api/generate/image', async (req: ApiRequest, res) => {
  const snapshot = await findProject(validateId(req.body.projectId));
  const generation = await generateImage(snapshot, req.body.prompt);
  const project = await mutateProject(snapshot.id, (current) => {
    requireValue(
      current.revision === snapshot.revision,
      '生成期间项目已变更，请重试以保持设计一致。',
      409,
    );
    return { ...current, generation, status: 'in-progress' };
  });
  res.json({ imageUrl: generation.imageUrl, project });
});

generationRouter.post('/api/generate/approve', async (req: ApiRequest, res) => {
  const project = await mutateProject(validateId(req.body.projectId), (current) => {
    requireValue(current.generation?.imageUrl, '请先生成设计图。', 409);
    requireCurrentImage(current);
    return { ...current, generation: { ...current.generation, approved: true } };
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
    next.generation = { ...current.generation, contextHash: designContextHash(next) };
    return next;
  });
  const sync = await maybeAutoSync(project);
  res.json({ ...design, ...sync });
});

generationRouter.post('/api/generate/theme', async (req: ApiRequest, res) =>
  res.json(await generateTheme(req.body.prompt)),
);
