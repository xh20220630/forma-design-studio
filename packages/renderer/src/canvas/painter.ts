import type { DesignNode, ThemeTokens } from '@forma/schema';
import { PathCache, vectorTypes } from './paths';
import type { SceneEntry } from './scene';
import { multiply, type Matrix } from './geometry';

interface TextLayout { lines: string[]; widths: number[]; font: string; lineHeight: number }
interface Raster { canvas: HTMLCanvasElement; scale: number; padding: number; bytes: number }
const rasterBudget = 64 * 1024 * 1024;
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export class CanvasPainter {
  readonly paths = new PathCache();
  private layouts = new WeakMap<DesignNode, TextLayout>();
  private images = new Map<string, HTMLImageElement>();
  private rasters = new Map<DesignNode, Raster>();
  private rasterBytes = 0;
  private disposed = false;
  constructor(private invalidate: () => void) {}

  clearCaches = () => {
    this.layouts = new WeakMap();
    this.rasters.clear();
    this.rasterBytes = 0;
    this.invalidate();
  };

  retain(entries: SceneEntry[]) {
    const nodes = new Set(entries.map(entry => entry.node));
    const sources = new Set(entries.map(entry => entry.node.src));
    for (const [node, raster] of this.rasters) if (!nodes.has(node)) {
      this.rasterBytes -= raster.bytes;
      this.rasters.delete(node);
    }
    for (const [src, image] of this.images) if (!sources.has(src)) {
      image.onload = image.onerror = null;
      image.src = '';
      this.images.delete(src);
    }
  }

  dispose() {
    this.disposed = true;
    for (const image of this.images.values()) { image.onload = image.onerror = null; image.src = ''; }
    this.images.clear();
    this.rasters.clear();
    this.rasterBytes = 0;
  }

  draw(ctx: CanvasRenderingContext2D, entry: SceneEntry, camera: Matrix, tokens: ThemeTokens, hideText = false) {
    const node = entry.node;
    ctx.save();
    for (const clip of entry.clips) {
      ctx.setTransform(...multiply(camera, clip.matrix));
      ctx.clip(this.paths.clip(clip.node));
    }
    const matrix = multiply(camera, entry.matrix);
    ctx.setTransform(...matrix);
    ctx.globalAlpha = Math.max(0, Math.min(1, entry.opacity));
    ctx.globalCompositeOperation = node.blendMode === 'normal' ? 'source-over' : node.blendMode ?? 'source-over';
    const scale = Math.max(Math.hypot(matrix[0], matrix[1]), Math.hypot(matrix[2], matrix[3]));
    const expensive = node.text !== undefined || node.type === 'image' || Boolean(node.shadow || node.blur);
    // Cache costly local painting. Cheap shapes stay vector so zooming never blurs their edges.
    const raster = expensive && !hideText ? this.raster(node, tokens, scale) : undefined;
    if (raster) ctx.drawImage(raster.canvas, -raster.padding, -raster.padding,
      raster.canvas.width / raster.scale, raster.canvas.height / raster.scale);
    else this.drawLocal(ctx, node, tokens, scale, hideText);
    ctx.restore();
  }

  private raster(node: DesignNode, tokens: ThemeTokens, requestedScale: number): Raster | undefined {
    const scale = Math.min(8, Math.max(0.25, 2 ** Math.ceil(Math.log2(requestedScale))));
    const shadow = node.shadow;
    const padding = Math.ceil((node.strokeWidth ?? 0) + (node.blur ?? 0) * 3 +
      (shadow ? Math.max(Math.abs(shadow.x), Math.abs(shadow.y)) + shadow.blur * 3 + Math.abs(shadow.spread) : 0) + 2);
    const width = Math.ceil((node.width + padding * 2) * scale), height = Math.ceil((node.height + padding * 2) * scale);
    if (width < 1 || height < 1 || width > 2048 || height > 2048 || width * height > 2_000_000) return;
    let raster = this.rasters.get(node);
    if (raster?.scale === scale) {
      this.rasters.delete(node); this.rasters.set(node, raster);
      return raster;
    }
    if (raster) { this.rasterBytes -= raster.bytes; this.rasters.delete(node); }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
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
    this.rasters.set(node, raster); this.rasterBytes += raster.bytes;
    return raster;
  }

  private image(src: string) {
    let image = this.images.get(src);
    if (!image) {
      image = new Image();
      image.decoding = 'async';
      image.onload = () => { if (!this.disposed) this.clearCaches(); };
      image.onerror = () => { if (!this.disposed) this.invalidate(); };
      this.images.set(src, image);
      image.src = src;
    }
    return image.complete && image.naturalWidth ? image : undefined;
  }

  private fill(ctx: CanvasRenderingContext2D, node: DesignNode): string | CanvasGradient {
    if (!node.gradient) return node.fill === 'none' ? 'transparent' : node.fill ?? 'transparent';
    const { type, from, to, angle } = node.gradient;
    let gradient: CanvasGradient;
    if (type === 'radial') {
      gradient = ctx.createRadialGradient(node.width / 2, node.height / 2, 0,
        node.width / 2, node.height / 2, Math.max(1, Math.hypot(node.width, node.height) / 2));
    } else {
      const radians = angle * Math.PI / 180;
      const dx = Math.sin(radians), dy = -Math.cos(radians);
      const length = Math.abs(node.width * dx) + Math.abs(node.height * dy);
      gradient = ctx.createLinearGradient(node.width / 2 - dx * length / 2, node.height / 2 - dy * length / 2,
        node.width / 2 + dx * length / 2, node.height / 2 + dy * length / 2);
    }
    try { gradient.addColorStop(0, from); gradient.addColorStop(1, to); } catch { return node.fill ?? 'transparent'; }
    return gradient;
  }

  private drawLocal(ctx: CanvasRenderingContext2D, node: DesignNode, tokens: ThemeTokens, scale: number, hideText: boolean) {
    ctx.save();
    if (node.blur) ctx.filter = `blur(${node.blur * scale}px)`;
    const vector = vectorTypes.has(node.type);
    const strokeWidth = node.strokeWidth ?? (node.type === 'line' ? 2 : node.stroke ? 1 : 0);
    const inset = node.strokeAlign === 'outside' ? -strokeWidth / 2 : node.strokeAlign === 'center' || vector && !node.strokeAlign ? 0 : strokeWidth / 2;
    const path = this.paths.get(node, vector && node.type !== 'ellipse' ? 0 : inset);
    const fillPath = this.paths.get(node);
    const hasFill = node.type !== 'line' && !(node.type === 'path' && !node.closed);
    const fill = this.fill(ctx, node);
    ctx.fillStyle = fill;
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = node.stroke ?? (node.type === 'line' ? node.color ?? '#64748b' : 'transparent');
    ctx.lineCap = vector ? 'round' : 'butt'; ctx.lineJoin = 'round';
    ctx.setLineDash(node.strokeDash === 'dashed' ? [strokeWidth * 4, strokeWidth * 3] : node.strokeDash === 'dotted' ? [strokeWidth, strokeWidth * 2] : []);
    const shadow = node.shadow;
    if (shadow && !shadow.inset) {
      ctx.save();
      ctx.shadowColor = shadow.color; ctx.shadowBlur = Math.max(0, shadow.blur) * scale;
      ctx.shadowOffsetX = shadow.x * scale; ctx.shadowOffsetY = shadow.y * scale;
      const shadowPath = shadow.spread && !vector ? this.paths.get(node, -shadow.spread) : fillPath;
      // The opaque silhouette is removed by clipping the shadow to the exterior.
      const exterior = new Path2D();
      const extent = Math.max(node.width, node.height, shadow.blur * 6 + Math.abs(shadow.x) + Math.abs(shadow.y) + Math.abs(shadow.spread)) * 4 + 100;
      exterior.rect(-extent, -extent, extent * 3, extent * 3);
      exterior.addPath(fillPath);
      if (hasFill && !vector) ctx.clip(exterior, 'evenodd');
      if (hasFill) { ctx.fillStyle = vector ? fill : shadow.color; ctx.fill(shadowPath); }
      if (strokeWidth && (node.stroke || node.type === 'line')) ctx.stroke(path);
      ctx.restore();
    }
    if (hasFill) {
      if (node.gradient?.type === 'radial' && node.width > 0 && node.height > 0) {
        // Gradients use the transform at paint time. Clip first, then paint in a unit square
        // so rectangular nodes get an elliptical gradient rather than a circular one.
        ctx.save(); ctx.clip(fillPath); ctx.scale(node.width, node.height);
        const gradient = ctx.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, vector ? 0.5 : Math.SQRT1_2);
        try {
          gradient.addColorStop(0, node.gradient.from); gradient.addColorStop(1, node.gradient.to);
          ctx.fillStyle = gradient;
        } catch { ctx.fillStyle = node.fill ?? 'transparent'; }
        ctx.fillRect(0, 0, 1, 1); ctx.restore();
      } else ctx.fill(fillPath);
    }
    if (node.type === 'image' && node.src) {
      const image = this.image(node.src);
      if (image) {
        ctx.save(); ctx.clip(fillPath);
        const ratio = Math.max(node.width / image.naturalWidth, node.height / image.naturalHeight);
        const width = image.naturalWidth * ratio, height = image.naturalHeight * ratio;
        ctx.drawImage(image, (node.width - width) / 2, (node.height - height) / 2, width, height);
        ctx.restore();
      }
    }
    if (strokeWidth > 0 && (node.stroke || node.type === 'line')) ctx.stroke(path);
    if (node.text !== undefined && node.type !== 'image' && node.type !== 'component' && !hideText) this.drawText(ctx, node, tokens);
    if (shadow?.inset && hasFill) {
      ctx.save(); ctx.clip(fillPath);
      ctx.shadowColor = shadow.color; ctx.shadowBlur = shadow.blur * scale;
      ctx.shadowOffsetX = shadow.x * scale; ctx.shadowOffsetY = shadow.y * scale;
      ctx.fillStyle = shadow.color;
      const hole = new Path2D();
      const extent = Math.max(node.width, node.height) + shadow.blur * 6 + Math.abs(shadow.x) + Math.abs(shadow.y) + Math.abs(shadow.spread) + 100;
      hole.rect(-extent, -extent, extent * 3, extent * 3);
      hole.addPath(this.paths.get(node, shadow.spread));
      ctx.fill(hole, 'evenodd'); ctx.restore();
    }
    ctx.restore();
  }

  private drawText(ctx: CanvasRenderingContext2D, node: DesignNode, tokens: ThemeTokens) {
    const fontSize = node.fontSize ?? 14;
    const font = `${node.fontStyle ?? 'normal'} ${node.fontWeight ?? (node.type === 'button' ? 550 : 400)} ${fontSize}px ${node.fontFamily ?? tokens.fontFamily}`;
    ctx.font = font;
    ctx.letterSpacing = `${node.letterSpacing ?? 0}px`;
    const px = node.paddingX ?? node.padding ?? 0, py = node.paddingY ?? node.padding ?? 0;
    const width = Math.max(0, node.width - px * 2), height = Math.max(0, node.height - py * 2);
    if (!width || !height) return;
    let layout = this.layouts.get(node);
    if (!layout || layout.font !== font) {
      const lines: string[] = [];
      for (const paragraph of (node.text ?? '').split('\n')) {
        let line = '';
        for (const { segment } of wordSegmenter.segment(paragraph)) {
          if (ctx.measureText(line + segment).width <= width) { line += segment; continue; }
          if (line) { lines.push(line); line = ''; }
          if (ctx.measureText(segment).width <= width) { line = segment; continue; }
          for (const { segment: character } of graphemeSegmenter.segment(segment)) {
            if (line && ctx.measureText(line + character).width > width) { lines.push(line); line = ''; }
            line += character;
          }
        }
        lines.push(line);
      }
      layout = { lines, widths: lines.map(line => ctx.measureText(line).width), font, lineHeight: fontSize * (node.lineHeight ?? 1.45) };
      this.layouts.set(node, layout);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, width, height); ctx.clip();
    ctx.fillStyle = node.color ?? tokens.text; ctx.textBaseline = 'alphabetic';
    const align = node.textAlign ?? (node.type === 'button' ? 'center' : 'left');
    const vertical = node.verticalAlign ?? (node.type === 'button' ? 'center' : 'top');
    const totalHeight = layout.lines.length * layout.lineHeight;
    const metrics = ctx.measureText('Mg');
    const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
    const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;
    let y = py + (vertical === 'bottom' ? height - totalHeight : vertical === 'center' ? (height - totalHeight) / 2 : 0) +
      (layout.lineHeight - ascent - descent) / 2 + ascent;
    layout.lines.forEach((line, index) => {
      const lineWidth = layout!.widths[index];
      const x = px + (align === 'right' ? width - lineWidth : align === 'center' ? (width - lineWidth) / 2 : 0);
      if (align === 'justify' && index < layout!.lines.length - 1 && line.includes(' ')) {
        const words = line.split(' '), gap = (width - words.reduce((sum, word) => sum + ctx.measureText(word).width, 0)) / (words.length - 1);
        let cursor = x;
        for (const word of words) { ctx.fillText(word, cursor, y); cursor += ctx.measureText(word).width + gap; }
      } else ctx.fillText(line, x, y);
      if (node.textDecoration && node.textDecoration !== 'none') {
        ctx.fillRect(x, y + (node.textDecoration === 'underline' ? fontSize * 0.12 : -fontSize * 0.3), lineWidth, Math.max(1, fontSize / 16));
      }
      y += layout!.lineHeight;
    });
    ctx.restore();
  }
}
