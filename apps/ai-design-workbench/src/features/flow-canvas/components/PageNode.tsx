import { memo, type PointerEvent as ReactPointerEvent } from 'react';
import { Grip, Maximize2 } from 'lucide-react';
import type { AnnotationNode, FlowPageNode } from '@forma/schema/workbench';
import { assetUrl } from '../../../shared/api/client.ts';
import { Button } from '@forma/ui/button';
import type { Camera } from '../../../shared/types/workbench.ts';

export const PageNode = memo(function PageNode({
  node,
  camera,
  selected,
  impactCount,
  showAnnotations,
  activeAnnotation,
  onSelect,
  onDragStart,
  onAnnotation,
  onOpenImage,
}: {
  /** 当前处理的设计节点。 */
  node: FlowPageNode;
  /** 用于坐标换算的当前视口状态。 */
  camera: Camera;
  /** 当前选择的对象或选中状态。 */
  selected: boolean;
  /** 受设计系统版本变化影响的页面数量。 */
  impactCount: number;
  /** 是否在页面图片上显示标注。 */
  showAnnotations: boolean;
  /** 当前选中的标注。 */
  activeAnnotation?: string;
  /**
   * 在选择时通知调用方，由外层决定如何更新业务状态。
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSelect: (id: string) => void;
  /**
   * 在开始拖动时通知调用方，由外层决定如何更新业务状态。
   * @param event - 当前事件及其触发位置。
   * @param node - 当前处理的设计节点。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onDragStart: (event: ReactPointerEvent, node: FlowPageNode) => void;
  /**
   * 在标注时通知调用方，由外层决定如何更新业务状态。
   * @param node - 当前处理的设计节点。
   * @param annotation - 待保存的定位标注。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onAnnotation: (node: FlowPageNode, annotation: AnnotationNode) => void;
  /**
   * 在查看图片时通知调用方，由外层决定如何更新业务状态。
   * @param node - 当前处理的设计节点。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onOpenImage: (node: FlowPageNode) => void;
}) {
  return (
    <article
      className={`page-node ${selected ? 'selected' : ''}`}
      style={{
        left: camera.x + node.frame.x * camera.zoom,
        top: camera.y + node.frame.y * camera.zoom,
        width: node.frame.width * camera.zoom,
        height: node.frame.height * camera.zoom,
      }}
      onPointerDown={() => onSelect(node.id)}
    >
      <header className="page-node-header" onPointerDown={(event) => onDragStart(event, node)}>
        <div>
          <Grip size={22} />
          <span>
            <strong>{node.name}</strong>
            <small>
              {node.kind} · {node.image.width} × {node.image.height}
            </small>
          </span>
        </div>
        <div>
          {impactCount ? <span className="impact-badge">{impactCount} 影响</span> : null}
          <Button
            variant="ghost"
            size="sm"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onOpenImage(node)}
            aria-label="查看原图"
          >
            <Maximize2 size={18} />
          </Button>
        </div>
      </header>
      <div className="page-image-stage">
        <img
          src={assetUrl(node.image.assetPath)}
          width={node.frame.width * camera.zoom}
          height={node.frame.height * camera.zoom}
          alt={node.name}
          draggable={false}
        />
        {showAnnotations && node.annotations.length ? (
          <svg
            className="annotation-leaders"
            viewBox={`0 0 ${node.frame.width * camera.zoom} ${node.frame.height * camera.zoom}`}
            aria-hidden="true"
          >
            {node.annotations.map((annotation) => (
              <g key={annotation.id}>
                <line
                  x1={annotation.x * node.frame.width * camera.zoom}
                  y1={annotation.y * node.frame.height * camera.zoom}
                  x2={annotation.labelX * node.frame.width * camera.zoom}
                  y2={annotation.labelY * node.frame.height * camera.zoom}
                />
                <circle
                  cx={annotation.x * node.frame.width * camera.zoom}
                  cy={annotation.y * node.frame.height * camera.zoom}
                  r={3 * camera.zoom}
                />
              </g>
            ))}
          </svg>
        ) : null}
        {showAnnotations
          ? node.annotations.map((annotation, index) => (
              <Button
                variant="ghost"
                size="sm"
                key={annotation.id}
                className={`annotation-pin ${activeAnnotation === `${node.id}/${annotation.id}` ? 'active' : ''}`}
                style={{
                  left: `${annotation.labelX * 100}%`,
                  top: `${annotation.labelY * 100}%`,
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onAnnotation(node, annotation)}
                aria-label={annotation.label}
              >
                {index + 1}
              </Button>
            ))
          : null}
      </div>
    </article>
  );
});
