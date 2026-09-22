export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasBounds extends CanvasPoint, CanvasSize {}

export interface CanvasCamera extends CanvasSize {
  zoom: number;
  scrollX: number;
  scrollY: number;
}

export const canvasZoomLimits = { min: 0.05, max: 8 };

export function clampCanvasZoom(value: number) {
  return Math.max(canvasZoomLimits.min, Math.min(canvasZoomLimits.max, value));
}

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

export function canvasViewportCenter(viewport: CanvasSize): CanvasPoint {
  const area = canvasSafeArea(viewport);
  return { x: area.x + area.width / 2, y: area.y + area.height / 2 };
}

export function canvasWorldPoint(camera: CanvasCamera, point: CanvasPoint): CanvasPoint {
  return {
    x: (point.x + camera.scrollX - camera.width) / camera.zoom,
    y: (point.y + camera.scrollY - camera.height) / camera.zoom,
  };
}

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

export function fitCanvasBounds(
  viewport: CanvasSize,
  bounds: CanvasBounds,
  maximumZoom: number,
): CanvasCamera {
  const area = canvasSafeArea(viewport);
  const zoom = clampCanvasZoom(Math.min(
    maximumZoom,
    area.width / Math.max(1, bounds.width),
    area.height / Math.max(1, bounds.height),
  ));
  const scroll = canvasAnchorScroll(viewport, zoom, {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }, canvasViewportCenter(viewport));
  return { ...viewport, zoom, scrollX: scroll.x, scrollY: scroll.y };
}
