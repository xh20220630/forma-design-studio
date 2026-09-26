import type { FlowEdge, FlowPageNode } from '@forma/schema/workbench';
import type { Camera } from '../../../shared/types/workbench.ts';

// 跨流程连线可能缺少一端；用相邻的虚拟端点保持方向，再转换为屏幕坐标。
export function edgeGeometry(edge: FlowEdge, nodes: Map<string, FlowPageNode>, camera: Camera) {
  const from = nodes.get(edge.from),
    to = nodes.get(edge.to);
  if (!from && !to) return;
  const worldX1 = from ? from.frame.x + from.frame.width : to!.frame.x - 420;
  const worldY1 = from ? from.frame.y + from.frame.height / 2 : to!.frame.y + to!.frame.height / 2;
  const worldX2 = to ? to.frame.x : from!.frame.x + from!.frame.width + 420;
  const worldY2 = to ? to.frame.y + to.frame.height / 2 : worldY1;
  const x1 = camera.x + worldX1 * camera.zoom;
  const y1 = camera.y + worldY1 * camera.zoom;
  const x2 = camera.x + worldX2 * camera.zoom;
  const y2 = camera.y + worldY2 * camera.zoom;
  const middle = x1 + Math.max(180 * camera.zoom, (x2 - x1) / 2);
  return {
    x1,
    y1,
    x2,
    y2,
    middle,
    path: `M ${x1} ${y1} H ${middle} V ${y2} H ${x2}`,
  };
}
