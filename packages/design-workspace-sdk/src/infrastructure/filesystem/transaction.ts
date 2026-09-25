import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { WorkspaceConflictError } from '../../errors/workspace-errors.ts';
import type { JsonObject } from '../../types/json.ts';
import { isObject } from '../../utils/json.ts';
import type { WorkspaceFiles } from './workspace-files.ts';

/** 使用独占锁文件，防止多个进程同时提交。 */
export async function acquireLock(storage: WorkspaceFiles) {
  const directory = path.join(storage.root, '..', '.forma');
  await mkdir(directory, { recursive: true });
  const lockPath = path.join(directory, 'write.lock');
  try {
    const handle = await open(lockPath, 'wx');
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
    );
    await handle.close();
    return lockPath;
  } catch (error) {
    if (isObject(error) && error.code === 'EEXIST')
      throw new WorkspaceConflictError('设计工作区正在被另一个进程写入。');
    throw error;
  }
}
export async function releaseLock(lockPath: string) {
  await rm(lockPath, { force: true });
}

/** 先暂存所有文件；替换失败时按相反顺序恢复备份。 */
export async function commitFiles(
  storage: WorkspaceFiles,
  files: Map<string, JsonObject | string>,
) {
  const staged: Array<{
    target: string;
    /** 正式提交前使用的临时文件路径。 */
    temporary: string;
    /** 替换前保留的备份文件路径。 */
    backup: string;
    /** 相对根目录的资源路径。 */
    relative: string;
    /** 是否已经建立可用于恢复的备份。 */
    backedUp: boolean;
    /** 是否已经完成正式文件替换。 */
    committed: boolean;
  }> = [];
  try {
    for (const [relative, value] of files) {
      const { file: target } = await storage.safeFile(relative);
      await mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(
        temporary,
        typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`,
        { mode: 0o644 },
      );
      staged.push({
        target,
        temporary,
        backup: `${target}.${randomUUID()}.backup`,
        relative,
        backedUp: false,
        committed: false,
      });
    }
    // project.json 的 revision 是提交标记，必须最后替换。
    staged.sort(
      (a, b) => Number(a.relative === 'project.json') - Number(b.relative === 'project.json'),
    );
    for (const item of staged) {
      try {
        await rename(item.target, item.backup);
        item.backedUp = true;
      } catch (error) {
        if (!isObject(error) || error.code !== 'ENOENT') throw error;
      }
      await rename(item.temporary, item.target);
      item.committed = true;
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const item of [...staged].reverse()) {
      try {
        if (item.committed) await rm(item.target, { force: true });
        if (item.backedUp) await rename(item.backup, item.target);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length)
      throw new AggregateError([error, ...rollbackErrors], '设计资产提交失败，且回滚未完整完成。');
    throw error;
  } finally {
    await Promise.all(staged.map((item) => rm(item.temporary, { force: true })));
  }
  await Promise.all(staged.map((item) => rm(item.backup, { force: true })));
}
