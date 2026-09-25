import type { WorkspaceLocalState } from '@forma/schema/workbench';
import { safeId } from '../domain/constants.ts';
import { WorkspaceInputError } from '../errors/workspace-errors.ts';
import {
  readLocalStateFile,
  writeLocalStateFile,
} from '../infrastructure/filesystem/local-state.ts';
import type { WorkspaceFiles } from '../infrastructure/filesystem/workspace-files.ts';
import { isObject, numberValue } from '../utils/json.ts';
import { readWorkspace } from './load-workspace.ts';

export async function readLocalState(storage: WorkspaceFiles): Promise<WorkspaceLocalState> {
  try {
    const raw = await readLocalStateFile(storage);
    const viewportsRaw = isObject(raw.viewports) ? raw.viewports : {};
    const viewports: WorkspaceLocalState['viewports'] = {};
    for (const [flowId, value] of Object.entries(viewportsRaw))
      if (safeId.test(flowId) && isObject(value)) {
        const zoom = numberValue(value.zoom, 0.35);
        if (Number.isFinite(value.x) && Number.isFinite(value.y) && zoom >= 0.05 && zoom <= 4)
          viewports[flowId] = { x: numberValue(value.x), y: numberValue(value.y), zoom };
      }
    return {
      schemaVersion: 1,
      ...(isObject(raw.skills) ? { skills: raw.skills } : {}),
      viewports,
    };
  } catch {
    return { schemaVersion: 1, viewports: {} };
  }
}

export async function setLocalViewport(
  storage: WorkspaceFiles,
  flowId: string,
  viewport: { x: number; y: number; zoom: number },
): Promise<WorkspaceLocalState> {
  if (
    !safeId.test(flowId) ||
    !Number.isFinite(viewport.x) ||
    !Number.isFinite(viewport.y) ||
    !Number.isFinite(viewport.zoom) ||
    viewport.zoom < 0.05 ||
    viewport.zoom > 4
  )
    throw new WorkspaceInputError('本机视口数据无效。');
  const document = await readWorkspace(storage);
  if (!document.flows.some((flow) => flow.id === flowId))
    throw new WorkspaceInputError(`流程不存在：${flowId}`);
  const state = await readLocalState(storage);
  const next = { ...state, viewports: { ...state.viewports, [flowId]: viewport } };
  await writeLocalStateFile(storage, next);
  return next;
}
