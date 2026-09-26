import type { CSSProperties } from 'react';
import type { DesignNode, Project, ThemeTokens } from '@forma/schema';
import { getProjectTokens, resolveNode } from '../shared/scene-values.ts';

export const vectorTypes = new Set(['ellipse', 'line', 'polygon', 'star', 'path']);

/**
 * 把主题 Token 转换为 CSS 自定义属性，便于整棵渲染树继承主题。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 可直接传给 React style 的主题变量。
 */
export function getThemeStyle(project: Project): CSSProperties {
  return Object.fromEntries(
    Object.entries(getProjectTokens(project)).map(([key, value]) => [
      `--forma-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      typeof value === 'number' ? `${value}px` : value,
    ]),
  ) as CSSProperties;
}

/**
 * 把设计节点属性映射为 DOM 样式，保持导出与预览的视觉规则一致。
 *
 * @param input - 当前步骤需要处理的输入。
 * @param tokens - 设计主题或语义 Token 集合。
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns React 节点样式对象。
 */
export function getNodeStyle(
  input: DesignNode,
  tokens: ThemeTokens,
  nodes: DesignNode[] = [],
  project?: Project,
): CSSProperties {
  const node = resolveNode(input, project ?? tokens);
  let visible = node.visible !== false;
  let opacity = node.opacity ?? 1;
  let parentId = node.parentId;
  const visited = new Set([node.id]);
  const rotation = ((node.rotation ?? 0) * Math.PI) / 180;
  let matrix = [
    Math.cos(rotation) * (node.flipX ? -1 : 1),
    Math.sin(rotation) * (node.flipX ? -1 : 1),
    -Math.sin(rotation) * (node.flipY ? -1 : 1),
    Math.cos(rotation) * (node.flipY ? -1 : 1),
  ];
  let centerX = node.x + node.width / 2,
    centerY = node.y + node.height / 2;
  let inheritedTransform = false;
  let left = 0,
    top = 0,
    right = node.width,
    bottom = node.height;
  let clipped = false;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parentInput = nodes.find((item) => item.id === parentId);
    if (!parentInput) break;
    const parent = resolveNode(parentInput, project ?? tokens);
    visible = visible && parent.visible !== false;
    opacity *= parent.opacity ?? 1;
    if (parent.rotation || parent.flipX || parent.flipY) {
      inheritedTransform = true;
      const angle = ((parent.rotation ?? 0) * Math.PI) / 180;
      const a = Math.cos(angle) * (parent.flipX ? -1 : 1),
        b = Math.sin(angle) * (parent.flipX ? -1 : 1);
      const c = -Math.sin(angle) * (parent.flipY ? -1 : 1),
        d = Math.cos(angle) * (parent.flipY ? -1 : 1);
      const dx = centerX - parent.x - parent.width / 2,
        dy = centerY - parent.y - parent.height / 2;
      centerX = parent.x + parent.width / 2 + a * dx + c * dy;
      centerY = parent.y + parent.height / 2 + b * dx + d * dy;
      matrix = [
        a * matrix[0] + c * matrix[1],
        b * matrix[0] + d * matrix[1],
        a * matrix[2] + c * matrix[3],
        b * matrix[2] + d * matrix[3],
      ];
    }
    if (parent.clipContent) {
      clipped = true;
      left = Math.max(left, parent.x - node.x);
      top = Math.max(top, parent.y - node.y);
      right = Math.min(right, parent.x + parent.width - node.x);
      bottom = Math.min(bottom, parent.y + parent.height - node.y);
    }
    parentId = parent.parentId;
  }
  const isVector = vectorTypes.has(node.type);
  const gradient = node.gradient
    ? node.gradient.type === 'radial'
      ? `radial-gradient(ellipse at center, ${node.gradient.from}, ${node.gradient.to})`
      : `linear-gradient(${node.gradient.angle}deg, ${node.gradient.from}, ${node.gradient.to})`
    : undefined;
  const shadow =
    node.shadow &&
    `${node.shadow.inset ? 'inset ' : ''}${node.shadow.x}px ${node.shadow.y}px ${node.shadow.blur}px ${node.shadow.spread}px ${node.shadow.color}`;
  const border =
    node.stroke && (node.strokeWidth ?? 1) > 0
      ? `${node.strokeWidth ?? 1}px ${node.strokeDash === 'dotted' ? 'dotted' : node.strokeDash === 'dashed' ? 'dashed' : 'solid'} ${node.stroke}`
      : undefined;
  const outline =
    node.strokeAlign === 'outside' || node.strokeAlign === 'center' ? border : undefined;
  const effectiveBorder = outline ? undefined : border;
  const base: CSSProperties = {
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    boxSizing: 'border-box',
    background: isVector ? 'transparent' : gradient || node.fill || 'transparent',
    color: node.color ?? tokens.text,
    fontSize: node.fontSize ?? 14,
    fontFamily: node.fontFamily ?? tokens.fontFamily,
    borderRadius: isVector ? 0 : (node.radius ?? 0),
    opacity,
    margin: 0,
    border: isVector ? 0 : effectiveBorder || 0,
    outline: isVector ? undefined : outline,
    outlineOffset: node.strokeAlign === 'center' ? -(node.strokeWidth ?? 1) / 2 : undefined,
    padding: 0,
    whiteSpace: 'pre-wrap',
    overflow: node.clipContent ? 'hidden' : 'visible',
    lineHeight: node.lineHeight ?? 1.45,
    letterSpacing: node.letterSpacing ?? 0,
    fontWeight: node.fontWeight ?? (node.type === 'button' ? 550 : 400),
    fontStyle: node.fontStyle ?? 'normal',
    textDecoration: node.textDecoration ?? 'none',
    textAlign: node.textAlign ?? (node.type === 'button' ? 'center' : 'left'),
    display: visible && (!clipped || (right > left && bottom > top)) ? 'block' : 'none',
    transform: inheritedTransform
      ? `matrix(${matrix.join(',')},${centerX - node.x - node.width / 2},${centerY - node.y - node.height / 2})`
      : node.rotation || node.flipX || node.flipY
        ? `rotate(${node.rotation ?? 0}deg) scale(${node.flipX ? -1 : 1},${node.flipY ? -1 : 1})`
        : undefined,
    transformOrigin: 'center',
    boxShadow: !isVector && shadow ? shadow : undefined,
    filter: node.blur ? `blur(${node.blur}px)` : undefined,
    mixBlendMode: node.blendMode ?? 'normal',
    clipPath: clipped
      ? `inset(${Math.max(0, top)}px ${Math.max(0, node.width - right)}px ${Math.max(0, node.height - bottom)}px ${Math.max(0, left)}px)`
      : undefined,
  };
  return base;
}
