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

/** 集中维护 canvasZoomLimits 的约定值或当前状态，供相关分支保持一致。 */
export const canvasZoomLimits = { min: 0.05, max: 8 };

/**
 * 将缩放倍率限制在可用范围内，避免画布缩到不可见或放大过度。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @returns 限制后的缩放倍率。
 */
export function clampCanvasZoom(value: number) {
  return Math.max(canvasZoomLimits.min, Math.min(canvasZoomLimits.max, value));
}

/**
 * 扣除标尺、边距和工具栏空间，避免自动定位把内容放在控件下面。
 *
 * @param viewport - 画布可见区域的尺寸或相机状态。
 * @returns 视口中可用于展示设计的区域。
 */
export function canvasSafeArea(viewport: CanvasSize): CanvasBounds {
  const gutter = 24;
  const ruler = 20;
  const tools = 72;
  return {
    x: gutter + ruler,
    y: gutter + ruler,
    width: Math.max(1, viewport.width - gutter * 2 - ruler),
    height: Math.max(1, viewport.height - gutter * 2 - ruler - tools),
  };
}

/**
 * 取可用画布区域的中心，保证定位时避开外围工具栏。
 *
 * @param viewport - 画布可见区域的尺寸或相机状态。
 * @returns 视口内的目标中心点。
 */
export function canvasViewportCenter(viewport: CanvasSize): CanvasPoint {
  const area = canvasSafeArea(viewport);
  return { x: area.x + area.width / 2, y: area.y + area.height / 2 };
}

/**
 * 把视口坐标还原成设计坐标，抵消滚动偏移与缩放。
 *
 * @param camera - 用于坐标换算的当前视口状态。
 * @param point - 当前处理的坐标点。
 * @returns 画布世界坐标。
 */
export function canvasWorldPoint(camera: CanvasCamera, point: CanvasPoint): CanvasPoint {
  return {
    x: (point.x + camera.scrollX - camera.width) / camera.zoom,
    y: (point.y + camera.scrollY - camera.height) / camera.zoom,
  };
}

/**
 * 计算保持锚点位置所需的滚动量，使鼠标位置在缩放时保持稳定。
 *
 * @param viewport - 画布可见区域的尺寸或相机状态。
 * @param zoom - 缩放倍率，1 表示原始尺寸。
 * @param world - 设计空间中的坐标点。
 * @param anchor - 缩放前后需要保持屏幕位置的锚点。
 * @returns 应设置的水平和垂直滚动值。
 */
export function canvasAnchorScroll(
  viewport: CanvasSize,
  zoom: number,
  world: CanvasPoint,
  anchor: CanvasPoint,
): CanvasPoint {
  return {
    x: viewport.width + world.x * zoom - anchor.x,
    y: viewport.height + world.y * zoom - anchor.y,
  };
}

/**
 * 补偿浏览器对滚动范围的提前截断，避免相机尺寸变化时平移跳动。
 *
 * @param source - 原始数据或操作开始时的状态。
 * @param current - 更新前的当前值。
 * @param maximum - 允许的最大坐标或数值。
 * @returns 尚需应用的平移差值。
 */
export function canvasPendingPanDelta(
  source: CanvasPoint,
  current: CanvasPoint,
  maximum: CanvasPoint,
): CanvasPoint {
  // A smaller stage can clamp native scroll before the new camera is applied.
  return {
    x: current.x - Math.max(0, Math.min(maximum.x, source.x)),
    y: current.y - Math.max(0, Math.min(maximum.y, source.y)),
  };
}

/**
 * 把目标区域完整放入可用视口，并限制最大倍率以保持舒适阅读。
 *
 * @param viewport - 画布可见区域的尺寸或相机状态。
 * @param bounds - 用于布局、查询或素材定位的矩形范围。
 * @param maximumZoom - 自动适配允许的最大缩放倍率。
 * @returns 包含缩放与滚动偏移的相机状态。
 */
export function fitCanvasBounds(
  viewport: CanvasSize,
  bounds: CanvasBounds,
  maximumZoom: number,
): CanvasCamera {
  const area = canvasSafeArea(viewport);
  const zoom = clampCanvasZoom(
    Math.min(
      maximumZoom,
      area.width / Math.max(1, bounds.width),
      area.height / Math.max(1, bounds.height),
    ),
  );
  const scroll = canvasAnchorScroll(
    viewport,
    zoom,
    {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    },
    canvasViewportCenter(viewport),
  );
  return { ...viewport, zoom, scrollX: scroll.x, scrollY: scroll.y };
}
