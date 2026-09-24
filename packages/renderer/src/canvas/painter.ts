import type { DesignNode, ThemeTokens } from '@forma/schema';
import { PathCache, vectorTypes } from './paths';
import type { SceneEntry } from './scene';
import { multiply, type Matrix } from './geometry';

/** 文本测量和换行的缓存结果，减少重复排版开销。 */
interface TextLayout {
  /** 完成换行后的文字行。 */
  lines: string[];
  /** 各行或文本片段测量后的宽度。 */
  widths: number[];
  /** 用于文字测量和绘制的完整字体设置。 */
  font: string;
  /** 行高设置，用于多行文字排版。 */
  lineHeight: number;
}
/** 离屏绘制的位图缓存及尺寸信息，用于复用复杂节点绘制结果。 */
interface Raster {
  /** 承载设计内容的 Canvas 元素。 */
  canvas: HTMLCanvasElement;
  /** 绘制或坐标转换使用的倍率。 */
  scale: number;
  /** 四个方向共用的内边距。 */
  padding: number;
  /** 该位图占用的估算字节数，用于限制总缓存内存。 */
  bytes: number;
}
const rasterBudget = 64 * 1024 * 1024;
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** 负责节点绘制及图片、文字、路径缓存，隔离具体绘制细节。 */
export class CanvasPainter {
  /** 按节点复用的绘制和裁剪路径。 */
  readonly paths = new PathCache();
  /** 按节点缓存的文字测量与排版结果。 */
  private layouts = new WeakMap<DesignNode, TextLayout>();
  /** 图片地址对应的加载状态缓存。 */
  private images = new Map<string, HTMLImageElement>();
  /** 按节点缓存的离屏位图。 */
  private rasters = new Map<DesignNode, Raster>();
  /** 已使用的位图缓存体积，供内存上限管理。 */
  private rasterBytes = 0;
  /** 资源是否已释放，用于拒绝之后的异步刷新。 */
  private disposed = false;
  /**
   * 建立 CanvasPainter 实例并保存其依赖，让后续操作共用同一份资源或状态。
   *
   * @param invalidate - 资源变化后通知外层重新绘制的回调。
   * @returns 构造完成的实例；构造函数不显式返回业务数据。
   */
  constructor(
    /** 资源变化后通知外层重新绘制的回调。 */
    private invalidate: () => void,
  ) {}

  /**
   * 使路径、文字或栅格缓存失效，避免字体等外部资源变化后继续使用旧结果。
   * @returns 无返回值；清理缓存并触发必要重绘。
   */
  clearCaches = () => {
    this.layouts = new WeakMap();
    this.rasters.clear();
    this.rasterBytes = 0;
    this.invalidate();
  };

  /**
   * 仅保留仍属于当前场景的缓存，避免已删除节点持续占用内存。
   *
   * @param entries - 按绘制顺序排列的场景条目。
   * @returns 无返回值；释放不再使用的缓存。
   */
  retain(entries: SceneEntry[]) {
    const nodes = new Set(
      entries.map(
        /** 提取记录的节点，供后续计算或展示使用。 @param entry - 缓存的已编译场景条目。 @returns 记录的节点。 */
        (entry) => entry.node,
      ),
    );
    const sources = new Set(
      entries.map(
        /** 提取记录的节点的图片地址，供后续计算或展示使用。 @param entry - 缓存的已编译场景条目。 @returns 记录的节点的图片地址。 */
        (entry) => entry.node.src,
      ),
    );
    for (const [node, raster] of this.rasters)
      if (!nodes.has(node)) {
        this.rasterBytes -= raster.bytes;
        this.rasters.delete(node);
      }
    for (const [src, image] of this.images)
      if (!sources.has(src)) {
        image.onload = image.onerror = null;
        image.src = '';
        this.images.delete(src);
      }
  }

  /**
   * 释放监听器、计时器或渲染缓存，防止对象停用后仍占用资源。
   * @returns 无返回值；清理完成后结束。
   */
  dispose() {
    this.disposed = true;
    for (const image of this.images.values()) {
      image.onload = image.onerror = null;
      image.src = '';
    }
    this.images.clear();
    this.rasters.clear();
    this.rasterBytes = 0;
  }

