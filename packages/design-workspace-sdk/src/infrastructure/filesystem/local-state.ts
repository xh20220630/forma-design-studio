import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { WorkspaceLocalState } from '@forma/schema/workbench';
import type { WorkspaceFiles } from './workspace-files.ts';
import { readJson } from './json.ts';

function localStateFile(storage: WorkspaceFiles) {
  return path.join(storage.root, '..', '.forma', 'local-state.json');
}
export async function readLocalStateFile(storage: WorkspaceFiles) {
  return readJson(localStateFile(storage));
}
export async function writeLocalStateFile(storage: WorkspaceFiles, state: WorkspaceLocalState) {
  const file = localStateFile(storage);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}
