import React from 'react';
import type { DesignNode, Project } from '@forma/schema';
import { getProjectTokens, resolveNode } from '../shared/scene-values.ts';
import { vectorTypes, getNodeStyle } from './styles.ts';
import { VectorContent } from './vector.tsx';

/**
 * 呈现节点实际内容，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.node - 当前处理的设计节点。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.depth - 当前递归层级，用于控制缩进或限制展开深度。
 * @param props.onAction - 在动作时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function NodeContent({
  node: input,
  project,
  depth = 0,
  onAction,
}: {
  /** 当前处理的设计节点。 */
  node: DesignNode;
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /** 当前递归层级，用于控制缩进或限制展开深度。 */
  depth?: number;
  /**
   * 在动作时通知调用方，由外层决定如何更新业务状态。
   * @param node - 当前处理的设计节点。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onAction?: (node: DesignNode) => void;
}) {
  const node = resolveNode(input, project);
  if (vectorTypes.has(node.type)) return <VectorContent node={node} />;
  if (node.type === 'image' && node.src)
    return (
      <img
        src={node.src}
        alt={node.text || node.name}
        draggable={false}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: node.imageFit ?? 'cover',
          borderRadius: 'inherit',
        }}
      />
    );
  if (node.type === 'component' && depth < 16) {
    const component = project.components.find((item) => item.id === node.componentId);
    if (!component) return null;
    const nodes = component.nodes.map((child) => ({
      ...resolveNode(child, project),
      ...node.overrides?.[child.id],
      ...(node.overrides?.[child.id]?.fill !== undefined ? { gradient: undefined } : {}),
      tokenBindings: undefined,
      variableBindings: undefined,
    }));
    return (
      <div
        style={{
          position: 'relative',
          width: component.width,
          height: component.height,
          transformOrigin: '0 0',
          transform: `scale(${node.width / component.width},${node.height / component.height})`,
        }}
      >
        {nodes.map((child) => (
          <NodeView
            key={child.id}
            node={child}
            project={project}
            nodes={nodes}
            depth={depth + 1}
            onClick={onAction}
          />
        ))}
      </div>
    );
  }
  if (node.text !== undefined)
    return (
      <span
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: `${node.paddingY ?? node.padding ?? 0}px ${node.paddingX ?? node.padding ?? 0}px`,
          alignItems:
            node.verticalAlign === 'bottom'
              ? 'flex-end'
              : node.verticalAlign === 'center' || node.type === 'button'
                ? 'center'
                : 'flex-start',
          justifyContent:
            node.textAlign === 'right'
              ? 'flex-end'
              : node.textAlign === 'center' || (node.type === 'button' && !node.textAlign)
                ? 'center'
                : 'flex-start',
          wordBreak: 'break-word',
          overflow: 'hidden',
        }}
      >
        <span
          style={{ maxWidth: '100%', width: node.textAlign === 'justify' ? '100%' : undefined }}
        >
          {node.text}
        </span>
      </span>
    );
  return null;
}

/**
 * 呈现设计节点 DOM 容器，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.node - 当前处理的设计节点。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.nodes - 按约定顺序保存的设计节点集合。
 * @param props.depth - 当前递归层级，用于控制缩进或限制展开深度。
 * @param props.onClick - 在点击时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function NodeView({
  node,
  project,
  nodes = [],
  depth = 0,
  onClick,
}: {
  /** 当前处理的设计节点。 */
  node: DesignNode;
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /** 按约定顺序保存的设计节点集合。 */
  nodes?: DesignNode[];
  /** 当前递归层级，用于控制缩进或限制展开深度。 */
  depth?: number;
  /**
   * 在点击时通知调用方，由外层决定如何更新业务状态。
   * @param node - 当前处理的设计节点。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClick?: (node: DesignNode) => void;
}) {
  const style = getNodeStyle(node, getProjectTokens(project), nodes, project);
  if (style.display === 'none') return null;
  let actionTarget = node;
  let parentId = node.parentId;
  const visited = new Set([node.id]);
  while (!actionTarget.prototype && parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = nodes.find((item) => item.id === parentId);
    if (!parent) break;
    if (parent.prototype) actionTarget = parent;
    parentId = parent.parentId;
  }
  const interactive = Boolean(onClick && (actionTarget.prototype || node.type === 'button'));
  const activate = () => onClick?.(actionTarget);
  const click =
    interactive && actionTarget.prototype?.trigger !== 'hover'
      ? (event: React.MouseEvent) => {
          event.stopPropagation();
          activate();
        }
      : undefined;
  const props = {
    style: { ...style, cursor: interactive ? 'pointer' : undefined },
    'data-forma-node': node.id,
    'aria-label': node.name,
    onClick: click,
    onMouseEnter: actionTarget.prototype?.trigger === 'hover' ? activate : undefined,
  };
  const content = (
    <NodeContent
      node={node}
      project={project}
      depth={depth}
      onAction={
        onClick
          ? (child) =>
              onClick(child.prototype ? child : actionTarget.prototype ? actionTarget : child)
          : undefined
      }
    />
  );
  if (node.type === 'button')
    return (
      <button {...props} type="button">
        {content}
      </button>
    );
  return (
    <div
      {...props}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate();
              }
            }
          : undefined
      }
    >
      {content}
    </div>
  );
}
