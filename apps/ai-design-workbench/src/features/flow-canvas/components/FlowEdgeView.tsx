import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { FlowEdge, FlowPageNode } from '@forma/schema/workbench';
import { Button } from '@forma/ui/button';
import type { Camera } from '../../../shared/types/workbench.ts';
import { edgeGeometry } from '../lib/edge-geometry.ts';

export const FlowEdgeView = memo(function FlowEdgeView({
  edge,
  nodes,
  camera,
  selected,
  onSelect,
}: {
  /** 连接两个页面的流程边。 */
  edge: FlowEdge;
  /** 按约定顺序保存的设计节点集合。 */
  nodes: Map<string, FlowPageNode>;
  /** 用于坐标换算的当前视口状态。 */
  camera: Camera;
  /** 当前选择的对象或选中状态。 */
  selected: boolean;
  /**
   * 在选择时通知调用方，由外层决定如何更新业务状态。
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSelect: (id: string) => void;
}) {
  const geometry = edgeGeometry(edge, nodes, camera);
  if (!geometry) return null;
  const labelX = geometry.middle,
    labelY = (geometry.y1 + geometry.y2) / 2;
  return (
    <>
      <path
        className={`edge-hit ${selected ? 'selected' : ''}`}
        d={geometry.path}
        onClick={() => onSelect(edge.id)}
      />
      <path
        className={`edge-path ${edge.crossFlow ? 'cross-flow' : ''} ${selected ? 'selected' : ''}`}
        d={geometry.path}
        markerEnd="url(#arrow)"
      />
      <foreignObject
        x={labelX - 90 * camera.zoom}
        y={labelY - 13 * camera.zoom}
        width={180 * camera.zoom}
        height={26 * camera.zoom}
        className="edge-label-wrap"
      >
        <div className="edge-label-anchor">
          <Button
            variant="ghost"
            size="sm"
            className={`edge-label ${selected ? 'selected' : ''}`}
            onClick={() => onSelect(edge.id)}
          >
            {edge.trigger || '转场'}
            {edge.crossFlow ? <small>{edge.to.split('/')[0]}</small> : null}
            <ChevronRight size={14} />
          </Button>
        </div>
      </foreignObject>
    </>
  );
});
