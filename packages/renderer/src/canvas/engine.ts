import { drawCanvasOverlay } from './overlay.ts';
import type { CanvasOverlay, CanvasView } from './types.ts';
export type { CanvasOverlay, CanvasView } from './types.ts';
import type { DesignNode, DesignPage, Project, ThemeTokens } from '@forma/schema';
import { getProjectTokens } from '../shared/scene-values.ts';
import { CanvasPainter } from './painter.ts';
import { intersects, transform, type Bounds, type Matrix, type Point } from './geometry.ts';
import { SceneCompiler, type CanvasScene, type SceneEntry } from './scene.ts';
import { Canvas2DCompositor, WebGL2Compositor, type TileCompositor } from './compositor.ts';
import { TileCache, planTiles, tileGutter, tilePaintBounds, type SceneTile } from './tiles.ts';
import { translationLayers, selectionBounds, type TranslationLayer } from './translation.ts';

/** 协调内容层与叠加层的绘制、命中检测和资源释放。 */
export class CanvasEngine {
  /** 节点绘制器，负责复用路径、文字和图片缓存。 */
  private painter: CanvasPainter;
  private compiler = new SceneCompiler();
  private compositor: TileCompositor;
  private tiles: TileCache;
  private gpuCanvas?: HTMLCanvasElement;
  private rasterizedNodes = 0;
  /** 绘制选框等编辑辅助信息的独立 Canvas 上下文。 */
  private overlayContext: CanvasRenderingContext2D;
  /** 待执行绘制帧的句柄，0 表示未排队。 */
  private frame = 0;
  /** 内容层是否需要重绘；单纯改变选区时可保留已有内容。 */
  private contentDirty = true;
  /** 选择框或辅助线等叠加层是否需要重绘。 */
  private overlayDirty = true;
  /** 资源是否已释放，用于拒绝之后的异步刷新。 */
  private disposed = false;
  /** 已经编译好的绘制场景。 */
  private scene?: CanvasScene;
  /** 当前正在展示或编辑的页面。 */
  private page?: DesignPage;
  /** 设计主题或语义 Token 集合。 */
  private tokens?: ThemeTokens;
  /** 正在通过文本编辑框修改的节点 ID。 */
  private editingText?: string;
  /** 当前视图或画布相机参数。 */
  private view: CanvasView = { width: 0, height: 0, zoom: 1, x: 0, y: 0 };
  /** 本帧需要绘制的选择和辅助信息。 */
  private overlay: CanvasOverlay = { selectedIds: [], guides: [], penPoints: [] };
  /** 实际绘图像素与 CSS 像素的比例。 */
  private ratio = 1;
  private canvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private translation?: {
    ids: Set<string>;
    layers: TranslationLayer[];
    x: number;
    y: number;
    guides: CanvasOverlay['guides'];
  };
  private selectionBounds?: Bounds;
  private paintJobs = new WeakMap<
    SceneTile,
    { generation: number; entries: SceneEntry[]; offset: number; camera: Matrix }
  >();
  private lastVisibleCount = -Infinity;

  constructor(
    canvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement,
    gpuCanvas?: HTMLCanvasElement,
  ) {
    this.canvas = canvas;
    this.overlayCanvas = overlayCanvas;
    this.gpuCanvas = gpuCanvas;
    const overlayContext = overlayCanvas.getContext('2d');
    if (!overlayContext) throw new Error('浏览器不支持 Canvas 2D');
    this.overlayContext = overlayContext;
    try {
      if (!gpuCanvas) throw new Error('No GPU surface');
      this.compositor = new WebGL2Compositor(gpuCanvas);
    } catch {
      this.compositor = new Canvas2DCompositor(canvas);
    }
    this.syncSurface();
    this.tiles = new TileCache((tile) => this.compositor.release(tile));
    this.painter = new CanvasPainter((source) => {
      this.tiles.invalidate(
        source
          ? this.scene?.entries
              .filter((entry) => entry.node.src === source)
              .map((entry) => entry.bounds)
          : undefined,
      );
      this.invalidate(true);
    });
    document.fonts.addEventListener('loadingdone', this.painter.clearCaches);
    if (document.fonts.status === 'loading')
      void document.fonts.ready.then(() => {
        if (!this.disposed) this.painter.clearCaches();
      });
    canvas.addEventListener('contextrestored', this.restore);
    overlayCanvas.addEventListener('contextrestored', this.restore);
    gpuCanvas?.addEventListener('webglcontextlost', this.contextLost);
    window.addEventListener('resize', this.resize);
  }

