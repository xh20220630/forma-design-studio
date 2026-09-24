/** 二维几何坐标点，具体空间由调用位置决定。 */
export interface Point {
  /** 水平方向的位置。 */
  x: number;
  /** 垂直方向的位置。 */
  y: number;
}
/** 轴对齐矩形边界，供空间查询与可见性筛选使用。 */
export interface Bounds extends Point {
  /** 对象的宽度。 */
  width: number;
  /** 对象的高度。 */
  height: number;
}
/** Canvas 二维仿射矩阵 [a, b, c, d, e, f]，统一变换、逆变换和几何计算。 */
export type Matrix = readonly [number, number, number, number, number, number];
export const identity: Matrix = [1, 0, 0, 1, 0, 0];

/**
 * 组合二维仿射矩阵，使父级变换和节点自身变换可以连续应用。
 *
 * @param a - 第一个比较或计算对象。
 * @param b - 第二个比较或计算对象。
 * @returns 矩阵 a 与 b 的乘积。
 */
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/**
 * 将点乘以二维仿射矩阵，统一平移、缩放和旋转的坐标计算。
 *
 * @param m - 当前变换矩阵或消息。
 * @param p - 当前坐标点或内容片段。
 * @returns 变换后的坐标点。
 */
export function transform(m: Matrix, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/**
 * 计算逆矩阵以把画布点还原到节点局部空间；接近奇异时放弃计算。
 *
 * @param m - 当前变换矩阵或消息。
 * @returns 逆矩阵；不可逆时返回 undefined。
 */
export function inverse(m: Matrix): Matrix | undefined {
  const determinant = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(determinant) < 1e-12) return;
  return [
    m[3] / determinant,
    -m[1] / determinant,
    -m[2] / determinant,
    m[0] / determinant,
    (m[2] * m[5] - m[3] * m[4]) / determinant,
    (m[1] * m[4] - m[0] * m[5]) / determinant,
  ];
}

/**
 * 围绕节点中心计算旋转和翻转，保证渲染与命中检测使用同一套几何规则。
 *
 * @param node - 当前处理的设计节点。
 * @returns 节点局部坐标到所在空间的变换矩阵。
 */
export function nodeMatrix(
  node: Bounds & {
    /** 围绕中心旋转的角度，单位为度。 */
    rotation?: number;
    /** 是否水平翻转。 */
    flipX?: boolean;
    /** 是否垂直翻转。 */
    flipY?: boolean;
  },
): Matrix {
  const angle = ((node.rotation ?? 0) * Math.PI) / 180;
  const a = Math.cos(angle) * (node.flipX ? -1 : 1),
    b = Math.sin(angle) * (node.flipX ? -1 : 1);
  const c = -Math.sin(angle) * (node.flipY ? -1 : 1),
    d = Math.cos(angle) * (node.flipY ? -1 : 1);
  return [
    a,
    b,
    c,
    d,
    node.x + node.width / 2 - (a * node.width) / 2 - (c * node.height) / 2,
    node.y + node.height / 2 - (b * node.width) / 2 - (d * node.height) / 2,
  ];
}

/**
 * 变换矩形四角后重新求轴对齐边界，供空间索引快速排除不可见节点。
 *
 * @param matrix - 将节点局部坐标转换到画布空间的矩阵。
 * @param bounds - 用于布局、查询或素材定位的矩形范围。
 * @returns 变换后的包围盒。
 */
