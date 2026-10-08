import type { DesignPage } from '@forma/schema';
import { multiply, type Bounds, type Matrix } from './geometry.ts';
import type { SceneEntry } from './scene.ts';
import type { CanvasOverlay, CanvasView } from './types.ts';

export function drawCanvasOverlay(
  context: CanvasRenderingContext2D,
  camera: Matrix,
  view: CanvasView,
  page: DesignPage,
  overlay: CanvasOverlay,
  bounds: Bounds,
  visible: SceneEntry[],
) {
  const ctx = context,
    zoom = view.zoom;
  ctx.resetTransform();
  ctx.clearRect(0, 0, context.canvas.width, context.canvas.height);
  ctx.setTransform(...camera);
  if (page.grid?.enabled) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, page.width, page.height);
    ctx.clip();
    const grid = page.grid;
    ctx.fillStyle = '#ef444420';
    ctx.strokeStyle = '#ef444425';
    ctx.lineWidth = 1 / zoom;
    if (grid.type === 'columns') {
      const columns = Math.max(1, Math.min(256, grid.columns ?? 12)),
        margin = grid.margin ?? 32,
        gap = grid.gutter ?? 20;
      const width = Math.max(0, (page.width - margin * 2 - gap * (columns - 1)) / columns);
      for (let index = 0; index < columns; index++)
        ctx.fillRect(margin + index * (width + gap), 0, width, page.height);
    } else {
      // Suppress subpixel grid lines instead of drawing thousands of indistinguishable lines.
      const size = Math.max(1, grid.size),
        step = size * Math.max(1, Math.ceil(4 / (size * zoom)));
      ctx.beginPath();
      for (
        let x = Math.max(0, Math.ceil(bounds.x / step) * step);
        x <= Math.min(page.width, bounds.x + bounds.width);
        x += step
      ) {
        ctx.moveTo(x, Math.max(0, bounds.y));
        ctx.lineTo(x, Math.min(page.height, bounds.y + bounds.height));
      }
      for (
        let y = Math.max(0, Math.ceil(bounds.y / step) * step);
        y <= Math.min(page.height, bounds.y + bounds.height);
        y += step
      ) {
        ctx.moveTo(Math.max(0, bounds.x), y);
        ctx.lineTo(Math.min(page.width, bounds.x + bounds.width), y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  const selected = new Set(overlay.selectedIds);
  for (const entry of visible) {
    if (entry.target.id !== entry.node.id) continue;
    if (selected.has(entry.node.id) || entry.node.id === overlay.hoverId) {
      ctx.setTransform(...multiply(camera, entry.matrix));
      ctx.strokeStyle = entry.node.type === 'component' ? '#9747ff' : '#0d99ff';
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(0, 0, entry.node.width, entry.node.height);
    }
    if (entry.node.prototype) {
      ctx.setTransform(...multiply(camera, entry.matrix));
      ctx.fillStyle = '#0d99ff';
      ctx.beginPath();
      ctx.moveTo(entry.node.width - 12 / zoom, 3 / zoom);
      ctx.lineTo(entry.node.width - 3 / zoom, 8 / zoom);
      ctx.lineTo(entry.node.width - 12 / zoom, 13 / zoom);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.setTransform(...camera);
  ctx.lineWidth = 1 / zoom;
  if (overlay.selectionBounds) {
    const bounds = overlay.selectionBounds;
    ctx.strokeStyle = '#0d99ff';
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }
  for (const guide of overlay.guides) {
    ctx.strokeStyle = guide.smart ? '#ef4444' : '#0d99ff';
    ctx.beginPath();
    if (guide.axis === 'x') {
      ctx.moveTo(guide.value, 0);
      ctx.lineTo(guide.value, page.height);
    } else {
      ctx.moveTo(0, guide.value);
      ctx.lineTo(page.width, guide.value);
    }
    ctx.stroke();
  }
  const marquee = overlay.marquee;
  if (marquee) {
    ctx.fillStyle = '#0d99ff18';
    ctx.strokeStyle = '#0d99ff';
    ctx.fillRect(marquee.x, marquee.y, marquee.width, marquee.height);
    ctx.strokeRect(marquee.x, marquee.y, marquee.width, marquee.height);
  }
  if (overlay.penPoints.length) {
    ctx.strokeStyle = '#0d99ff';
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    overlay.penPoints.forEach((point, index) =>
      index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
    );
    ctx.stroke();
    for (const point of overlay.penPoints) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
