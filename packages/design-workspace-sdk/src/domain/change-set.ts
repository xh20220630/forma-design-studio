import type { WorkspaceChangeSet } from '@forma/schema/workbench';
import { WorkspaceInputError } from '../errors/workspace-errors.ts';
import { isObject, numberValue } from '../utils/json.ts';

export function assertValidChangeSet(changeSet: unknown): asserts changeSet is WorkspaceChangeSet {
  const rawChangeSet: unknown = changeSet;
  if (
    !isObject(rawChangeSet) ||
    !Number.isInteger(rawChangeSet.baseRevision) ||
    numberValue(rawChangeSet.baseRevision, -1) < 0 ||
    !Array.isArray(rawChangeSet.operations)
  ) {
    throw new WorkspaceInputError('ChangeSet 必须包含非负整数 baseRevision 和 operations 数组。');
  }
  for (const operation of rawChangeSet.operations) {
    if (!isObject(operation)) throw new WorkspaceInputError('存在无效的工作区操作。');
    if (operation.type === 'set-component-spec' || operation.type === 'set-flow-brief') {
      if (typeof operation.content !== 'string' || typeof operation.expectedContent !== 'string')
        throw new WorkspaceInputError('文档操作必须包含正文和编辑前的正文。');
      if (
        operation.type === 'set-component-spec' &&
        (typeof operation.componentId !== 'string' || typeof operation.version !== 'string')
      )
        throw new WorkspaceInputError('组件操作必须指定组件和版本。');
      if (operation.type === 'set-flow-brief' && typeof operation.flowId !== 'string')
        throw new WorkspaceInputError('流程文档操作必须指定流程。');
    } else if (operation.type === 'update-annotation') {
      if (
        typeof operation.flowId !== 'string' ||
        typeof operation.pageId !== 'string' ||
        !isObject(operation.expectedAnnotation)
      )
        throw new WorkspaceInputError('标注操作必须指定流程、页面和编辑前的标注。');
      const annotation = operation.annotation;
      if (
        !isObject(annotation) ||
        typeof annotation.id !== 'string' ||
        typeof annotation.label !== 'string' ||
        !annotation.label.trim() ||
        typeof annotation.text !== 'string' ||
        (annotation.target !== undefined && typeof annotation.target !== 'string')
      )
        throw new WorkspaceInputError('标注必须包含 ID、标题和正文。');
      if (
        ['x', 'y', 'labelX', 'labelY'].some(
          (key) =>
            typeof annotation[key] !== 'number' ||
            !Number.isFinite(annotation[key]) ||
            numberValue(annotation[key], -1) < 0 ||
            numberValue(annotation[key], 2) > 1,
        )
      )
        throw new WorkspaceInputError('标注坐标必须位于 0–1。');
    } else if (
      operation.type === 'set-node-position' ||
      operation.type === 'set-default-viewport'
    ) {
      if (
        typeof operation.flowId !== 'string' ||
        !Number.isFinite(operation.x) ||
        !Number.isFinite(operation.y)
      )
        throw new WorkspaceInputError('布局操作必须包含有效流程和有限坐标。');
      if (operation.type === 'set-node-position' && typeof operation.pageId !== 'string')
        throw new WorkspaceInputError('节点位置操作必须包含 pageId。');
      if (
        operation.type === 'set-default-viewport' &&
        (!Number.isFinite(operation.zoom) ||
          numberValue(operation.zoom) < 0.05 ||
          numberValue(operation.zoom) > 4)
      )
        throw new WorkspaceInputError('视口缩放必须位于 0.05–4。');
    } else throw new WorkspaceInputError('存在无效的工作区操作。');
  }
}
