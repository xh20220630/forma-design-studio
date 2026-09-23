import type { DesignNode, Project, ThemeTokens } from '@forma/schema';

export function getProjectTokens(project: Project): ThemeTokens {
  return project.activeMode && project.themeModes && Object.hasOwn(project.themeModes, project.activeMode) ? project.themeModes[project.activeMode] : project.tokens;
}

export function resolveNode(node: DesignNode, theme: ThemeTokens | Project): DesignNode {
  const project = 'tokens' in theme ? theme : undefined;
  const tokens = project ? getProjectTokens(project) : theme as ThemeTokens;
  const resolved = { ...node };
  for (const [property, token] of Object.entries(node.tokenBindings || {})) {
    if (tokens[token] !== undefined) (resolved as unknown as Record<string, unknown>)[property] = tokens[token];
  }
  for (const [property, binding] of Object.entries(node.variableBindings || {})) {
    const collection = project?.variableCollections?.find(item => item.id === binding.collectionId);
    const variable = collection?.variables.find(item => item.id === binding.variableId);
    const mode = collection && (project?.activeVariableModes?.[collection.id] || collection.modes[0]);
    const value = mode && variable && Object.hasOwn(variable.values, mode) ? variable.values[mode] : undefined;
    if (value !== undefined) (resolved as unknown as Record<string, unknown>)[property] = value;
  }
  return resolved;
}

export function shapePoints(node: DesignNode): string {
  if (node.points?.length) return node.points.map(point => `${point.x},${point.y}`).join(' ');
  const sides = Math.max(3, Math.min(64, Math.round(node.polygonSides ?? (node.type === 'star' ? 5 : 3))));
  const count = node.type === 'star' ? sides * 2 : sides;
  return Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count - Math.PI / 2;
    const ratio = node.type === 'star' && index % 2 ? node.starRatio ?? 0.45 : 1;
    return `${node.width / 2 + Math.cos(angle) * node.width / 2 * ratio},${node.height / 2 + Math.sin(angle) * node.height / 2 * ratio}`;
  }).join(' ');
}