  /**
   * 恢复当前界面或绘图状态，使外部变化正确反映到界面。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  private restore = () => this.invalidate(true);
  /**
   * 重新计算可用尺寸，使绘制与容器大小一致。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  private resize = () => this.setView(this.view);

  private syncSurface() {
    if (this.gpuCanvas) {
      this.gpuCanvas.style.visibility = this.compositor.kind === 'webgl2' ? 'visible' : 'hidden';
      // 保留承载画布说明的无障碍节点，GPU 表面仅负责显示。
      this.canvas.style.opacity = this.compositor.kind === 'webgl2' ? '0' : '1';
    }
    this.canvas.dataset.backend = this.compositor.kind;
  }

  private fallback() {
    if (this.compositor.kind === 'canvas2d') return;
    this.compositor.dispose();
    this.compositor = new Canvas2DCompositor(this.canvas);
    this.syncSurface();
  }

  private contextLost = (event: Event) => {
    event.preventDefault();
    this.fallback();
    this.invalidate(true);
  };

  // 保留场景只在 React 提交后更新，避免被放弃的 render 修改当前命中索引。
  setDocument(page: DesignPage, project: Project, editingText?: string) {
    if (page !== this.page) this.endTranslation();
    this.setScene(
      this.compiler.compile(page, project),
      page,
      getProjectTokens(project),
      editingText,
    );
  }

  /**
   * 替换渲染场景并清理失效缓存，让下一帧显示最新设计。
   *
   * @param scene - 已经编译好的绘制场景。
   * @param page - 当前正在展示或编辑的页面。
   * @param tokens - 设计主题或语义 Token 集合。
   * @param editingText - 正在通过文本编辑框修改的节点 ID。
   * @returns 无返回值；标记画布需要重绘。
   */
  setScene(scene: CanvasScene, page: DesignPage, tokens: ThemeTokens, editingText?: string) {
    const changed = scene !== this.scene;
    const full =
      !this.page ||
      page.id !== this.page.id ||
      page.width !== this.page.width ||
      page.height !== this.page.height ||
      page.background !== this.page.background ||
      tokens !== this.tokens;
    if (full || (changed && (!scene.changes || scene.changes.full))) this.tiles.invalidate();
    else if (changed) this.tiles.invalidate(scene.changes!.bounds);
    if (editingText !== this.editingText) {
      const bounds = [
        this.scene?.nodes.get(this.editingText ?? '')?.bounds,
        scene.nodes.get(editingText ?? '')?.bounds,
      ].filter((area): area is Bounds => Boolean(area));
      this.tiles.invalidate(bounds);
    }
    const repaint = changed || full || editingText !== this.editingText;
    if (changed) {
      if (scene.changes && this.scene?.index === scene.index)
        this.painter.sync(scene.changes.added, scene.changes.removed);
      else this.painter.retain(scene.entries);
    }
    this.scene = scene;
    if (changed) this.selectionBounds = selectionBounds(scene, this.overlay.selectedIds);
    this.page = page;
    this.tokens = tokens;
    this.editingText = editingText;
    this.invalidate(repaint);
  }