export function transformedBounds(matrix: Matrix, bounds: Bounds): Bounds {
  const points = [
    transform(matrix, bounds),
    transform(matrix, { x: bounds.x + bounds.width, y: bounds.y }),
    transform(matrix, { x: bounds.x, y: bounds.y + bounds.height }),
    transform(matrix, { x: bounds.x + bounds.width, y: bounds.y + bounds.height }),
  ];
  const x = Math.min(
      ...points.map(
        /** 提取当前项的横坐标，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的横坐标。 */
        (p) => p.x,
      ),
    ),
    y = Math.min(
      ...points.map(
        /** 提取当前项的纵坐标，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的纵坐标。 */
        (p) => p.y,
      ),
    );
  return {
    x,
    y,
    width:
      Math.max(
        ...points.map(
          /** 提取当前项的横坐标，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的横坐标。 */
          (p) => p.x,
        ),
      ) - x,
    height:
      Math.max(
        ...points.map(
          /** 提取当前项的纵坐标，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项的纵坐标。 */
          (p) => p.y,
        ),
      ) - y,
  };
}

/**
 * 用轴对齐边界判断两个区域是否相交，作为空间查询的快速筛选。
 *
 * @param a - 第一个比较或计算对象。
 * @param b - 第二个比较或计算对象。
 * @returns 两个区域是否有交集。
 */
export function intersects(a: Bounds, b: Bounds) {
  return (
    a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y
  );
}

// Large shapes go in a separate bucket: a page-sized frame must not allocate millions of cells.
/** 网格空间索引；大图形单独存储，避免为整页容器分配过多网格。 */
export class SpatialIndex<
  T extends {
    /** 用于布局、查询或素材定位的矩形范围。 */
    bounds: Bounds;
  },
> {
  /** 按网格坐标分桶的空间索引。 */
  private cells = new Map<string, T[]>();
  /** 尺寸过大的条目，单独存储以免占用过多网格。 */
  private large: T[] = [];
  /** 索引中的全部条目，供大范围查询回退遍历。 */
  private items: T[] = [];
  /** 空间索引每个网格单元的边长。 */
  private cellSize: number;
  /**
   * 建立 SpatialIndex 实例并保存其依赖，让后续操作共用同一份资源或状态。
   *
   * @param cellSize - 空间索引每个网格单元的边长。
   * @returns 构造完成的实例；构造函数不显式返回业务数据。
   */
  constructor(cellSize = 256) {
    this.cellSize = cellSize;
  }

  /**
   * 把普通节点放入网格，大节点单独存储，避免大画框占用海量网格单元。
   *
   * @param item - 当前遍历的条目。
   * @returns 无返回值；更新空间索引。
   */
  insert(item: T) {
    this.items.push(item);
    const [left, top, right, bottom] = this.range(item.bounds);
    if ((right - left + 1) * (bottom - top + 1) > 64) {
      this.large.push(item);
      return;
    }
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) {
        const key = `${x}:${y}`,
          cell = this.cells.get(key);
        if (cell) cell.push(item);
        else this.cells.set(key, [item]);
      }
  }

  /**
   * 查询与指定区域相交的条目，缩小渲染或框选需要遍历的范围。
   *
   * @param bounds - 用于布局、查询或素材定位的矩形范围。
   * @returns 与区域相交的候选结果。
   */
  query(bounds: Bounds): T[] {
    const [left, top, right, bottom] = this.range(bounds);
    if ((right - left + 1) * (bottom - top + 1) > 4096)
      return this.items.filter(
        /** 判断 query 中的条目是否符合保留条件。 @param item - 当前遍历的条目。 @returns 该条目是否符合条件。 */
        (item) => intersects(item.bounds, bounds),
      );
    const result = new Set<T>();
    for (const item of this.large) if (intersects(item.bounds, bounds)) result.add(item);
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) {
        for (const item of this.cells.get(`${x}:${y}`) ?? [])
          if (intersects(item.bounds, bounds)) result.add(item);
      }
    return [...result];
  }

  /**
   * 把矩形边界换算为网格范围，供索引插入和查询复用。
   *
   * @param b - 第二个比较或计算对象。
   * @returns 左、上、右、下对应的网格编号。
   */
  private range(b: Bounds) {
    return [
      Math.floor(b.x / this.cellSize),
      Math.floor(b.y / this.cellSize),
      Math.floor((b.x + b.width) / this.cellSize),
      Math.floor((b.y + b.height) / this.cellSize),
    ];
  }
}
