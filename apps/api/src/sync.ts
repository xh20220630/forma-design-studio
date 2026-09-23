import type { Project } from '@forma/schema';
import type { SyncResult } from './types.ts';
import { errorMessage } from './errors.ts';
import path from 'node:path';
import { requireValue } from './errors.ts';
import { dataRoot, getState, transact, writeJson } from './store.ts';
import { applySync, hasSyncManifest } from './exporter.ts';

export async function synchronize(id: string, { automatic = false, expectedRevision }: { automatic?: boolean; expectedRevision?: unknown } = {}): Promise<SyncResult> {
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

export async function maybeAutoSync(project: Project): Promise<SyncResult> {
  if (!project.workspace?.autoSync) return { project };
  try { return await synchronize(project.id, { automatic: true, expectedRevision: project.revision }); }
  catch (error) { return { project, syncWarning: errorMessage(error) }; }
}