  /** 滚动层重定位时可同步重绘，保证视口位置与位图在同次提交中更新。 */
  setView(view: CanvasView, immediate = false) {
    if (
      ![view.width, view.height, view.zoom, view.x, view.y].every(Number.isFinite) ||
      view.zoom <= 0
    )
      return;
    this.view = view;
    // Bound both dimensions and total backing pixels, including very large/high-DPI displays.
    this.ratio = Math.max(
      0.1,
      Math.min(
        window.devicePixelRatio || 1,
        2,
        8192 / Math.max(1, view.width),
        8192 / Math.max(1, view.height),
        Math.sqrt(16_000_000 / Math.max(1, view.width * view.height)),
      ),
    );
    for (const canvas of [this.canvas, this.overlayCanvas, this.gpuCanvas]) {
      if (!canvas) continue;
      const width = Math.max(1, Math.ceil(view.width * this.ratio)),
        height = Math.max(1, Math.ceil(view.height * this.ratio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    }
    this.invalidate(true);
    if (immediate) {
      cancelAnimationFrame(this.frame);
      this.draw();
    }
  }

  /**
   * 只更新选择框、辅助线等叠加信息，避免交互时重画整个设计。
   *
   * @param overlay - 本帧需要绘制的选择和辅助信息。
   * @returns 无返回值；请求叠加层重绘。
   */
  setOverlay(overlay: CanvasOverlay) {
    if (this.scene && overlay.selectedIds !== this.overlay.selectedIds)
      this.selectionBounds = selectionBounds(this.scene, overlay.selectedIds);
    this.overlay = overlay;
    this.invalidate(false);
  }

  beginTranslation(ids: string[]) {
    if (!this.scene) return false;
    const selected = new Set(ids);
    const layers = translationLayers(this.scene, selected);
    if (!layers) return false;
    this.translation = { ids: selected, layers, x: 0, y: 0, guides: [] };
    return true;
  }

  translate(x: number, y: number, guides: CanvasOverlay['guides']) {
    if (!this.translation) return;
    Object.assign(this.translation, { x, y, guides });
    this.invalidate(true);
  }

  endTranslation() {
    if (!this.translation) return;
    this.translation = undefined;
    this.tiles.clear();
    this.invalidate(true);
  }

  /**
   * 通过节点 ID 取得编译后的场景信息，供交互层读取变换和边界。
   *
   * @param id - 唯一标识，用于查找、更新和建立引用。
   * @returns 场景条目；找不到时返回 undefined。
   */
  entry(id: string) {
    return this.scene?.nodes.get(id);
  }

  /**
   * 从空间索引中筛选可见、未锁定且符合裁剪范围的节点，供框选使用。
   *
   * @param bounds - 用于布局、查询或素材定位的矩形范围。
   * @returns 可参与框选的去重节点 ID。
   */
  query(bounds: Bounds) {
    const ids = new Set<string>();
    for (const entry of this.scene?.index.query(bounds) ?? []) {
      if (!entry.locked && entry.visible && this.intersectsClips(entry, bounds))
        ids.add(entry.target.id);
    }
    return [...ids];
  }

  /**
   * 先用裁剪区域的边界排除不可能命中的条目，降低框选计算量。
   *
   * @param entry - 缓存的已编译场景条目。
   * @param bounds - 用于布局、查询或素材定位的矩形范围。
   * @returns 候选区域是否通过全部裁剪边界检查。
   */
  private intersectsClips(entry: SceneEntry, bounds: Bounds) {
    // Clip bounds are a conservative broad phase; exact point hits below use paths.
    return entry.clips.every((clip) => {
      const corners = [
        transform(clip.inverse, bounds),
        transform(clip.inverse, { x: bounds.x + bounds.width, y: bounds.y }),
        transform(clip.inverse, { x: bounds.x, y: bounds.y + bounds.height }),
        transform(clip.inverse, { x: bounds.x + bounds.width, y: bounds.y + bounds.height }),
      ];
      return (
        Math.max(...corners.map((p) => p.x)) >= 0 &&
        Math.min(...corners.map((p) => p.x)) <= clip.node.width &&
        Math.max(...corners.map((p) => p.y)) >= 0 &&
        Math.min(...corners.map((p) => p.y)) <= clip.node.height
      );
    });
  }

  /**
   * 从上层节点向下检查局部路径和裁剪范围，找出指针实际命中的图层。
   *
   * @param point - 当前处理的坐标点。
   * @returns 命中的设计节点；没有命中时返回 undefined。
   */
  hitTest(point: Point): DesignNode | undefined {
    const tolerance = 4 / this.view.zoom;
    const candidates =
      this.scene?.index.query({
        x: point.x - tolerance,
        y: point.y - tolerance,
        width: tolerance * 2,
        height: tolerance * 2,
      }) ?? [];
    candidates.sort((a, b) => b.order - a.order);
    const ctx = this.overlayContext;
    ctx.save();
    ctx.resetTransform();
    for (const entry of candidates) {
      if (
        !entry.visible ||
        !entry.clips.every((clip) => {
          const local = transform(clip.inverse, point);
          return ctx.isPointInPath(this.painter.paths.clip(clip.node), local.x, local.y);
        })
      )
        continue;
      const node = entry.node,
        local = transform(entry.inverse, point);
      const path = this.painter.paths.get(node);
      const open = node.type === 'line' || (node.type === 'path' && !node.closed);
      const localScale = Math.max(
        0.001,
        Math.min(
          Math.hypot(entry.matrix[0], entry.matrix[1]),
          Math.hypot(entry.matrix[2], entry.matrix[3]),
        ),
      );
      ctx.lineWidth = Math.max(node.strokeWidth ?? 1, (tolerance * 2) / localScale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      if (
        (!open && ctx.isPointInPath(path, local.x, local.y)) ||
        ctx.isPointInStroke(path, local.x, local.y)
      ) {
        ctx.restore();
        return entry.target;
      }
    }
    ctx.restore();
  }

  /**
   * 合并同一帧内的重绘请求，只在内容变化时重画底层画布。
   *
   * @param content - 文件、消息或编辑文档的正文。
   * @returns 无返回值；安排下一次动画帧。
   */
  invalidate(content: boolean) {
    if (this.disposed) return;
    this.contentDirty ||= content;
    this.overlayDirty = true;
    if (!this.frame) this.frame = requestAnimationFrame(this.draw);
  }

  /**
   * 合并缩放、平移和设备像素比，作为实际 Canvas 绘图变换。
   * @returns 设计坐标到画布像素的矩阵。
   */
  private get camera(): Matrix {
    return [
      this.view.zoom * this.ratio,
      0,
      0,
      this.view.zoom * this.ratio,
      this.view.x * this.ratio,
      this.view.y * this.ratio,
    ];
  }

  /**
   * 把视口还原为设计空间中的矩形，供空间索引裁剪离屏内容。
   * @returns 当前可见的设计坐标区域。
   */
  private get visibleBounds(): Bounds {
    return {
      x: -this.view.x / this.view.zoom,
      y: -this.view.y / this.view.zoom,
      width: this.view.width / this.view.zoom,
      height: this.view.height / this.view.zoom,
    };
  }

  /**
   * 根据当前场景绘制画布，并复用可用的缓存。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  private draw = () => {
    this.frame = 0;
    if (
      this.disposed ||
      !this.scene ||
      !this.tokens ||
      !this.page ||
      !this.view.width ||
      !this.view.height
    )
      return;
    const started = performance.now();
    const camera = this.camera;
    if (this.contentDirty) {
      const layers = this.translation?.layers ?? [
        { index: this.scene.index, background: true, moving: false },
      ];
      const batches = layers.map((layer, index) => {
        const dx = layer.moving ? this.translation!.x : 0,
          dy = layer.moving ? this.translation!.y : 0;
        const bounds = {
          ...this.visibleBounds,
          x: this.visibleBounds.x - dx,
          y: this.visibleBounds.y - dy,
        };
        const prefix = this.translation ? `gesture${index}/` : 'scene/';
        const addresses = planTiles(
          bounds,
          this.view.zoom * this.ratio,
          Math.floor(this.tiles.capacity / (layers.length * 2)),
        );
        const tiles = addresses.map((address) =>
          this.tiles.get({ ...address, key: prefix + address.key }),
        );
        return {
          layer,
          tiles,
          bounds,
          prefix,
          camera: [
            camera[0],
            camera[1],
            camera[2],
            camera[3],
            camera[4] + dx * camera[0],
            camera[5] + dy * camera[3],
          ] as Matrix,
        };
      });
      let rasterizedTiles = 0;
      this.rasterizedNodes = 0;
      const deadline = started + 6;
      for (const batch of batches) {
        for (const tile of batch.tiles) {
          if (!tile.dirty || performance.now() >= deadline) continue;
          if (this.paintTile(tile, batch.layer, deadline)) rasterizedTiles++;
        }
      }
      const pending = batches.some((batch) => batch.tiles.some((tile) => tile.dirty));
      const composite = () => {
        this.compositor.begin();
        for (const batch of batches) {
          // 新档位尚未补齐时复用完整旧瓦片，透明图层按区域裁切，避免重复混合。
          for (const tile of batch.tiles) {
            if (!tile.dirty) this.compositor.draw(tile, batch.camera);
            else {
              const fallback = this.tiles
                .completed(tile.bounds, batch.prefix)
                .filter((other) => other.scale < tile.scale)
                .sort((a, b) => b.scale - a.scale)
                .find(
                  (other) =>
                    other.bounds.x <= tile.bounds.x &&
                    other.bounds.y <= tile.bounds.y &&
                    other.bounds.x + other.bounds.width >= tile.bounds.x + tile.bounds.width &&
                    other.bounds.y + other.bounds.height >= tile.bounds.y + tile.bounds.height,
                );
              if (fallback) this.compositor.draw(fallback, batch.camera, tile.bounds);
            }
          }
        }
        this.compositor.end();
      };
      try {
        composite();
      } catch (error) {
        if (this.compositor.kind !== 'webgl2') throw error;
        this.fallback();
        this.canvas.dataset.fallbackReason = error instanceof Error ? error.message : String(error);
        composite();
      }
      this.canvas.dataset.rasterizedTiles = String(rasterizedTiles);
      this.canvas.dataset.rasterizedNodes = String(this.rasterizedNodes);
      this.canvas.dataset.visibleTiles = String(
        batches.reduce((sum, batch) => sum + batch.tiles.length, 0),
      );
      this.canvas.dataset.pendingTiles = String(
        batches.reduce((sum, batch) => sum + batch.tiles.filter((tile) => tile.dirty).length, 0),
      );
      this.canvas.dataset.tileCacheBytes = String(this.tiles.bytes);
      this.canvas.dataset.textureUploads = String(this.compositor.uploads);
      if (started - this.lastVisibleCount >= 250) {
        this.canvas.dataset.visibleNodes = String(
          this.scene.index.query(this.visibleBounds).length,
        );
        this.lastVisibleCount = started;
      }
      this.canvas.dataset.sceneNodes = String(this.scene.entries.length);
      this.canvas.dataset.renderCount = String(Number(this.canvas.dataset.renderCount ?? 0) + 1);
      this.canvas.dataset.viewX = String(this.view.x);
      this.canvas.dataset.viewY = String(this.view.y);
      this.contentDirty = pending;
      if (pending && !this.frame) this.frame = requestAnimationFrame(this.draw);
    }
    if (this.overlayDirty) {
      drawCanvasOverlay(
        this.overlayContext,
        camera,
        this.view,
        this.page,
        {
          ...this.overlay,
          guides: [...this.overlay.guides, ...(this.translation?.guides ?? [])],
          selectionBounds:
            this.overlay.selectedIds.length > 200 && this.selectionBounds
              ? {
                  ...this.selectionBounds,
                  x: this.selectionBounds.x + (this.translation?.x ?? 0),
                  y: this.selectionBounds.y + (this.translation?.y ?? 0),
                }
              : undefined,
        },
        this.visibleBounds,
        this.overlayEntries(),
      );
      this.overlayDirty = false;
    }
    this.canvas.dataset.frameTimeMs = (performance.now() - started).toFixed(2);
  };

  private paintTile(
    tile: SceneTile,
    layer: TranslationLayer = { index: this.scene!.index, background: true, moving: false },
    deadline = Infinity,
  ) {
    const ctx = tile.context;
    let job = this.paintJobs.get(tile);
    if (!job || job.generation !== tile.generation) {
      const camera: Matrix = [
        tile.scale,
        0,
        0,
        tile.scale,
        tileGutter - tile.bounds.x * tile.scale,
        tileGutter - tile.bounds.y * tile.scale,
      ];
      ctx.resetTransform();
      ctx.clearRect(0, 0, tile.canvas.width, tile.canvas.height);
      ctx.setTransform(...camera);
      if (layer.background) {
        ctx.fillStyle = this.page!.background ?? this.tokens!.background;
        ctx.fillRect(0, 0, this.page!.width, this.page!.height);
      }
      const entries = layer.index.query(tilePaintBounds(tile)).sort((a, b) => a.order - b.order);
      job = { generation: tile.generation, camera, entries, offset: 0 };
      this.paintJobs.set(tile, job);
    }
    while (job.offset < job.entries.length) {
      const entry = job.entries[job.offset++];
      this.painter.draw(ctx, entry, job.camera, this.tokens!, entry.target.id === this.editingText);
      this.rasterizedNodes++;
      if (job.offset % 8 === 0 && performance.now() >= deadline) return false;
    }
    this.paintJobs.delete(tile);
    tile.version++;
    tile.dirty = false;
    return true;
  }

  private overlayEntries() {
    const scene = this.scene!;
    const entries = new Set<SceneEntry>();
    for (const id of [
      ...(this.overlay.selectedIds.length > 200 ? [] : this.overlay.selectedIds),
      this.overlay.hoverId,
    ]) {
      const entry = id ? scene.nodes.get(id) : undefined;
      if (entry) entries.add(entry);
    }
    for (const entry of scene.prototypes ?? scene.entries.filter((item) => item.node.prototype))
      entries.add(entry);
    const visibleEntries: SceneEntry[] = [];
    for (const entry of entries) {
      if (!entry.visible) continue;
      const delta = this.translation?.ids.has(entry.target.id) ? this.translation : undefined;
      const visible = delta
        ? {
            ...entry,
            matrix: [
              ...entry.matrix.slice(0, 4),
              entry.matrix[4] + delta.x,
              entry.matrix[5] + delta.y,
            ] as unknown as Matrix,
            bounds: { ...entry.bounds, x: entry.bounds.x + delta.x, y: entry.bounds.y + delta.y },
          }
        : entry;
      if (intersects(visible.bounds, this.visibleBounds)) visibleEntries.push(visible);
    }
    return visibleEntries;
  }

  /**
   * 释放监听器、计时器或渲染缓存，防止对象停用后仍占用资源。
   * @returns 无返回值；清理完成后结束。
   */
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    document.fonts.removeEventListener('loadingdone', this.painter.clearCaches);
    this.canvas.removeEventListener('contextrestored', this.restore);
    this.overlayCanvas.removeEventListener('contextrestored', this.restore);
    this.gpuCanvas?.removeEventListener('webglcontextlost', this.contextLost);
    window.removeEventListener('resize', this.resize);
    this.painter.dispose();
    this.tiles.clear();
    this.compositor.dispose();
    if (this.gpuCanvas) this.gpuCanvas.width = this.gpuCanvas.height = 1;
    this.canvas.width =
      this.canvas.height =
      this.overlayCanvas.width =
      this.overlayCanvas.height =
        1;
  }
}
