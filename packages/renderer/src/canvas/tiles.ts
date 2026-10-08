import { intersects, type Bounds, type Matrix } from './geometry.ts';

export const tilePixels = 256;
export const tileGutter = 2;
export const tileExtent = tilePixels + tileGutter * 2;
// 同时计入 Canvas 位图和 GPU 纹理，不包含浏览器内部的额外缓冲。
export const tileBytes = tileExtent * tileExtent * 8;
export const tileBudget = 128 * 1024 * 1024;

export interface TileAddress {
  key: string;
  scale: number;
  bounds: Bounds;
}

export interface SceneTile extends TileAddress {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  dirty: boolean;
  version: number;
  generation: number;
}

/** 块以世界坐标定位，平移不改变 key；缩放采用分级分辨率。 */
export function planTiles(bounds: Bounds, pixelsPerUnit: number, capacity: number): TileAddress[] {
  if (
    !Object.values(bounds).every(Number.isFinite) ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    !Number.isFinite(pixelsPerUnit) ||
    pixelsPerUnit <= 0
  )
    return [];
  let scale = 2 ** Math.ceil(Math.log2(pixelsPerUnit));
  let left: number, top: number, right: number, bottom: number;
  do {
    const size = tilePixels / scale;
    left = Math.floor(bounds.x / size);
    top = Math.floor(bounds.y / size);
    right = Math.ceil((bounds.x + bounds.width) / size) - 1;
    bottom = Math.ceil((bounds.y + bounds.height) / size) - 1;
    if ((right - left + 1) * (bottom - top + 1) <= Math.max(4, capacity)) break;
    // 超大显示器降低缓存采样倍率，保证本帧可见块不会互相驱逐。
    scale /= 2;
  } while (scale > Number.MIN_VALUE);
  const size = tilePixels / scale;
  const addresses: TileAddress[] = [];
  for (let y = top; y <= bottom; y++)
    for (let x = left; x <= right; x++)
      addresses.push({
        key: `${scale}:${x}:${y}`,
        scale,
        bounds: { x: x * size, y: y * size, width: size, height: size },
      });
  return addresses;
}

export function tilePaintBounds(tile: TileAddress): Bounds {
  const gutter = tileGutter / tile.scale;
  return {
    x: tile.bounds.x - gutter,
    y: tile.bounds.y - gutter,
    width: tile.bounds.width + gutter * 2,
    height: tile.bounds.height + gutter * 2,
  };
}

/** 共享像素边界与采样区域，避免小数缩放时接缝重叠或漏出背景。 */
export function placeTile(tile: TileAddress, camera: Matrix, area = tile.bounds) {
  const x = area.x * camera[0] + camera[4];
  const y = area.y * camera[3] + camera[5];
  const left = Math.round(x),
    top = Math.round(y);
  const width = Math.round(x + area.width * camera[0]) - left;
  const height = Math.round(y + area.height * camera[3]) - top;
  const factor = camera[0] / tile.scale;
  return {
    x: left,
    y: top,
    width,
    height,
    sx: tileGutter + (area.x - tile.bounds.x) * tile.scale + (left - x) / factor,
    sy: tileGutter + (area.y - tile.bounds.y) * tile.scale + (top - y) / factor,
    sw: width / factor,
    sh: height / factor,
  };
}

export class TileCache {
  private tiles = new Map<string, SceneTile>();
  readonly capacity: number;
  private release: (tile: SceneTile) => void;
  private createCanvas: () => HTMLCanvasElement;

  constructor(
    release: (tile: SceneTile) => void,
    budget = tileBudget,
    createCanvas = () => document.createElement('canvas'),
  ) {
    this.release = release;
    this.capacity = Math.max(4, Math.floor(budget / tileBytes));
    this.createCanvas = createCanvas;
  }

  get(address: TileAddress): SceneTile {
    let tile = this.tiles.get(address.key);
    if (tile) this.tiles.delete(address.key);
    else {
      while (this.tiles.size >= this.capacity) this.evict(this.tiles.values().next().value!);
      const canvas = this.createCanvas();
      canvas.width = canvas.height = tileExtent;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('浏览器不支持 Canvas 2D');
      tile = { ...address, canvas, context, dirty: true, version: 0, generation: 0 };
    }
    this.tiles.set(address.key, tile);
    return tile;
  }

  invalidate(bounds?: readonly Bounds[]) {
    for (const tile of this.tiles.values())
      if (!bounds || bounds.some((area) => intersects(tilePaintBounds(tile), area))) {
        tile.dirty = true;
        tile.generation++;
      }
  }

  completed(bounds: Bounds, prefix: string) {
    return [...this.tiles.values()].filter(
      (tile) =>
        tile.key.startsWith(prefix) &&
        !tile.dirty &&
        tile.version > 0 &&
        intersects(tile.bounds, bounds),
    );
  }

  get bytes() {
    return this.tiles.size * tileBytes;
  }

  private evict(tile: SceneTile) {
    this.release(tile);
    this.tiles.delete(tile.key);
    tile.canvas.width = tile.canvas.height = 1;
  }

  clear() {
    for (const tile of this.tiles.values()) this.evict(tile);
  }
}
