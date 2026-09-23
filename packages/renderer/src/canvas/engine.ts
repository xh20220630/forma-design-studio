import type { DesignNode, DesignPage, ThemeTokens } from '@forma/schema';
import { CanvasPainter } from './painter';
import { multiply, transform, type Bounds, type Matrix, type Point } from './geometry';
import type { CanvasScene, SceneEntry } from './scene';

export interface CanvasView { width: number; height: number; zoom: number; x: number; y: number }
export interface CanvasOverlay {
  selectedIds: string[];
  hoverId?: string;
  marquee?: Bounds;
  guides: { axis: 'x' | 'y'; value: number; smart?: boolean }[];
  penPoints: Point[];
}

export class CanvasEngine {
  private painter: CanvasPainter;
  private context: CanvasRenderingContext2D;
  private overlayContext: CanvasRenderingContext2D;
  private frame = 0;
  private contentDirty = true;
  private overlayDirty = true;
  private disposed = false;
  private scene?: CanvasScene;
  private page?: DesignPage;
  private tokens?: ThemeTokens;
  private editingText?: string;
  private view: CanvasView = { width: 0, height: 0, zoom: 1, x: 0, y: 0 };
  private overlay: CanvasOverlay = { selectedIds: [], guides: [], penPoints: [] };
  private ratio = 1;

  constructor(private canvas: HTMLCanvasElement, private overlayCanvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d'), overlayContext = overlayCanvas.getContext('2d');
    if (!context || !overlayContext) throw new Error('浏览器不支持 Canvas 2D');
    this.context = context; this.overlayContext = overlayContext;
    this.painter = new CanvasPainter(() => this.invalidate(true));
    document.fonts.addEventListener('loadingdone', this.painter.clearCaches);
    void document.fonts.ready.then(() => { if (!this.disposed) this.painter.clearCaches(); });
    canvas.addEventListener('contextrestored', this.restore);
    overlayCanvas.addEventListener('contextrestored', this.restore);
    window.addEventListener('resize', this.resize);
  }

  private restore = () => this.invalidate(true);
  private resize = () => this.setView(this.view);

  setScene(scene: CanvasScene, page: DesignPage, tokens: ThemeTokens, editingText?: string) {
    this.scene = scene; this.page = page; this.tokens = tokens; this.editingText = editingText;
    this.painter.retain(scene.entries);
    this.invalidate(true);
  }

