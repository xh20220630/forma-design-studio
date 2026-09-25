import type { DesignNode, Project, ThemeTokens } from '@forma/schema';

/**
 * 选择当前主题模式的 Token，使 Canvas 与 DOM 渲染保持一致。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 当前生效的主题 Token。
 */
export function getProjectTokens(project: Project): ThemeTokens {
  return project.activeMode &&
    project.themeModes &&
    Object.hasOwn(project.themeModes, project.activeMode)
    ? project.themeModes[project.activeMode]
    : project.tokens;
}

/**
 * 将主题 Token 和变量绑定落实到节点属性，让渲染器只处理最终样式。
 *
 * @param node - 当前处理的设计节点。
 * @param theme - 项目主题及其规范路径和确认信息。
 * @returns 解析绑定后的节点。
 */
export function resolveNode(node: DesignNode, theme: ThemeTokens | Project): DesignNode {
  const project = 'tokens' in theme ? theme : undefined;
  const tokens = project ? getProjectTokens(project) : (theme as ThemeTokens);
  const resolved = { ...node };
  for (const [property, token] of Object.entries(node.tokenBindings || {})) {
    if (tokens[token] !== undefined)
      (resolved as unknown as Record<string, unknown>)[property] = tokens[token];
  }
  for (const [property, binding] of Object.entries(node.variableBindings || {})) {
    const collection = project?.variableCollections?.find(
      (item) => item.id === binding.collectionId,
    );
    const variable = collection?.variables.find((item) => item.id === binding.variableId);
    const mode =
      collection && (project?.activeVariableModes?.[collection.id] || collection.modes[0]);
    const value =
      mode && variable && Object.hasOwn(variable.values, mode) ? variable.values[mode] : undefined;
    if (value !== undefined) (resolved as unknown as Record<string, unknown>)[property] = value;
  }
  return resolved;
}

/**
 * 计算多边形或星形的顶点，供不同渲染方式共享形状定义。
 *
 * @param node - 当前处理的设计节点。
 * @returns 节点局部空间中的顶点列表。
 */
export function shapePoints(node: DesignNode): string {
  if (node.points?.length) return node.points.map((point) => `${point.x},${point.y}`).join(' ');
  const sides = Math.max(
    3,
    Math.min(64, Math.round(node.polygonSides ?? (node.type === 'star' ? 5 : 3))),
  );
  const count = node.type === 'star' ? sides * 2 : sides;
  return Array.from({ length: count }, (_, index) => {
    const angle = (index * Math.PI * 2) / count - Math.PI / 2;
    const ratio = node.type === 'star' && index % 2 ? (node.starRatio ?? 0.45) : 1;
    return `${node.width / 2 + ((Math.cos(angle) * node.width) / 2) * ratio},${node.height / 2 + ((Math.sin(angle) * node.height) / 2) * ratio}`;
  }).join(' ');
}