  /**
   * 根据当前场景绘制画布，并复用可用的缓存。
   *
   * @param ctx - 当前绘制使用的 Canvas 2D 上下文。
   * @param entry - 缓存的已编译场景条目。
   * @param camera - 用于坐标换算的当前视口状态。
   * @param tokens - 设计主题或语义 Token 集合。
   * @param hideText - 是否临时隐藏画布文字，避免与正在编辑的输入框重复显示。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  draw(
    ctx: CanvasRenderingContext2D,
    entry: SceneEntry,
    camera: Matrix,
    tokens: ThemeTokens,
    hideText = false,
  ) {
    const node = entry.node;
    ctx.save();
    for (const clip of entry.clips) {
      ctx.setTransform(...multiply(camera, clip.matrix));
      ctx.clip(this.paths.clip(clip.node));
    }
    const matrix = multiply(camera, entry.matrix);
    ctx.setTransform(...matrix);
    ctx.globalAlpha = Math.max(0, Math.min(1, entry.opacity));
    ctx.globalCompositeOperation =
      node.blendMode === 'normal' ? 'source-over' : (node.blendMode ?? 'source-over');
    const scale = Math.max(Math.hypot(matrix[0], matrix[1]), Math.hypot(matrix[2], matrix[3]));
    const expensive =
      node.text !== undefined || node.type === 'image' || Boolean(node.shadow || node.blur);
    // Cache costly local painting. Cheap shapes stay vector so zooming never blurs their edges.
    const raster = expensive && !hideText ? this.raster(node, tokens, scale) : undefined;
    if (raster)
      ctx.drawImage(
        raster.canvas,
        -raster.padding,
        -raster.padding,
        raster.canvas.width / raster.scale,
        raster.canvas.height / raster.scale,
      );
    else this.drawLocal(ctx, node, tokens, scale, hideText);
    ctx.restore();
  }

  /**
   * 按目标倍率生成或复用离屏位图，用内存缓存减少复杂节点的重复绘制。
   *
   * @param node - 当前处理的设计节点。
   * @param tokens - 设计主题或语义 Token 集合。
   * @param requestedScale - 当前视口所需的栅格缓存倍率。
   * @returns 可复用的栅格缓存。
   */
  private raster(
    node: DesignNode,
    tokens: ThemeTokens,
    requestedScale: number,
  ): Raster | undefined {
    const scale = Math.min(8, Math.max(0.25, 2 ** Math.ceil(Math.log2(requestedScale))));
    const shadow = node.shadow;
    const padding = Math.ceil(
      (node.strokeWidth ?? 0) +
        (node.blur ?? 0) * 3 +
        (shadow
          ? Math.max(Math.abs(shadow.x), Math.abs(shadow.y)) +
            shadow.blur * 3 +
            Math.abs(shadow.spread)
          : 0) +
        2,
    );
    const width = Math.ceil((node.width + padding * 2) * scale),
      height = Math.ceil((node.height + padding * 2) * scale);
    if (width < 1 || height < 1 || width > 2048 || height > 2048 || width * height > 2_000_000)
      return;
    let raster = this.rasters.get(node);
    if (raster?.scale === scale) {
      this.rasters.delete(node);
      this.rasters.set(node, raster);
      return raster;
    }
    if (raster) {
      this.rasterBytes -= raster.bytes;
      this.rasters.delete(node);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(scale, 0, 0, scale, padding * scale, padding * scale);
    this.drawLocal(context, node, tokens, scale, false);
    raster = { canvas, scale, padding, bytes: width * height * 4 };
    while (this.rasterBytes + raster.bytes > rasterBudget && this.rasters.size) {
      const [key, old] = this.rasters.entries().next().value!;
      this.rasterBytes -= old.bytes;
      this.rasters.delete(key);
    }
    this.rasters.set(node, raster);
    this.rasterBytes += raster.bytes;
    return raster;
  }

  /**
   * 复用图片加载对象，在资源就绪后通知画布重新绘制。
   *
   * @param src - 图片资源地址。
   * @returns 可用的已加载图片；尚未加载完成时返回 undefined。
   */
  private image(src: string) {
    let image = this.images.get(src);
    if (!image) {
      image = new Image();
      image.decoding = 'async';
      image.onload =
        /**
         * 执行 image 传入的局部处理步骤，使调用处能够控制结果如何更新。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        () => {
          if (!this.disposed) this.clearCaches();
        };
      image.onerror =
        /**
         * 执行 image 传入的局部处理步骤，使调用处能够控制结果如何更新。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        () => {
          if (!this.disposed) this.invalidate();
        };
      this.images.set(src, image);
      image.src = src;
    }
    return image.complete && image.naturalWidth ? image : undefined;
  }

  /**
   * 根据节点的纯色或渐变定义生成画布填充样式。
   *
   * @param ctx - 当前绘制使用的 Canvas 2D 上下文。
   * @param node - 当前处理的设计节点。
   * @returns Canvas 可使用的颜色或渐变。
   */
  private fill(ctx: CanvasRenderingContext2D, node: DesignNode): string | CanvasGradient {
    if (!node.gradient) return node.fill === 'none' ? 'transparent' : (node.fill ?? 'transparent');
    const { type, from, to, angle } = node.gradient;
    let gradient: CanvasGradient;
    if (type === 'radial') {
      gradient = ctx.createRadialGradient(
        node.width / 2,
        node.height / 2,
        0,
        node.width / 2,
        node.height / 2,
        Math.max(1, Math.hypot(node.width, node.height) / 2),
      );
    } else {
      const radians = (angle * Math.PI) / 180;
      const dx = Math.sin(radians),
        dy = -Math.cos(radians);
      const length = Math.abs(node.width * dx) + Math.abs(node.height * dy);
      gradient = ctx.createLinearGradient(
        node.width / 2 - (dx * length) / 2,
        node.height / 2 - (dy * length) / 2,
        node.width / 2 + (dx * length) / 2,
        node.height / 2 + (dy * length) / 2,
      );
    }
    try {
      gradient.addColorStop(0, from);
      gradient.addColorStop(1, to);
    } catch {
      return node.fill ?? 'transparent';
    }
    return gradient;
  }

  /**
   * 在节点局部坐标系绘制内容，使几何变换与具体形状绘制分离。
   *
   * @param ctx - 当前绘制使用的 Canvas 2D 上下文。
   * @param node - 当前处理的设计节点。
   * @param tokens - 设计主题或语义 Token 集合。
   * @param scale - 绘制或坐标转换使用的倍率。
   * @param hideText - 是否临时隐藏画布文字，避免与正在编辑的输入框重复显示。
   * @returns 无返回值；绘制节点本身。
   */
  private drawLocal(
    ctx: CanvasRenderingContext2D,
    node: DesignNode,
    tokens: ThemeTokens,
    scale: number,
    hideText: boolean,
  ) {
    ctx.save();
    if (node.blur) ctx.filter = `blur(${node.blur * scale}px)`;
    const vector = vectorTypes.has(node.type);
    const strokeWidth = node.strokeWidth ?? (node.type === 'line' ? 2 : node.stroke ? 1 : 0);
    const inset =
      node.strokeAlign === 'outside'
        ? -strokeWidth / 2
        : node.strokeAlign === 'center' || (vector && !node.strokeAlign)
          ? 0
          : strokeWidth / 2;
    const path = this.paths.get(node, vector && node.type !== 'ellipse' ? 0 : inset);
    const fillPath = this.paths.get(node);
    const hasFill = node.type !== 'line' && !(node.type === 'path' && !node.closed);
    const fill = this.fill(ctx, node);
    ctx.fillStyle = fill;
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle =
      node.stroke ?? (node.type === 'line' ? (node.color ?? '#64748b') : 'transparent');
    ctx.lineCap = vector ? 'round' : 'butt';
    ctx.lineJoin = 'round';
    ctx.setLineDash(
      node.strokeDash === 'dashed'
        ? [strokeWidth * 4, strokeWidth * 3]
        : node.strokeDash === 'dotted'
          ? [strokeWidth, strokeWidth * 2]
          : [],
    );
    const shadow = node.shadow;
    if (shadow && !shadow.inset) {
      ctx.save();
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = Math.max(0, shadow.blur) * scale;
      ctx.shadowOffsetX = shadow.x * scale;
      ctx.shadowOffsetY = shadow.y * scale;
      const shadowPath = shadow.spread && !vector ? this.paths.get(node, -shadow.spread) : fillPath;
      // The opaque silhouette is removed by clipping the shadow to the exterior.
      const exterior = new Path2D();
      const extent =
        Math.max(
          node.width,
          node.height,
          shadow.blur * 6 + Math.abs(shadow.x) + Math.abs(shadow.y) + Math.abs(shadow.spread),
        ) *
          4 +
        100;
      exterior.rect(-extent, -extent, extent * 3, extent * 3);
      exterior.addPath(fillPath);
      if (hasFill && !vector) ctx.clip(exterior, 'evenodd');
      if (hasFill) {
        ctx.fillStyle = vector ? fill : shadow.color;
        ctx.fill(shadowPath);
      }
      if (strokeWidth && (node.stroke || node.type === 'line')) ctx.stroke(path);
      ctx.restore();
    }
    if (hasFill) {
      if (node.gradient?.type === 'radial' && node.width > 0 && node.height > 0) {
        // Gradients use the transform at paint time. Clip first, then paint in a unit square
        // so rectangular nodes get an elliptical gradient rather than a circular one.
        ctx.save();
        ctx.clip(fillPath);
        ctx.scale(node.width, node.height);
        const gradient = ctx.createRadialGradient(
          0.5,
          0.5,
          0,
          0.5,
          0.5,
          vector ? 0.5 : Math.SQRT1_2,
        );
        try {
          gradient.addColorStop(0, node.gradient.from);
          gradient.addColorStop(1, node.gradient.to);
          ctx.fillStyle = gradient;
        } catch {
          ctx.fillStyle = node.fill ?? 'transparent';
        }
        ctx.fillRect(0, 0, 1, 1);
        ctx.restore();
      } else ctx.fill(fillPath);
    }
    if (node.type === 'image' && node.src) {
      const image = this.image(node.src);
      if (image) {
        ctx.save();
        ctx.clip(fillPath);
        const ratio = (node.imageFit === 'contain' ? Math.min : Math.max)(
          node.width / image.naturalWidth,
          node.height / image.naturalHeight,
        );
        const width = image.naturalWidth * ratio,
          height = image.naturalHeight * ratio;
        ctx.drawImage(image, (node.width - width) / 2, (node.height - height) / 2, width, height);
        ctx.restore();
      }
    }
    if (strokeWidth > 0 && (node.stroke || node.type === 'line')) ctx.stroke(path);
    if (node.text !== undefined && node.type !== 'image' && node.type !== 'component' && !hideText)
      this.drawText(ctx, node, tokens);
    if (shadow?.inset && hasFill) {
      ctx.save();
      ctx.clip(fillPath);
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur * scale;
      ctx.shadowOffsetX = shadow.x * scale;
      ctx.shadowOffsetY = shadow.y * scale;
      ctx.fillStyle = shadow.color;
      const hole = new Path2D();
      const extent =
        Math.max(node.width, node.height) +
        shadow.blur * 6 +
        Math.abs(shadow.x) +
        Math.abs(shadow.y) +
        Math.abs(shadow.spread) +
        100;
      hole.rect(-extent, -extent, extent * 3, extent * 3);
      hole.addPath(this.paths.get(node, shadow.spread));
      ctx.fill(hole, 'evenodd');
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * 按字体、行距和对齐方式排版文本，并复用测量结果。
   *
   * @param ctx - 当前绘制使用的 Canvas 2D 上下文。
   * @param node - 当前处理的设计节点。
   * @param tokens - 设计主题或语义 Token 集合。
   * @returns 无返回值；绘制排版后的文字。
   */
  private drawText(ctx: CanvasRenderingContext2D, node: DesignNode, tokens: ThemeTokens) {
    const fontSize = node.fontSize ?? 14;
    const font = `${node.fontStyle ?? 'normal'} ${node.fontWeight ?? (node.type === 'button' ? 550 : 400)} ${fontSize}px ${node.fontFamily ?? tokens.fontFamily}`;
    ctx.font = font;
    ctx.letterSpacing = `${node.letterSpacing ?? 0}px`;
    const px = node.paddingX ?? node.padding ?? 0,
      py = node.paddingY ?? node.padding ?? 0;
    const width = Math.max(0, node.width - px * 2),
      height = Math.max(0, node.height - py * 2);
    if (!width || !height) return;
    let layout = this.layouts.get(node);
    if (!layout || layout.font !== font) {
      const lines: string[] = [];
      for (const paragraph of (node.text ?? '').split('\n')) {
        let line = '';
        for (const { segment } of wordSegmenter.segment(paragraph)) {
          if (ctx.measureText(line + segment).width <= width) {
            line += segment;
            continue;
          }
          if (line) {
            lines.push(line);
            line = '';
          }
          if (ctx.measureText(segment).width <= width) {
            line = segment;
            continue;
          }
          for (const { segment: character } of graphemeSegmenter.segment(segment)) {
            if (line && ctx.measureText(line + character).width > width) {
              lines.push(line);
              line = '';
            }
            line += character;
          }
        }
        lines.push(line);
      }
      layout = {
        lines,
        widths: lines.map(
          /** 提取的宽度，供后续计算或展示使用。 @param line - 当前文本行或线段。 @returns 的宽度。 */
          (line) => ctx.measureText(line).width,
        ),
        font,
        lineHeight: fontSize * (node.lineHeight ?? 1.45),
      };
      this.layouts.set(node, layout);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, width, height);
    ctx.clip();
    ctx.fillStyle = node.color ?? tokens.text;
    ctx.textBaseline = 'alphabetic';
    const align = node.textAlign ?? (node.type === 'button' ? 'center' : 'left');
    const vertical = node.verticalAlign ?? (node.type === 'button' ? 'center' : 'top');
    const totalHeight = layout.lines.length * layout.lineHeight;
    const metrics = ctx.measureText('Mg');
    const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
    const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;
    let y =
      py +
      (vertical === 'bottom'
        ? height - totalHeight
        : vertical === 'center'
          ? (height - totalHeight) / 2
          : 0) +
      (layout.lineHeight - ascent - descent) / 2 +
      ascent;
    layout.lines.forEach(
      /**
       * 逐项处理 drawText 中的内容，把结果写入外层维护的集合或绘制上下文。
       *
       * @param line - 当前文本行或线段。
       * @param index - 空间查询索引或当前条目的位置。
       * @returns 无返回值；当前项的处理通过副作用完成。
       */
      (line, index) => {
        const lineWidth = layout!.widths[index];
        const x =
          px +
          (align === 'right'
            ? width - lineWidth
            : align === 'center'
              ? (width - lineWidth) / 2
              : 0);
        if (align === 'justify' && index < layout!.lines.length - 1 && line.includes(' ')) {
          const words = line.split(' '),
            gap =
              (width -
                words.reduce(
                  /** 累积 drawText 中的条目结果，供后续计算使用。 @param sum - 累加到当前项之前的结果。 @param word - 正在测量或换行的词片段。 @returns 纳入当前条目后的累计结果。 */
                  (sum, word) => sum + ctx.measureText(word).width,
                  0,
                )) /
              (words.length - 1);
          let cursor = x;
          for (const word of words) {
            ctx.fillText(word, cursor, y);
            cursor += ctx.measureText(word).width + gap;
          }
        } else ctx.fillText(line, x, y);
        if (node.textDecoration && node.textDecoration !== 'none') {
          ctx.fillRect(
            x,
            y + (node.textDecoration === 'underline' ? fontSize * 0.12 : -fontSize * 0.3),
            lineWidth,
            Math.max(1, fontSize / 16),
          );
        }
        y += layout!.lineHeight;
      },
    );
    ctx.restore();
  }
}
