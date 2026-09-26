import React from 'react';
import type { DesignNode } from '@forma/schema';
import { shapePoints } from '../shared/scene-values.ts';

/**
 * 呈现矢量节点内容，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.node - 当前处理的设计节点。
 * @returns 供 React 渲染的界面内容。
 */
export function VectorContent({
  node,
}: {
  /** 当前处理的设计节点。 */
  node: DesignNode;
}) {
  const reactId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gradientId = `forma-gradient-${reactId}`;
  const shadowId = `forma-shadow-${reactId}`;
  const strokeWidth = node.strokeWidth ?? (node.type === 'line' ? 2 : node.stroke ? 1 : 0);
  const fill = node.gradient
    ? `url(#${gradientId})`
    : (node.fill ?? (node.type === 'line' ? 'none' : 'transparent'));
  const attributes = {
    fill,
    stroke: node.stroke ?? (node.type === 'line' ? (node.color ?? '#64748b') : 'none'),
    strokeWidth,
    strokeDasharray:
      node.strokeDash === 'dashed'
        ? `${strokeWidth * 4} ${strokeWidth * 3}`
        : node.strokeDash === 'dotted'
          ? `${strokeWidth} ${strokeWidth * 2}`
          : undefined,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const inset =
    node.strokeAlign === 'inside'
      ? strokeWidth / 2
      : node.strokeAlign === 'outside'
        ? -strokeWidth / 2
        : 0;
  const angle = ((node.gradient?.angle ?? 90) * Math.PI) / 180;
  const shadowPadding = node.shadow
    ? Math.max(Math.abs(node.shadow.x), Math.abs(node.shadow.y)) +
      node.shadow.blur * 3 +
      Math.abs(node.shadow.spread) +
      strokeWidth +
      2
    : 0;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${Math.max(1, node.width)} ${Math.max(1, node.height)}`}
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      {node.gradient && (
        <defs>
          {node.gradient.type === 'radial' ? (
            <radialGradient id={gradientId}>
              <stop offset="0%" stopColor={node.gradient.from} />
              <stop offset="100%" stopColor={node.gradient.to} />
            </radialGradient>
          ) : (
            <linearGradient
              id={gradientId}
              x1={`${50 - Math.sin(angle) * 50}%`}
              y1={`${50 + Math.cos(angle) * 50}%`}
              x2={`${50 + Math.sin(angle) * 50}%`}
              y2={`${50 - Math.cos(angle) * 50}%`}
            >
              <stop offset="0%" stopColor={node.gradient.from} />
              <stop offset="100%" stopColor={node.gradient.to} />
            </linearGradient>
          )}
        </defs>
      )}
      {node.shadow && (
        <defs>
          <filter
            id={shadowId}
            filterUnits="userSpaceOnUse"
            x={-shadowPadding}
            y={-shadowPadding}
            width={node.width + shadowPadding * 2}
            height={node.height + shadowPadding * 2}
            colorInterpolationFilters="sRGB"
          >
            <feMorphology
              in="SourceAlpha"
              operator={node.shadow.spread < 0 !== Boolean(node.shadow.inset) ? 'erode' : 'dilate'}
              radius={Math.abs(node.shadow.spread)}
              result="spread"
            />
            <feGaussianBlur in="spread" stdDeviation={node.shadow.blur / 2} result="soft" />
            <feOffset in="soft" dx={node.shadow.x} dy={node.shadow.y} result="offset" />
            {node.shadow.inset && (
              <feComposite in="SourceAlpha" in2="offset" operator="out" result="inner" />
            )}
            <feFlood floodColor={node.shadow.color} result="color" />
            <feComposite
              in="color"
              in2={node.shadow.inset ? 'inner' : 'offset'}
              operator="in"
              result="shadow"
            />
            <feMerge>
              {node.shadow.inset ? (
                <>
                  <feMergeNode in="SourceGraphic" />
                  <feMergeNode in="shadow" />
                </>
              ) : (
                <>
                  <feMergeNode in="shadow" />
                  <feMergeNode in="SourceGraphic" />
                </>
              )}
            </feMerge>
          </filter>
        </defs>
      )}
      <g filter={node.shadow ? `url(#${shadowId})` : undefined}>
        {node.type === 'ellipse' && (
          <ellipse
            cx={node.width / 2}
            cy={node.height / 2}
            rx={Math.max(0, node.width / 2 - inset)}
            ry={Math.max(0, node.height / 2 - inset)}
            {...attributes}
          />
        )}
        {node.type === 'line' && (
          <line
            x1={node.points?.[0]?.x ?? 0}
            y1={node.points?.[0]?.y ?? 0}
            x2={node.points?.[1]?.x ?? node.width}
            y2={node.points?.[1]?.y ?? node.height}
            {...attributes}
            fill="none"
          />
        )}
        {(node.type === 'polygon' || node.type === 'star') && (
          <polygon points={shapePoints(node)} {...attributes} />
        )}
        {node.type === 'path' &&
          (node.path ? (
            <path
              d={/^[MmLlHhVvCcSsQqTtAaZzEe0-9+.,\s-]+$/.test(node.path) ? node.path : ''}
              {...attributes}
              fill={node.closed ? fill : 'none'}
            />
          ) : node.closed ? (
            <polygon points={shapePoints(node)} {...attributes} />
          ) : (
            <polyline points={shapePoints(node)} {...attributes} fill="none" />
          ))}
      </g>
    </svg>
  );
}
