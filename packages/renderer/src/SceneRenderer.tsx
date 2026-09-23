import React from 'react';
import type { CSSProperties } from 'react';
import type { DesignNode, Project, ThemeTokens } from '@forma/schema';
import { getProjectTokens, resolveNode, shapePoints } from './scene-values';
export { getProjectTokens, resolveNode, shapePoints } from './scene-values';

const vectorTypes = new Set(['ellipse', 'line', 'polygon', 'star', 'path']);

export function getThemeStyle(project: Project): CSSProperties {
  return Object.fromEntries(Object.entries(getProjectTokens(project)).map(([key, value]) => [`--forma-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, typeof value === 'number' ? `${value}px` : value])) as CSSProperties;
}

export function getNodeStyle(input: DesignNode, tokens: ThemeTokens, nodes: DesignNode[] = [], project?: Project): CSSProperties {
  const node = resolveNode(input, project ?? tokens);
  let visible = node.visible !== false;
  let opacity = node.opacity ?? 1;
  let parentId = node.parentId;
  const visited = new Set([node.id]);
  const rotation = (node.rotation ?? 0) * Math.PI / 180;
  let matrix = [Math.cos(rotation) * (node.flipX ? -1 : 1), Math.sin(rotation) * (node.flipX ? -1 : 1), -Math.sin(rotation) * (node.flipY ? -1 : 1), Math.cos(rotation) * (node.flipY ? -1 : 1)];
  let centerX = node.x + node.width / 2, centerY = node.y + node.height / 2;
  let inheritedTransform = false;
  let left = 0, top = 0, right = node.width, bottom = node.height;
  let clipped = false;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parentInput = nodes.find(item => item.id === parentId);
    if (!parentInput) break;
    const parent = resolveNode(parentInput, project ?? tokens);
    visible = visible && parent.visible !== false;
    opacity *= parent.opacity ?? 1;
    if (parent.rotation || parent.flipX || parent.flipY) {
      inheritedTransform = true;
      const angle = (parent.rotation ?? 0) * Math.PI / 180;
      const a = Math.cos(angle) * (parent.flipX ? -1 : 1), b = Math.sin(angle) * (parent.flipX ? -1 : 1);
      const c = -Math.sin(angle) * (parent.flipY ? -1 : 1), d = Math.cos(angle) * (parent.flipY ? -1 : 1);
      const dx = centerX - parent.x - parent.width / 2, dy = centerY - parent.y - parent.height / 2;
      centerX = parent.x + parent.width / 2 + a * dx + c * dy;
      centerY = parent.y + parent.height / 2 + b * dx + d * dy;
      matrix = [a * matrix[0] + c * matrix[1], b * matrix[0] + d * matrix[1], a * matrix[2] + c * matrix[3], b * matrix[2] + d * matrix[3]];
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
  const gradient = node.gradient ? node.gradient.type === 'radial'
    ? `radial-gradient(ellipse at center, ${node.gradient.from}, ${node.gradient.to})`
    : `linear-gradient(${node.gradient.angle}deg, ${node.gradient.from}, ${node.gradient.to})` : undefined;
  const shadow = node.shadow && `${node.shadow.inset ? 'inset ' : ''}${node.shadow.x}px ${node.shadow.y}px ${node.shadow.blur}px ${node.shadow.spread}px ${node.shadow.color}`;
  const border = node.stroke && (node.strokeWidth ?? 1) > 0 ? `${node.strokeWidth ?? 1}px ${node.strokeDash === 'dotted' ? 'dotted' : node.strokeDash === 'dashed' ? 'dashed' : 'solid'} ${node.stroke}` : undefined;
  const outline = node.strokeAlign === 'outside' || node.strokeAlign === 'center' ? border : undefined;
  const effectiveBorder = outline ? undefined : border;
  const base: CSSProperties = {
    position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height,
    boxSizing: 'border-box', background: isVector ? 'transparent' : gradient || node.fill || 'transparent',
    color: node.color ?? tokens.text, fontSize: node.fontSize ?? 14, fontFamily: node.fontFamily ?? tokens.fontFamily,
    borderRadius: isVector ? 0 : node.radius ?? 0, opacity, margin: 0,
    border: isVector ? 0 : effectiveBorder || 0, outline: isVector ? undefined : outline,
    outlineOffset: node.strokeAlign === 'center' ? -(node.strokeWidth ?? 1) / 2 : undefined,
    padding: 0, whiteSpace: 'pre-wrap', overflow: node.clipContent ? 'hidden' : 'visible',
    lineHeight: node.lineHeight ?? 1.45, letterSpacing: node.letterSpacing ?? 0,
    fontWeight: node.fontWeight ?? (node.type === 'button' ? 550 : 400),
    fontStyle: node.fontStyle ?? 'normal', textDecoration: node.textDecoration ?? 'none',
    textAlign: node.textAlign ?? (node.type === 'button' ? 'center' : 'left'),
    display: visible && (!clipped || right > left && bottom > top) ? 'block' : 'none',
    transform: inheritedTransform ? `matrix(${matrix.join(',')},${centerX - node.x - node.width / 2},${centerY - node.y - node.height / 2})` : node.rotation || node.flipX || node.flipY ? `rotate(${node.rotation ?? 0}deg) scale(${node.flipX ? -1 : 1},${node.flipY ? -1 : 1})` : undefined,
    transformOrigin: 'center', boxShadow: !isVector && shadow ? shadow : undefined,
    filter: node.blur ? `blur(${node.blur}px)` : undefined,
    mixBlendMode: node.blendMode ?? 'normal',
    clipPath: clipped ? `inset(${Math.max(0, top)}px ${Math.max(0, node.width - right)}px ${Math.max(0, node.height - bottom)}px ${Math.max(0, left)}px)` : undefined,
  };
  return base;
}

function VectorContent({ node }: { node: DesignNode }) {
  const reactId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gradientId = `forma-gradient-${reactId}`;
  const shadowId = `forma-shadow-${reactId}`;
  const strokeWidth = node.strokeWidth ?? (node.type === 'line' ? 2 : node.stroke ? 1 : 0);
  const fill = node.gradient ? `url(#${gradientId})` : node.fill ?? (node.type === 'line' ? 'none' : 'transparent');
  const attributes = {
    fill, stroke: node.stroke ?? (node.type === 'line' ? node.color ?? '#64748b' : 'none'), strokeWidth,
    strokeDasharray: node.strokeDash === 'dashed' ? `${strokeWidth * 4} ${strokeWidth * 3}` : node.strokeDash === 'dotted' ? `${strokeWidth} ${strokeWidth * 2}` : undefined,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  const inset = node.strokeAlign === 'inside' ? strokeWidth / 2 : node.strokeAlign === 'outside' ? -strokeWidth / 2 : 0;
  const angle = (node.gradient?.angle ?? 90) * Math.PI / 180;
  const shadowPadding = node.shadow ? Math.max(Math.abs(node.shadow.x), Math.abs(node.shadow.y)) + node.shadow.blur * 3 + Math.abs(node.shadow.spread) + strokeWidth + 2 : 0;
  return <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(1, node.width)} ${Math.max(1, node.height)}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
    {node.gradient && <defs>{node.gradient.type === 'radial'
      ? <radialGradient id={gradientId}><stop offset="0%" stopColor={node.gradient.from} /><stop offset="100%" stopColor={node.gradient.to} /></radialGradient>
      : <linearGradient id={gradientId} x1={`${50 - Math.sin(angle) * 50}%`} y1={`${50 + Math.cos(angle) * 50}%`} x2={`${50 + Math.sin(angle) * 50}%`} y2={`${50 - Math.cos(angle) * 50}%`}><stop offset="0%" stopColor={node.gradient.from} /><stop offset="100%" stopColor={node.gradient.to} /></linearGradient>}</defs>}
    {node.shadow && <defs><filter id={shadowId} filterUnits="userSpaceOnUse" x={-shadowPadding} y={-shadowPadding} width={node.width + shadowPadding * 2} height={node.height + shadowPadding * 2} colorInterpolationFilters="sRGB">
      <feMorphology in="SourceAlpha" operator={(node.shadow.spread < 0) !== Boolean(node.shadow.inset) ? 'erode' : 'dilate'} radius={Math.abs(node.shadow.spread)} result="spread" />
      <feGaussianBlur in="spread" stdDeviation={node.shadow.blur / 2} result="soft" />
      <feOffset in="soft" dx={node.shadow.x} dy={node.shadow.y} result="offset" />
      {node.shadow.inset && <feComposite in="SourceAlpha" in2="offset" operator="out" result="inner" />}
      <feFlood floodColor={node.shadow.color} result="color" />
      <feComposite in="color" in2={node.shadow.inset ? 'inner' : 'offset'} operator="in" result="shadow" />
      <feMerge>{node.shadow.inset ? <><feMergeNode in="SourceGraphic" /><feMergeNode in="shadow" /></> : <><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></>}</feMerge>
    </filter></defs>}
    <g filter={node.shadow ? `url(#${shadowId})` : undefined}>
    {node.type === 'ellipse' && <ellipse cx={node.width / 2} cy={node.height / 2} rx={Math.max(0, node.width / 2 - inset)} ry={Math.max(0, node.height / 2 - inset)} {...attributes} />}
    {node.type === 'line' && <line x1={node.points?.[0]?.x ?? 0} y1={node.points?.[0]?.y ?? 0} x2={node.points?.[1]?.x ?? node.width} y2={node.points?.[1]?.y ?? node.height} {...attributes} fill="none" />}
    {(node.type === 'polygon' || node.type === 'star') && <polygon points={shapePoints(node)} {...attributes} />}
    {node.type === 'path' && (node.path
      ? <path d={/^[MmLlHhVvCcSsQqTtAaZzEe0-9+.,\s-]+$/.test(node.path) ? node.path : ''} {...attributes} fill={node.closed ? fill : 'none'} />
      : node.closed ? <polygon points={shapePoints(node)} {...attributes} /> : <polyline points={shapePoints(node)} {...attributes} fill="none" />)}
    </g>
  </svg>;
}

export function NodeContent({ node: input, project, depth = 0, onAction }: { node: DesignNode; project: Project; depth?: number; onAction?: (node: DesignNode) => void }) {
  const node = resolveNode(input, project);
  if (vectorTypes.has(node.type)) return <VectorContent node={node} />;
  if (node.type === 'image' && node.src) return <img src={node.src} alt={node.text || node.name} draggable={false} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />;
  if (node.type === 'component' && depth < 16) {
    const component = project.components.find(item => item.id === node.componentId);
    if (!component) return null;
    const nodes = component.nodes.map(child => ({ ...resolveNode(child, project), ...node.overrides?.[child.id], ...(node.overrides?.[child.id]?.fill !== undefined ? { gradient: undefined } : {}), tokenBindings: undefined, variableBindings: undefined }));
    return <div style={{ position: 'relative', width: component.width, height: component.height, transformOrigin: '0 0', transform: `scale(${node.width / component.width},${node.height / component.height})` }}>
      {nodes.map(child => <NodeView key={child.id} node={child} project={project} nodes={nodes} depth={depth + 1} onClick={onAction} />)}
    </div>;
  }
  if (node.text !== undefined) return <span style={{ display: 'flex', width: '100%', height: '100%', boxSizing: 'border-box', padding: `${node.paddingY ?? node.padding ?? 0}px ${node.paddingX ?? node.padding ?? 0}px`, alignItems: node.verticalAlign === 'bottom' ? 'flex-end' : node.verticalAlign === 'center' || node.type === 'button' ? 'center' : 'flex-start', justifyContent: node.textAlign === 'right' ? 'flex-end' : node.textAlign === 'center' || node.type === 'button' && !node.textAlign ? 'center' : 'flex-start', wordBreak: 'break-word', overflow: 'hidden' }}><span style={{ maxWidth: '100%', width: node.textAlign === 'justify' ? '100%' : undefined }}>{node.text}</span></span>;
  return null;
}

export function NodeView({ node, project, nodes = [], depth = 0, onClick }: { node: DesignNode; project: Project; nodes?: DesignNode[]; depth?: number; onClick?: (node: DesignNode) => void }) {
  const style = getNodeStyle(node, getProjectTokens(project), nodes, project);
  if (style.display === 'none') return null;
  let actionTarget = node;
  let parentId = node.parentId;
  const visited = new Set([node.id]);
  while (!actionTarget.prototype && parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = nodes.find(item => item.id === parentId);
    if (!parent) break;
    if (parent.prototype) actionTarget = parent;
    parentId = parent.parentId;
  }
  const interactive = Boolean(onClick && (actionTarget.prototype || node.type === 'button'));
  const activate = () => onClick?.(actionTarget);
  const click = interactive && actionTarget.prototype?.trigger !== 'hover' ? (event: React.MouseEvent) => { event.stopPropagation(); activate(); } : undefined;
  const props = { style: { ...style, cursor: interactive ? 'pointer' : undefined }, 'data-forma-node': node.id, 'aria-label': node.name, onClick: click, onMouseEnter: actionTarget.prototype?.trigger === 'hover' ? activate : undefined };
  const content = <NodeContent node={node} project={project} depth={depth} onAction={onClick ? child => onClick(child.prototype ? child : actionTarget.prototype ? actionTarget : child) : undefined} />;
  if (node.type === 'button') return <button {...props} type="button">{content}</button>;
  return <div {...props} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} onKeyDown={interactive ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } } : undefined}>{content}</div>;
}
