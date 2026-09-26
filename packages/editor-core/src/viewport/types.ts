/** 二维画布坐标点。 */
export interface CanvasPoint {
  /** 水平方向的位置。 */
  x: number;
  /** 垂直方向的位置。 */
  y: number;
}

/** 画布或视口的宽高。 */
export interface CanvasSize {
  /** 对象的宽度。 */
  width: number;
  /** 对象的高度。 */
  height: number;
}

/** 以左上角和宽高描述的画布矩形区域。 */
export interface CanvasBounds extends CanvasPoint, CanvasSize {}

/** 画布相机状态，用尺寸、滚动偏移和倍率建立屏幕与设计坐标的关系。 */
export interface CanvasCamera extends CanvasSize {
  /** 缩放倍率，1 表示原始尺寸。 */
  zoom: number;
  /** 水平方向的滚动偏移。 */
  scrollX: number;
  /** 垂直方向的滚动偏移。 */
  scrollY: number;
}
