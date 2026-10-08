import { Router } from 'express';
import type { ApiRequest } from '../types.ts';
import { findProject } from '../../infrastructure/storage/store.ts';
import { validateId } from '../../services/validation.ts';
import { brandExportFiles, zipBrandFiles } from '../../services/brand-export.ts';

export const brandRouter = Router();

brandRouter.get('/api/projects/:id/brand/export', async (req: ApiRequest, res) => {
  const project = await findProject(validateId(req.params.id));
  const artifactId = validateId(req.query.artifactId);
  const archive = zipBrandFiles(brandExportFiles(project, artifactId));
  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', `attachment; filename="${project.id}-brand.zip"`);
  res.send(archive);
});
