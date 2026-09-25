import type { Disposable, WorkspaceChangeSet, WorkspaceEvent } from '@forma/schema/workbench';
import { WorkspaceFiles } from '../infrastructure/filesystem/workspace-files.ts';
import { watchRevision } from '../infrastructure/filesystem/watch.ts';
import type { DesignWorkspace } from '../types/workspace.ts';
import { applyChanges } from './apply-changes.ts';
import { loadWorkspace, readWorkspace } from './load-workspace.ts';
import { readLocalState, setLocalViewport } from './local-state.ts';

class FileDesignWorkspace implements DesignWorkspace {
  private readonly storage: WorkspaceFiles;

  private constructor(storage: WorkspaceFiles) {
    this.storage = storage;
  }

  static async open(root: string) {
    return new FileDesignWorkspace(await WorkspaceFiles.open(root));
  }

  async read() {
    return readWorkspace(this.storage);
  }

  async validate() {
    return (await loadWorkspace(this.storage)).report;
  }

  async apply(changeSet: WorkspaceChangeSet) {
    return applyChanges(this.storage, changeSet);
  }

  async watch(listener: (event: WorkspaceEvent) => void): Promise<Disposable> {
    return watchRevision(this.storage, (await this.read()).revision, listener);
  }

  async resolveAsset(relativePath: string) {
    return this.storage.resolveAsset(relativePath);
  }

  async readLocalState() {
    return readLocalState(this.storage);
  }

  async setLocalViewport(flowId: string, viewport: { x: number; y: number; zoom: number }) {
    return setLocalViewport(this.storage, flowId, viewport);
  }
}

/** 以真实根目录打开工作空间；读取和校验由返回的接口按需执行。 */
export async function openDesignWorkspace(options: { root: string }): Promise<DesignWorkspace> {
  return FileDesignWorkspace.open(options.root);
}
