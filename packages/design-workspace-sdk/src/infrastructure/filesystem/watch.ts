import { watchFile, unwatchFile } from 'node:fs';
import path from 'node:path';
import type { Disposable, WorkspaceEvent } from '@forma/schema/workbench';
import { numberValue } from '../../utils/json.ts';
import { readJson } from './json.ts';
import type { WorkspaceFiles } from './workspace-files.ts';

export async function watchRevision(
  storage: WorkspaceFiles,
  revision: number,
  listener: (event: WorkspaceEvent) => void,
): Promise<Disposable> {
  const file = path.join(storage.root, 'project.json');

  const handler = async () => {
    try {
      const next = numberValue((await readJson(file)).revision, 0);
      if (next !== revision) {
        revision = next;
        listener({ type: 'revision', revision: next });
      }
    } catch {
      /* ignore transient writes; project.json is the commit marker */
    }
  };
  watchFile(file, { interval: 250, persistent: false }, handler);
  return {
    async dispose() {
      unwatchFile(file, handler);
    },
  };
}
