import type { DesignNode, DesignPage, ThemeTokens } from '@forma/schema';
import { CanvasPainter } from './painter';
import { multiply, transform, type Bounds, type Matrix, type Point } from './geometry';
import type { CanvasScene, SceneEntry } from './scene';

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

/** 协调内容层与叠加层的绘制、命中检测和资源释放。 */
export class CanvasEngine {
  /** 节点绘制器，负责复用路径、文字和图片缓存。 */
  private painter: CanvasPainter;
  /** 绘制内容层使用的 Canvas 2D 上下文。 */
  private context: CanvasRenderingContext2D;
  /** 绘制选框等编辑辅助信息的独立 Canvas 上下文。 */
  private overlayContext: CanvasRenderingContext2D;
  /** 页面在流程画布中的位置与尺寸，或待执行动画帧的句柄。 */
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

  /**
   * 建立 CanvasEngine 实例并保存其依赖，让后续操作共用同一份资源或状态。
   *
   * @param canvas - 承载设计内容的 Canvas 元素。
   * @param overlayCanvas - 承载交互辅助信息的 Canvas 元素。
   * @returns 构造完成的实例；构造函数不显式返回业务数据。
   */
  constructor(
    /** 承载设计内容的 Canvas 元素。 */
    private canvas: HTMLCanvasElement,

    /** 承载交互辅助信息的 Canvas 元素。 */
    private overlayCanvas: HTMLCanvasElement,
  ) {
    const context = canvas.getContext('2d'),
      overlayContext = overlayCanvas.getContext('2d');
    if (!context || !overlayContext) throw new Error('浏览器不支持 Canvas 2D');
    this.context = context;
    this.overlayContext = overlayContext;
    this.painter = new CanvasPainter(
      /** 执行function Object() { [native code] }传入的局部处理步骤，使调用处能够控制结果如何更新。 @returns 无返回值；通过副作用完成当前操作。 */
      () => this.invalidate(true),
    );
    document.fonts.addEventListener('loadingdone', this.painter.clearCaches);
    void document.fonts.ready.then(
      /**
       * 在function Object() { [native code] }的异步步骤结束后处理结果。
       * @returns 无返回值；通过副作用完成当前操作。
       */
      () => {
        if (!this.disposed) this.painter.clearCaches();
      },
    );
    canvas.addEventListener('contextrestored', this.restore);
    overlayCanvas.addEventListener('contextrestored', this.restore);
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
    this.scene = scene;
    this.page = page;
    this.tokens = tokens;
    this.editingText = editingText;
    this.painter.retain(scene.entries);
    this.invalidate(true);
  }