  setView(view: CanvasView) {
    this.view = view;
    // Bound both dimensions and total backing pixels, including very large/high-DPI displays.
    this.ratio = Math.max(0.1, Math.min(window.devicePixelRatio || 1, 2,
      8192 / Math.max(1, view.width), 8192 / Math.max(1, view.height),
      Math.sqrt(16_000_000 / Math.max(1, view.width * view.height))));
    for (const canvas of [this.canvas, this.overlayCanvas]) {
      const width = Math.max(1, Math.ceil(view.width * this.ratio)), height = Math.max(1, Math.ceil(view.height * this.ratio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    }
    this.invalidate(true);
  }

  setOverlay(overlay: CanvasOverlay) { this.overlay = overlay; this.invalidate(false); }

  entry(id: string) { return this.scene?.nodes.get(id); }

  query(bounds: Bounds) {
    const ids = new Set<string>();
    for (const entry of this.scene?.index.query(bounds) ?? []) {
      if (!entry.locked && entry.visible && this.intersectsClips(entry, bounds)) ids.add(entry.target.id);
    }
    return [...ids];
  }

  private intersectsClips(entry: SceneEntry, bounds: Bounds) {
    // Clip bounds are a conservative broad phase; exact point hits below use paths.
    return entry.clips.every(clip => {
      const corners = [transform(clip.inverse, bounds), transform(clip.inverse, { x: bounds.x + bounds.width, y: bounds.y }),
        transform(clip.inverse, { x: bounds.x, y: bounds.y + bounds.height }),
        transform(clip.inverse, { x: bounds.x + bounds.width, y: bounds.y + bounds.height })];
      return Math.max(...corners.map(p => p.x)) >= 0 && Math.min(...corners.map(p => p.x)) <= clip.node.width &&
        Math.max(...corners.map(p => p.y)) >= 0 && Math.min(...corners.map(p => p.y)) <= clip.node.height;
    });
  }

  hitTest(point: Point): DesignNode | undefined {
    const tolerance = 4 / this.view.zoom;
    const candidates = this.scene?.index.query({ x: point.x - tolerance, y: point.y - tolerance, width: tolerance * 2, height: tolerance * 2 }) ?? [];
    candidates.sort((a, b) => b.order - a.order);
    const ctx = this.overlayContext;
    ctx.save(); ctx.resetTransform();
    for (const entry of candidates) {
      if (!entry.visible || !entry.clips.every(clip => {
        const local = transform(clip.inverse, point);
        return ctx.isPointInPath(this.painter.paths.clip(clip.node), local.x, local.y);
      })) continue;
      const node = entry.node, local = transform(entry.inverse, point);
      const path = this.painter.paths.get(node);
      const open = node.type === 'line' || node.type === 'path' && !node.closed;
      const localScale = Math.max(0.001, Math.min(Math.hypot(entry.matrix[0], entry.matrix[1]), Math.hypot(entry.matrix[2], entry.matrix[3])));
      ctx.lineWidth = Math.max(node.strokeWidth ?? 1, tolerance * 2 / localScale);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
      if ((!open && ctx.isPointInPath(path, local.x, local.y)) || ctx.isPointInStroke(path, local.x, local.y)) {
        ctx.restore(); return entry.target;
      }
    }
    ctx.restore();
  }

  invalidate(content: boolean) {
    if (this.disposed) return;
    this.contentDirty ||= content; this.overlayDirty = true;
    if (!this.frame) this.frame = requestAnimationFrame(this.draw);
  }

  private get camera(): Matrix {
    return [this.view.zoom * this.ratio, 0, 0, this.view.zoom * this.ratio, this.view.x * this.ratio, this.view.y * this.ratio];
  }

  private get visibleBounds(): Bounds {
    return { x: -this.view.x / this.view.zoom, y: -this.view.y / this.view.zoom,
      width: this.view.width / this.view.zoom, height: this.view.height / this.view.zoom };
  }

  private draw = () => {
    this.frame = 0;
    if (this.disposed || !this.scene || !this.tokens || !this.page || !this.view.width || !this.view.height) return;
    const camera = this.camera;
    const visible = this.scene.index.query(this.visibleBounds).sort((a, b) => a.order - b.order);
    if (this.contentDirty) {
      const ctx = this.context;
      ctx.resetTransform(); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(...camera);
      ctx.fillStyle = this.page.background ?? this.tokens.background;
      ctx.fillRect(0, 0, this.page.width, this.page.height);
      for (const entry of visible) this.painter.draw(ctx, entry, camera, this.tokens, entry.target.id === this.editingText);
      // Small, inspectable performance counters; no React state update during painting.
      this.canvas.dataset.visibleNodes = String(visible.length);
      this.canvas.dataset.sceneNodes = String(this.scene.entries.length);
      this.canvas.dataset.renderCount = String(Number(this.canvas.dataset.renderCount ?? 0) + 1);
      this.contentDirty = false;
    }
    if (this.overlayDirty) {
      this.drawOverlay(visible);
      this.overlayDirty = false;
    }
  };

  private drawOverlay(visible: SceneEntry[]) {
    const ctx = this.overlayContext, zoom = this.view.zoom, camera = this.camera;
    ctx.resetTransform(); ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    ctx.setTransform(...camera);
    const page = this.page!, bounds = this.visibleBounds;
    if (page.grid?.enabled) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, page.width, page.height); ctx.clip();
      const grid = page.grid;
      ctx.fillStyle = '#ef444420'; ctx.strokeStyle = '#ef444425'; ctx.lineWidth = 1 / zoom;
      if (grid.type === 'columns') {
        const columns = Math.max(1, Math.min(256, grid.columns ?? 12)), margin = grid.margin ?? 32, gap = grid.gutter ?? 20;
        const width = Math.max(0, (page.width - margin * 2 - gap * (columns - 1)) / columns);
        for (let index = 0; index < columns; index++) ctx.fillRect(margin + index * (width + gap), 0, width, page.height);
      } else {
        // Suppress subpixel grid lines instead of drawing thousands of indistinguishable lines.
        const size = Math.max(1, grid.size), step = size * Math.max(1, Math.ceil(4 / (size * zoom)));
        ctx.beginPath();
        for (let x = Math.max(0, Math.ceil(bounds.x / step) * step); x <= Math.min(page.width, bounds.x + bounds.width); x += step) { ctx.moveTo(x, Math.max(0, bounds.y)); ctx.lineTo(x, Math.min(page.height, bounds.y + bounds.height)); }
        for (let y = Math.max(0, Math.ceil(bounds.y / step) * step); y <= Math.min(page.height, bounds.y + bounds.height); y += step) { ctx.moveTo(Math.max(0, bounds.x), y); ctx.lineTo(Math.min(page.width, bounds.x + bounds.width), y); }
        ctx.stroke();
      }
      ctx.restore();
    }
    const selected = new Set(this.overlay.selectedIds);
    for (const entry of visible) {
      if (entry.target.id !== entry.node.id) continue;
      if (selected.has(entry.node.id) || entry.node.id === this.overlay.hoverId) {
        ctx.setTransform(...multiply(camera, entry.matrix));
        ctx.strokeStyle = entry.node.type === 'component' ? '#9747ff' : '#0d99ff'; ctx.lineWidth = 1 / zoom;
        ctx.strokeRect(0, 0, entry.node.width, entry.node.height);
      }
      if (entry.node.prototype) {
        ctx.setTransform(...multiply(camera, entry.matrix));
        ctx.fillStyle = '#0d99ff'; ctx.beginPath();
        ctx.moveTo(entry.node.width - 12 / zoom, 3 / zoom); ctx.lineTo(entry.node.width - 3 / zoom, 8 / zoom);
        ctx.lineTo(entry.node.width - 12 / zoom, 13 / zoom); ctx.closePath(); ctx.fill();
      }
    }
    ctx.setTransform(...camera); ctx.lineWidth = 1 / zoom;
    for (const guide of this.overlay.guides) {
      ctx.strokeStyle = guide.smart ? '#ef4444' : '#0d99ff'; ctx.beginPath();
      if (guide.axis === 'x') { ctx.moveTo(guide.value, 0); ctx.lineTo(guide.value, page.height); }
      else { ctx.moveTo(0, guide.value); ctx.lineTo(page.width, guide.value); }
      ctx.stroke();
    }
    const marquee = this.overlay.marquee;
    if (marquee) {
      ctx.fillStyle = '#0d99ff18'; ctx.strokeStyle = '#0d99ff';
      ctx.fillRect(marquee.x, marquee.y, marquee.width, marquee.height); ctx.strokeRect(marquee.x, marquee.y, marquee.width, marquee.height);
    }
    if (this.overlay.penPoints.length) {
      ctx.strokeStyle = '#0d99ff'; ctx.fillStyle = '#fff'; ctx.beginPath();
      this.overlay.penPoints.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
      for (const point of this.overlay.penPoints) { ctx.beginPath(); ctx.arc(point.x, point.y, 3 / zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame);
    document.fonts.removeEventListener('loadingdone', this.painter.clearCaches);
    this.canvas.removeEventListener('contextrestored', this.restore);
    this.overlayCanvas.removeEventListener('contextrestored', this.restore);
    window.removeEventListener('resize', this.resize);
    this.painter.dispose();
    this.canvas.width = this.canvas.height = this.overlayCanvas.width = this.overlayCanvas.height = 1;
  }
}
