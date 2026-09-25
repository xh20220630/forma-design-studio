import path from 'node:path';
import type { AnnotationNode, ApplyResult, WorkspaceChangeSet } from '@forma/schema/workbench';
import { assertValidChangeSet } from '../domain/change-set.ts';
import { WorkspaceConflictError, WorkspaceInputError } from '../errors/workspace-errors.ts';
import { acquireLock, commitFiles, releaseLock } from '../infrastructure/filesystem/transaction.ts';
import type { WorkspaceFiles } from '../infrastructure/filesystem/workspace-files.ts';
import type { JsonObject } from '../types/json.ts';
import { arrayValue, isObject, numberValue, stringArray, stringValue } from '../utils/json.ts';
import { readWorkspace } from './load-workspace.ts';

export async function applyChanges(
  storage: WorkspaceFiles,
  changeSet: WorkspaceChangeSet,
): Promise<ApplyResult> {
  assertValidChangeSet(changeSet);
  const lockPath = await acquireLock(storage);
  try {
    const document = await readWorkspace(storage);
    if (changeSet.baseRevision !== document.revision) {
      let changedFiles: string[] = [];
      try {
        const revisionRaw = await storage.readJson('revisions/index.json');
        changedFiles = [
          ...new Set(
            arrayValue(revisionRaw.revisions)
              .filter(isObject)
              .filter((entry) => numberValue(entry.revision) > changeSet.baseRevision)
              .flatMap((entry) => stringArray(entry.files)),
          ),
        ];
      } catch {
        changedFiles = ['project.json'];
      }
      const details = {
        baseRevision: changeSet.baseRevision,
        currentRevision: document.revision,
        changedFiles,
      };
      throw new WorkspaceConflictError(
        `设计版本已从 ${changeSet.baseRevision} 更新为 ${document.revision}${changedFiles.length ? `；已变更：${changedFiles.join('、')}` : ''}。`,
        document.revision,
        details,
      );
    }
    const projectRaw = await storage.readJson('project.json');
    const files = new Map<string, JsonObject | string>();
    for (const operation of changeSet.operations) {
      if (operation.type === 'set-component-spec' || operation.type === 'set-flow-brief') {
        const component =
          operation.type === 'set-component-spec'
            ? document.designSystem.components.find(
                (item) => item.id === operation.componentId && item.version === operation.version,
              )
            : undefined;
        const brief =
          operation.type === 'set-flow-brief'
            ? document.flows.find((item) => item.id === operation.flowId)?.brief
            : undefined;
        const relative = component?.specPath || brief?.path;
        if (!relative || path.extname(relative).toLowerCase() !== '.md')
          throw new WorkspaceInputError('未找到可编辑的 Markdown 文档。');
        const currentContent = await storage.readAssetText(relative);
        if (currentContent !== operation.expectedContent)
          throw new WorkspaceConflictError(
            '文档已被其他操作修改，请重新载入后再编辑。',
            document.revision,
          );
        files.set(relative, operation.content);
        continue;
      }
      const flowId = operation.flowId;
      if (operation.type === 'update-annotation') {
        const flow = document.flows.find((item) => item.id === flowId);
        const node = flow?.nodes.find((item) => item.pageRef === `${flowId}/${operation.pageId}`);
        const current = node?.annotations.find((item) => item.id === operation.annotation.id);
        if (!flow || !current) throw new WorkspaceInputError('待编辑的标注不存在。');
        const keys: (keyof AnnotationNode)[] = [
          'id',
          'label',
          'text',
          'x',
          'y',
          'labelX',
          'labelY',
          'target',
        ];
        if (keys.some((key) => current[key] !== operation.expectedAnnotation[key]))
          throw new WorkspaceConflictError(
            '标注已被其他操作修改，请重新载入后再编辑。',
            document.revision,
          );
        const annotation = operation.annotation;
        if (
          annotation.target &&
          !document.flows.some((item) =>
            item.nodes.some((page) => page.pageRef === annotation.target),
          )
        )
          throw new WorkspaceInputError('标注跳转目标不存在。');
        const pending = files.get(flow.sourcePath);
        const raw = isObject(pending) ? pending : await storage.readAssetJson(flow.sourcePath);
        const page = arrayValue(raw.pages).find(
          (item) => isObject(item) && item.id === operation.pageId,
        );
        if (!isObject(page)) throw new WorkspaceInputError('标注所在页面不存在。');
        page.annotations = arrayValue(page.annotations).map((item) =>
          isObject(item) && item.id === annotation.id
            ? {
                ...item,
                label: annotation.label,
                text: annotation.text,
                x: annotation.x,
                y: annotation.y,
                label_x: annotation.labelX,
                label_y: annotation.labelY,
                target: annotation.target || null,
              }
            : item,
        );
        files.set(flow.sourcePath, raw);
        continue;
      }
      const indexRaw = await storage.readJson('flows/index.json');
      const flowIndex = arrayValue(indexRaw.flows).find(
        (value) => isObject(value) && value.id === flowId,
      );
      if (!isObject(flowIndex)) throw new Error(`流程不存在：${flowId}`);
      const layoutRelative = stringValue(flowIndex.layout_path, `flows/${flowId}/layout.json`);
      const pendingLayout = files.get(layoutRelative);
      let layoutRaw = isObject(pendingLayout) ? pendingLayout : undefined;
      if (!layoutRaw) {
        try {
          layoutRaw = await storage.readJson(layoutRelative);
        } catch {
          layoutRaw = { schema_version: 1, flow_id: flowId, nodes: {} };
        }
      }
      if (operation.type === 'set-node-position') {
        const flow = document.flows.find((item) => item.id === flowId);
        if (!flow?.nodes.some((node) => node.pageRef === `${flowId}/${operation.pageId}`))
          throw new Error(`页面不存在：${flowId}/${operation.pageId}`);
        const nodes = isObject(layoutRaw.nodes) ? layoutRaw.nodes : {};
        nodes[operation.pageId] = { x: operation.x, y: operation.y };
        layoutRaw.nodes = nodes;
      } else {
        layoutRaw.viewport = { x: operation.x, y: operation.y, zoom: operation.zoom };
      }
      files.set(layoutRelative, layoutRaw);
    }
    const nextRevision = document.revision + 1;
    projectRaw.schema_version = 2;
    projectRaw.revision = nextRevision;
    projectRaw.id = stringValue(projectRaw.id, document.project.id);
    const revisionFiles = [...new Set([...files.keys(), 'project.json'])];
    let revisionsRaw: JsonObject;
    try {
      revisionsRaw = await storage.readJson('revisions/index.json');
    } catch {
      revisionsRaw = { schema_version: 1, revisions: [] };
    }
    revisionsRaw.revisions = [
      ...arrayValue(revisionsRaw.revisions),
      {
        revision: nextRevision,
        created_at: new Date().toISOString(),
        source: 'ai-design-workbench',
        operations: changeSet.operations.map((operation) => operation.type),
        files: revisionFiles,
      },
    ];
    files.set('revisions/index.json', revisionsRaw);
    files.set('project.json', projectRaw);
    await commitFiles(storage, files);
    const next = await readWorkspace(storage);
    return { revision: nextRevision, document: next, changedFiles: [...files.keys()] };
  } finally {
    await releaseLock(lockPath);
  }
}
