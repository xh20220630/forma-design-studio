import type { Project } from '@forma/schema';
import type { SyncResult } from './types.ts';
import { errorMessage } from './errors.ts';
import path from 'node:path';
import { requireValue } from './errors.ts';
import { dataRoot, getState, transact, writeJson } from './store.ts';
import { applySync, hasSyncManifest } from './exporter.ts';

/**
 * 核对设计版本后同步代码；自动同步还要求已有同步清单。
 *
 * @param id - 唯一标识，用于查找、更新和建立引用。
 * @param arg2 - 按字段解构的输入，字段用途见对应类型定义。
 * @param arg2.automatic - 是否由自动同步触发，自动流程需要已建立同步基线。
 * @param arg2.expectedRevision - 调用方预期的当前版本；不匹配时应拒绝覆盖。
 * @returns 最新项目与同步结果。
 */
export async function synchronize(
  id: string,
  {
    automatic = false,
    expectedRevision,
  }: {
    /** 是否由自动同步触发，自动流程需要已建立同步基线。 */
    automatic?: boolean;
    /** 调用方预期的当前版本；不匹配时应拒绝覆盖。 */
    expectedRevision?: unknown;
  } = {},
): Promise<SyncResult> {
  return transact(
    /**
     * 在串行事务内完成 synchronize 的状态修改，避免并发写入覆盖彼此。
     * @returns 当前步骤的处理结果。
     */
    async () => {
      const state = await getState();
      const project = state.projects.find(
        /** 检查条目的标识是否与目标标识一致，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (item) => item.id === id,
      );
      requireValue(project, '项目不存在。', 404);
      if (expectedRevision !== undefined)
        requireValue(
          Number(expectedRevision) === project.revision,
          '预览后设计版本已改变，请重新预览再同步。',
          409,
        );
      if (automatic && (!project.workspace?.autoSync || !(await hasSyncManifest(project))))
        return { project };
      const result = await applySync(project);
      project.lastSyncedRevision = project.revision;
      project.status = 'synced';
      await writeJson(path.join(dataRoot, 'projects.json'), state);
      return { ...result, project };
    },
  );
}

/**
 * 在启用自动同步时尝试同步，将失败转为提示以保留已经保存的设计。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 项目和可选的同步警告。
 */
export async function maybeAutoSync(project: Project): Promise<SyncResult> {
  if (!project.workspace?.autoSync) return { project };
  try {
    return await synchronize(project.id, { automatic: true, expectedRevision: project.revision });
  } catch (error) {
    return { project, syncWarning: errorMessage(error) };
  }
}
