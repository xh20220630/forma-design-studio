import path from 'node:path';
import { requireValue } from './errors.mjs';
import { dataRoot, getState, transact, writeJson } from './store.mjs';
import { applySync, hasSyncManifest } from './exporter.mjs';

export async function synchronize(id, { automatic = false, expectedRevision } = {}) {
  return transact(async () => {
    const state = await getState(); const project = state.projects.find(item => item.id === id);
    requireValue(project, '项目不存在。', 404);
    if (expectedRevision !== undefined) requireValue(Number(expectedRevision) === project.revision, '预览后设计版本已改变，请重新预览再同步。', 409);
    if (automatic && (!project.workspace?.autoSync || !await hasSyncManifest(project))) return { project };
    const result = await applySync(project);
    project.lastSyncedRevision = project.revision; project.status = 'synced';
    await writeJson(path.join(dataRoot, 'projects.json'), state);
    return { ...result, project };
  });
}

export async function maybeAutoSync(project) {
  if (!project.workspace?.autoSync) return { project };
  try { return await synchronize(project.id, { automatic: true, expectedRevision: project.revision }); }
  catch (error) { return { project, syncWarning: error.message }; }
}
