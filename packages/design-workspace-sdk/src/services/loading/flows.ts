import path from 'node:path';
import type {
  AnnotationNode,
  ComponentReference,
  FlowEdge,
  FlowPageNode,
  PageKind,
  Platform,
  ProjectMeta,
  ValidationIssue,
  WorkspaceFlow,
} from '@forma/schema/workbench';
import {
  pageKinds,
  platforms,
  safeId,
  supportedImages,
  transitionIntents,
} from '../../domain/constants.ts';
import { parseImageRevision } from '../../domain/image-revision.ts';
import { automaticPositions } from '../../domain/layout.ts';
import { imageSize } from '../../infrastructure/images/dimensions.ts';
import type { WorkspaceFiles } from '../../infrastructure/filesystem/workspace-files.ts';
import type { JsonObject } from '../../types/json.ts';
import { arrayValue, isObject, numberValue, stringArray, stringValue } from '../../utils/json.ts';
import { issue } from '../../utils/validation.ts';

export async function loadFlows(
  flowsRaw: JsonObject,
  project: ProjectMeta,
  componentKeys: Set<string>,
  storage: WorkspaceFiles,
  issues: ValidationIssue[],
) {
  const flowEntries = arrayValue(flowsRaw.flows).filter(isObject);
  const flowIds = new Set(flowEntries.map((value) => stringValue(value.id)).filter(Boolean));
  const relatedByFlow = new Map(
    flowEntries.map((value) => [stringValue(value.id), new Set(stringArray(value.related_flows))]),
  );
  const pageRefs = new Set<string>();
  const flows: WorkspaceFlow[] = [];
  for (const entry of flowEntries) {
    const flowId = stringValue(entry.id);
    const flowPath = stringValue(entry.path);
    if (!safeId.test(flowId) || !flowPath) {
      issue(issues, 'error', 'invalid-flow', 'flows/index.json', '流程必须包含有效 ID 和路径。');
      continue;
    }
    for (const related of stringArray(entry.related_flows))
      if (!flowIds.has(related))
        issue(
          issues,
          'error',
          'missing-related-flow',
          'flows/index.json',
          `关联流程不存在：${related}`,
        );
    let flowRaw: JsonObject;
    try {
      flowRaw = await storage.readJson(flowPath, issues);
    } catch (error) {
      issue(
        issues,
        'error',
        'missing-flow',
        flowPath,
        error instanceof Error ? error.message : '流程文件无法读取。',
      );
      continue;
    }
    const flowSchema = numberValue(flowRaw.schema_version, 1) === 2 ? 2 : 1;
    if (stringValue(flowRaw.id, flowId) !== flowId)
      issue(
        issues,
        'error',
        'flow-id-mismatch',
        flowPath,
        `流程文件 ID 与索引不一致：${stringValue(flowRaw.id)}`,
      );
    const briefPath = stringValue(flowRaw.brief_path);
    let brief: WorkspaceFlow['brief'];
    if (briefPath) {
      try {
        brief = {
          path: briefPath,
          content: await storage.readAssetText(briefPath),
        };
      } catch {
        issue(issues, 'error', 'missing-flow-brief', briefPath, `流程 BRIEF 不存在：${flowId}`);
      }
    } else if (flowSchema === 2)
      issue(
        issues,
        'error',
        'missing-flow-brief',
        flowPath,
        `v2 流程必须声明 brief_path：${flowId}`,
      );
    const pagesRaw = arrayValue(flowRaw.pages).filter(isObject);
    const transitionsRaw = arrayValue(flowRaw.transitions).filter(isObject);
    const layoutPath = stringValue(entry.layout_path, `flows/${flowId}/layout.json`);
    let layoutRaw: JsonObject = {};
    try {
      layoutRaw = await storage.readJson(layoutPath);
    } catch {
      /* layout is optional */
    }
    const layoutNodes = isObject(layoutRaw.nodes) ? layoutRaw.nodes : {};
    const pageDimensions = pagesRaw.map((page) => ({
      id: stringValue(page.id),
      width: numberValue(page.width),
      height: numberValue(page.height),
    }));
    const positions = automaticPositions(
      pageDimensions,
      transitionsRaw,
      stringValue(flowRaw.entry_page),
    );
    const nodes: FlowPageNode[] = [];
    const localPageIds = new Set<string>();
    for (const pageRaw of pagesRaw) {
      const pageId = stringValue(pageRaw.id);
      const pageRef = `${flowId}/${pageId}`;
      const pageFile = `${flowPath}#${pageId}`;
      if (!safeId.test(pageId))
        issue(issues, 'error', 'invalid-page-id', pageFile, `页面 ID 无效：${pageId}`);
      if (localPageIds.has(pageId))
        issue(issues, 'error', 'duplicate-page', pageFile, `页面 ID 重复：${pageId}`);
      localPageIds.add(pageId);
      pageRefs.add(pageRef);
      const kind = stringValue(pageRaw.kind, 'page') as PageKind;
      const platform = stringValue(pageRaw.platform, 'desktop') as Platform;
      if (!pageKinds.has(kind))
        issue(issues, 'error', 'invalid-page-kind', pageFile, `页面类型无效：${kind}`);
      if (!platforms.has(platform))
        issue(issues, 'error', 'invalid-platform', pageFile, `平台无效：${platform}`);
      const parent = typeof pageRaw.parent === 'string' ? pageRaw.parent : undefined;
      if (kind !== 'page' && !parent)
        issue(issues, 'error', 'missing-parent', pageFile, `${kind} 必须声明 parent。`);
      const assetPath = stringValue(pageRaw.image);
      const ext = path.extname(assetPath).toLowerCase();
      if (!supportedImages.has(ext))
        issue(
          issues,
          'error',
          'unsupported-image',
          pageFile,
          `不支持的图片格式：${ext || '<none>'}`,
        );
      let intrinsic = { width: 0, height: 0 };
      try {
        intrinsic = await imageSize(await storage.resolveAsset(assetPath));
      } catch (error) {
        issue(
          issues,
          'error',
          'invalid-image',
          assetPath,
          error instanceof Error ? error.message : '图片无法读取。',
        );
      }
      const width = numberValue(pageRaw.width, intrinsic.width),
        height = numberValue(pageRaw.height, intrinsic.height);
      if (intrinsic.width && (width !== intrinsic.width || height !== intrinsic.height)) {
        issue(
          issues,
          'error',
          'image-size-mismatch',
          pageFile,
          `记录尺寸 ${width}×${height} 与图片实际尺寸 ${intrinsic.width}×${intrinsic.height} 不一致。`,
        );
      }
      const componentUsage: ComponentReference[] = [];
      for (const usage of arrayValue(pageRaw.component_usage)) {
        if (!isObject(usage)) continue;
        const reference = {
          id: stringValue(usage.id),
          version: stringValue(usage.version),
          adaptation: stringValue(usage.adaptation),
        };
        componentUsage.push(reference);
        if (!componentKeys.has(`${reference.id}@${reference.version}`))
          issue(
            issues,
            'error',
            'missing-component-version',
            pageFile,
            `组件版本不存在：${reference.id}@${reference.version}`,
          );
      }
      const annotations: AnnotationNode[] = [];
      const annotationIds = new Set<string>();
      for (const annotation of arrayValue(pageRaw.annotations)) {
        if (!isObject(annotation)) continue;
        const annotationId = stringValue(annotation.id);
        if (!annotationId || annotationIds.has(annotationId))
          issue(
            issues,
            'error',
            'duplicate-annotation',
            pageFile,
            `标注 ID 缺失或重复：${annotationId}`,
          );
        annotationIds.add(annotationId);
        const coordinates = ['x', 'y', 'label_x', 'label_y'].map((key) =>
          numberValue(annotation[key], -1),
        );
        if (coordinates.some((coordinate) => coordinate < 0 || coordinate > 1))
          issue(
            issues,
            'error',
            'invalid-annotation-position',
            pageFile,
            `标注坐标必须位于 0–1：${annotationId}`,
          );
        annotations.push({
          id: annotationId,
          label: stringValue(annotation.label),
          text: stringValue(annotation.text),
          x: coordinates[0],
          y: coordinates[1],
          labelX: coordinates[2],
          labelY: coordinates[3],
          ...(typeof annotation.target === 'string' ? { target: annotation.target } : {}),
        });
      }
      const autoPosition = positions.get(pageId) || { x: 0, y: 0 };
      const savedPosition = isObject(layoutNodes[pageId]) ? layoutNodes[pageId] : {};
      const imageRevision = parseImageRevision(pageRaw.image_revision, assetPath);
      const promptPath = typeof pageRaw.prompt_path === 'string' ? pageRaw.prompt_path : undefined;
      if (promptPath) {
        try {
          await storage.readBytes(promptPath, issues);
        } catch {
          issue(
            issues,
            'error',
            'missing-page-prompt',
            promptPath,
            `页面 Prompt 不存在：${pageRef}`,
          );
        }
      } else if (flowSchema === 2)
        issue(
          issues,
          'warning',
          'missing-page-prompt',
          pageFile,
          `v2 页面未声明 prompt_path：${pageRef}`,
        );
      for (const referenceImage of stringArray(pageRaw.reference_images)) {
        try {
          await storage.resolveAsset(referenceImage);
        } catch {
          issue(
            issues,
            'error',
            'invalid-reference-image',
            referenceImage,
            `参考图不存在或路径不安全：${pageRef}`,
          );
        }
      }
      nodes.push({
        id: pageRef,
        pageRef,
        name: stringValue(pageRaw.name, pageId),
        goal: stringValue(pageRaw.goal),
        kind: pageKinds.has(kind) ? kind : 'page',
        platform: platforms.has(platform) ? platform : 'desktop',
        ...(parent ? { parent } : {}),
        frame: {
          x: numberValue(savedPosition.x, autoPosition.x),
          y: numberValue(savedPosition.y, autoPosition.y),
          width,
          height,
        },
        image: {
          id: `${pageRef}/image`,
          type: 'image',
          assetPath,
          width,
          height,
          intrinsicWidth: intrinsic.width,
          intrinsicHeight: intrinsic.height,
          locked: true,
        },
        annotations,
        componentUsage,
        imageRevision,
        themeVersion: stringValue(flowRaw.theme_version, project.theme.version),
        ...(promptPath ? { promptPath } : {}),
      });
    }
    const entryPage = stringValue(flowRaw.entry_page);
    if (!localPageIds.has(entryPage))
      issue(issues, 'error', 'missing-entry-page', flowPath, `入口页面不存在：${entryPage}`);
    const transitionIds = new Set<string>();
    const edges: FlowEdge[] = transitionsRaw.map((transition, index) => {
      const from = stringValue(transition.from),
        to = stringValue(transition.to);
      const explicitId = stringValue(transition.id);
      const intent = stringValue(transition.intent);
      const id = explicitId || `${from}-to-${to}` || `${flowId}/transition-${index + 1}`;
      if (flowSchema === 2 && !safeId.test(explicitId))
        issue(
          issues,
          'error',
          'invalid-transition-id',
          flowPath,
          `v2 transition 必须包含有效 ID：${explicitId || '<empty>'}`,
        );
      if (intent && !transitionIntents.has(intent))
        issue(
          issues,
          'error',
          'invalid-transition-intent',
          flowPath,
          `transition intent 无效：${intent}`,
        );
      if (transitionIds.has(id))
        issue(issues, 'error', 'duplicate-transition', flowPath, `transition ID 重复：${id}`);
      transitionIds.add(id);
      return {
        id,
        from,
        to,
        trigger: stringValue(transition.trigger),
        condition: stringValue(transition.condition),
        effect: stringValue(transition.effect),
        crossFlow: from.split('/')[0] !== to.split('/')[0],
        ...(transitionIntents.has(intent) ? { intent: intent as FlowEdge['intent'] } : {}),
      };
    });
    const viewport = isObject(layoutRaw.viewport) ? layoutRaw.viewport : undefined;
    flows.push({
      id: flowId,
      name: stringValue(flowRaw.name, stringValue(entry.name, flowId)),
      goal: stringValue(flowRaw.goal),
      sourcePath: flowPath,
      ...(brief ? { brief } : {}),
      entryPage,
      consistencyNotes: stringArray(flowRaw.consistency_notes),
      nodes,
      edges,
      ...(viewport
        ? {
            defaultViewport: {
              x: numberValue(viewport.x),
              y: numberValue(viewport.y),
              zoom: numberValue(viewport.zoom, 0.35),
            },
          }
        : {}),
    });
  }

  return { flows, pageRefs, relatedByFlow };
}
