import type {
  DesignComponentSpec,
  TokenCollection,
  WorkspaceDocument,
  WorkspaceFlow,
} from '@forma/schema/workbench';
import { compareVersions } from '../utils/versions.ts';

export function calculateDesignSystemImpacts(
  components: DesignComponentSpec[],
  tokens: TokenCollection,
  flows: WorkspaceFlow[],
) {
  const latestComponents = new Map<string, DesignComponentSpec>();
  for (const component of components) {
    if (component.status !== 'approved') continue;
    const current = latestComponents.get(component.id);
    if (!current || compareVersions(component.version, current.version) > 0)
      latestComponents.set(component.id, component);
  }
  const impacts = flows.flatMap((flow) =>
    flow.nodes.flatMap((node) => {
      const reasons: WorkspaceDocument['designSystem']['impacts'][number]['reasons'] = [];
      if (node.themeVersion !== tokens.themeVersion)
        reasons.push({
          type: 'tokens',
          subject: tokens.themeVersion,
          fromVersion: node.themeVersion,
          toVersion: tokens.themeVersion,
          message: `页面主题 ${node.themeVersion} 落后于当前 Tokens ${tokens.themeVersion}。`,
        });
      for (const usage of node.componentUsage) {
        const latest = latestComponents.get(usage.id);
        if (latest && latest.version !== usage.version)
          reasons.push({
            type: 'component',
            subject: usage.id,
            fromVersion: usage.version,
            toVersion: latest.version,
            message: `${usage.id} 已从 ${usage.version} 更新为 ${latest.version}。`,
          });
      }
      return reasons.length ? [{ pageRef: node.pageRef, reasons }] : [];
    }),
  );

  return impacts;
}
