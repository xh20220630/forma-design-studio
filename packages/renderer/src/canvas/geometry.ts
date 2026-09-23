export interface Point { x: number; y: number }
export interface Bounds extends Point { width: number; height: number }
export type Matrix = readonly [number, number, number, number, number, number];
export const identity: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function transform(m: Matrix, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

export function inverse(m: Matrix): Matrix | undefined {
  const determinant = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(determinant) < 1e-12) return;
  return [m[3] / determinant, -m[1] / determinant, -m[2] / determinant, m[0] / determinant,
    (m[2] * m[5] - m[3] * m[4]) / determinant, (m[1] * m[4] - m[0] * m[5]) / determinant];
}

export function nodeMatrix(node: Bounds & { rotation?: number; flipX?: boolean; flipY?: boolean }): Matrix {
  const angle = (node.rotation ?? 0) * Math.PI / 180;
  const a = Math.cos(angle) * (node.flipX ? -1 : 1), b = Math.sin(angle) * (node.flipX ? -1 : 1);
  const c = -Math.sin(angle) * (node.flipY ? -1 : 1), d = Math.cos(angle) * (node.flipY ? -1 : 1);
  return [a, b, c, d, node.x + node.width / 2 - a * node.width / 2 - c * node.height / 2,
    node.y + node.height / 2 - b * node.width / 2 - d * node.height / 2];
}

export function transformedBounds(matrix: Matrix, bounds: Bounds): Bounds {
  const points = [transform(matrix, bounds), transform(matrix, { x: bounds.x + bounds.width, y: bounds.y }),
    transform(matrix, { x: bounds.x, y: bounds.y + bounds.height }),
    transform(matrix, { x: bounds.x + bounds.width, y: bounds.y + bounds.height })];
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
}

export function intersects(a: Bounds, b: Bounds) {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

// Large shapes go in a separate bucket: a page-sized frame must not allocate millions of cells.
export class SpatialIndex<T extends { bounds: Bounds }> {
  private cells = new Map<string, T[]>();
  private large: T[] = [];
  private items: T[] = [];
  private cellSize: number;
  constructor(cellSize = 256) { this.cellSize = cellSize; }

  insert(item: T) {
    this.items.push(item);
    const [left, top, right, bottom] = this.range(item.bounds);
    if ((right - left + 1) * (bottom - top + 1) > 64) {
      this.large.push(item);
      return;
    }
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const key = `${x}:${y}`, cell = this.cells.get(key);
      if (cell) cell.push(item); else this.cells.set(key, [item]);
    }
  }

  query(bounds: Bounds): T[] {
    const [left, top, right, bottom] = this.range(bounds);
    if ((right - left + 1) * (bottom - top + 1) > 4096) return this.items.filter(item => intersects(item.bounds, bounds));
    const result = new Set<T>();
    for (const item of this.large) if (intersects(item.bounds, bounds)) result.add(item);
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      for (const item of this.cells.get(`${x}:${y}`) ?? []) if (intersects(item.bounds, bounds)) result.add(item);
    }
    return [...result];
  }

  private range(b: Bounds) {
    return [Math.floor(b.x / this.cellSize), Math.floor(b.y / this.cellSize),
      Math.floor((b.x + b.width) / this.cellSize), Math.floor((b.y + b.height) / this.cellSize)];
  }
}
