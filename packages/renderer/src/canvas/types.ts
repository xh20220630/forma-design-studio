import type { Bounds, Point } from './geometry.ts';

/** 实际 Canvas 绘制使用的视口尺寸、缩放倍率和平移偏移。 */
export interface CanvasView {
  /** 对象的宽度。 */
  width: number;
  /** 对象的高度。 */
  height: number;
  /** 缩放倍率，1 表示原始尺寸。 */
  zoom: number;
  /** 水平方向的位置。 */
  x: number;
  /** 垂直方向的位置。 */
  y: number;
}
/** 独立叠加层的编辑辅助信息，选择变化时无需重绘设计内容。 */
export interface CanvasOverlay {
  /** 当前选中节点的标识列表。 */
  selectedIds: string[];
  selectionBounds?: Bounds;
  /** 指针当前悬停的节点标识。 */
  hoverId?: string;
  /** 正在拖动的框选区域。 */
  marquee?: Bounds;
  /** 手动或自动生成的对齐辅助线。 */
  guides: {
    /** 辅助线或计算所沿用的坐标轴。取值：x、y。 */
    axis: 'x' | 'y';
    /** 当前字段、模式或控件的取值。 */
    value: number;
    /** 是否为根据节点关系自动生成的智能辅助线。 */
    smart?: boolean;
  }[];
  /** 钢笔工具尚未提交的点序列。 */
  penPoints: Point[];
}
