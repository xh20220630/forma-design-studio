import type { ValidationIssue, WorkspaceFlow } from '@forma/schema/workbench';
import { exitTransitionIntents, exitTransitionWords } from './constants.ts';
import { issue } from '../utils/validation.ts';

export function validateFlowReferences(
  flows: WorkspaceFlow[],
  pageRefs: Set<string>,
  relatedByFlow: Map<string, Set<string>>,
  issues: ValidationIssue[],
) {
  for (const flow of flows) {
    for (const edge of flow.edges) {
      if (!pageRefs.has(edge.from))
        issue(
          issues,
          'error',
          'missing-transition-source',
          `flows/${flow.id}/flow.json`,
          `转场起点不存在：${edge.from}`,
        );
      if (!pageRefs.has(edge.to))
        issue(
          issues,
          'error',
          'missing-transition-target',
          `flows/${flow.id}/flow.json`,
          `转场目标不存在：${edge.to}`,
        );
      const targetFlow = edge.to.split('/')[0];
      if (edge.crossFlow && !relatedByFlow.get(flow.id)?.has(targetFlow))
        issue(
          issues,
          'error',
          'unregistered-cross-flow',
          `flows/${flow.id}/flow.json`,
          `跨流程目标未登记在 related_flows：${targetFlow}`,
        );
    }
    for (const node of flow.nodes) {
      if (node.parent && !pageRefs.has(node.parent))
        issue(
          issues,
          'error',
          'missing-parent-target',
          `flows/${flow.id}/flow.json`,
          `父页面不存在：${node.parent}`,
        );
      if (node.kind === 'modal' || node.kind === 'drawer') {
        const hasExit = flow.edges.some((edge) => {
          if (edge.from !== node.pageRef) return false;
          return (
            exitTransitionIntents.has(edge.intent || '') ||
            exitTransitionWords.test(`${edge.trigger} ${edge.effect}`)
          );
        });
        if (!hasExit)
          issue(
            issues,
            'error',
            'missing-close-transition',
            `flows/${flow.id}/flow.json`,
            `${node.kind} ${node.pageRef} 缺少关闭、取消、成功或返回转场。`,
          );
      }
      for (const annotation of node.annotations)
        if (annotation.target && !pageRefs.has(annotation.target))
          issue(
            issues,
            'error',
            'missing-annotation-target',
            `flows/${flow.id}/flow.json`,
            `标注目标不存在：${annotation.target}`,
          );
    }
  }
}