  /**
   * 更新相机与画布像素尺寸，并限制像素总量以控制高分屏内存占用。
   *
   * @param view - 当前视图或画布相机参数。
   * @returns 无返回值；更新视口并请求重绘。
   */
  setView(view: CanvasView) {
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
    for (const canvas of [this.canvas, this.overlayCanvas]) {
      const width = Math.max(1, Math.ceil(view.width * this.ratio)),
        height = Math.max(1, Math.ceil(view.height * this.ratio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    }
    this.invalidate(true);
  }

  /**
   * 只更新选择框、辅助线等叠加信息，避免交互时重画整个设计。
   *
   * @param overlay - 本帧需要绘制的选择和辅助信息。
   * @returns 无返回值；请求叠加层重绘。
   */
  setOverlay(overlay: CanvasOverlay) {
    this.overlay = overlay;
    this.invalidate(false);
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
    return entry.clips.every(
      /**
       * 判断 intersectsClips 中的条目是否符合检查条件。
       *
       * @param clip - 当前祖先裁剪区域。
       * @returns 该条目是否符合条件。
       */
      (clip) => {
        const corners = [
          transform(clip.inverse, bounds),
          transform(clip.inverse, { x: bounds.x + bounds.width, y: bounds.y }),
          transform(clip.inverse, { x: bounds.x, y: bounds.y + bounds.height }),
          transform(clip.inverse, { x: bounds.x + bounds.width, y: bounds.y + bounds.height }),
        ];
        return (
          Math.max(
            ...corners.map(
              /** 提取当前项的横坐标，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的横坐标。 */
              (p) => p.x,
            ),
          ) >= 0 &&
          Math.min(
            ...corners.map(
              /** 提取当前项的横坐标，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的横坐标。 */
              (p) => p.x,
            ),
          ) <= clip.node.width &&
          Math.max(
            ...corners.map(
              /** 提取当前项的纵坐标，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的纵坐标。 */
              (p) => p.y,
            ),
          ) >= 0 &&
          Math.min(
            ...corners.map(
              /** 提取当前项的纵坐标，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的纵坐标。 */
              (p) => p.y,
            ),
          ) <= clip.node.height
        );
      },
    );
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
    candidates.sort(
      /** 比较 b 的绘制顺序减去 a 的绘制顺序，确定条目顺序。 @param a - 第一个比较或计算对象。 @param b - 第二个比较或计算对象。 @returns 排序用的差值。 */
      (a, b) => b.order - a.order,
    );
    const ctx = this.overlayContext;
    ctx.save();
    ctx.resetTransform();
    for (const entry of candidates) {
      if (
        !entry.visible ||
        !entry.clips.every(
          /**
           * 判断 hitTest 中的条目是否符合检查条件。
           *
           * @param clip - 当前祖先裁剪区域。
           * @returns 该条目是否符合条件。
           */
          (clip) => {
            const local = transform(clip.inverse, point);
            return ctx.isPointInPath(this.painter.paths.clip(clip.node), local.x, local.y);
          },
        )
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
    const camera = this.camera;
    const visible = this.scene.index.query(this.visibleBounds).sort(
      /** 比较 a 的绘制顺序减去 b 的绘制顺序，确定条目顺序。 @param a - 第一个比较或计算对象。 @param b - 第二个比较或计算对象。 @returns 排序用的差值。 */
      (a, b) => a.order - b.order,
    );
    if (this.contentDirty) {
      const ctx = this.context;
      ctx.resetTransform();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(...camera);
      ctx.fillStyle = this.page.background ?? this.tokens.background;
      ctx.fillRect(0, 0, this.page.width, this.page.height);
      for (const entry of visible)
        this.painter.draw(ctx, entry, camera, this.tokens, entry.target.id === this.editingText);
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

  /**
   * 绘制网格、选框、辅助线和钢笔预览，让编辑辅助信息独立于内容缓存。
   *
   * @param visible - 是否显示；节点缺省时按可见处理，还会受到祖先可见性的约束。
   * @returns 无返回值；绘制到叠加画布。
   */
  private drawOverlay(visible: SceneEntry[]) {
    const ctx = this.overlayContext,
      zoom = this.view.zoom,
      camera = this.camera;
    ctx.resetTransform();
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    ctx.setTransform(...camera);
    const page = this.page!,
      bounds = this.visibleBounds;
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
    const selected = new Set(this.overlay.selectedIds);
    for (const entry of visible) {
      if (entry.target.id !== entry.node.id) continue;
      if (selected.has(entry.node.id) || entry.node.id === this.overlay.hoverId) {
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
    for (const guide of this.overlay.guides) {
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
    const marquee = this.overlay.marquee;
    if (marquee) {
      ctx.fillStyle = '#0d99ff18';
      ctx.strokeStyle = '#0d99ff';
      ctx.fillRect(marquee.x, marquee.y, marquee.width, marquee.height);
      ctx.strokeRect(marquee.x, marquee.y, marquee.width, marquee.height);
    }
    if (this.overlay.penPoints.length) {
      ctx.strokeStyle = '#0d99ff';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      this.overlay.penPoints.forEach(
        /** 逐项处理 drawOverlay 中的内容，把结果写入外层维护的集合或绘制上下文。 @param point - 当前处理的坐标点。 @param index - 空间查询索引或当前条目的位置。 @returns 无返回值；当前项的处理通过副作用完成。 */
        (point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)),
      );
      ctx.stroke();
      for (const point of this.overlay.penPoints) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
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
    window.removeEventListener('resize', this.resize);
    this.painter.dispose();
    this.canvas.width =
      this.canvas.height =
      this.overlayCanvas.width =
      this.overlayCanvas.height =
        1;
  }
}
