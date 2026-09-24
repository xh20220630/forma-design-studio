import polygonClipping, {
  type Polygon,
  type MultiPolygon,
  type Pair,
  type Ring,
} from 'polygon-clipping';
import type { DesignNode } from '@forma/schema';

/**
 * 图形布尔运算方式，集中定义允许的分支以保持调用方一致。
 * 取值：union（合并）、difference（从首个形状减去其他形状）、intersection（保留重叠区域）、xor（保留不重叠区域）。
 */
export type BooleanOperation = 'union' | 'difference' | 'intersection' | 'xor';
const operationLabels: Record<BooleanOperation, string> = {
  union: '联合',
  difference: '减去顶层',
  intersection: '相交',
  xor: '排除重叠',
};

/**
 * 计算轮廓的有符号面积，用于识别顺逆时针方向及孔洞。
 *
 * @param ring - 一条闭合多边形轮廓。
 * @returns 轮廓的有符号面积。
 */
function ringArea(ring: Ring) {
  return Math.abs(
    ring.reduce(
      /**
       * 累积 ringArea 中的条目结果，供后续计算使用。
       *
       * @param sum - 累加到当前项之前的结果。
       * @param point - 当前处理的坐标点。
       * @param i - 当前循环位置，从 0 开始。
       * @returns 纳入当前条目后的累计结果。
       */
      (sum, point, i) => {
        const next = ring[(i + 1) % ring.length];
        return sum + point[0] * next[1] - next[0] * point[1];
      },
      0,
    ) / 2,
  );
}
/**
 * 判断点是否位于轮廓内，为孔洞与外环的归属关系提供依据。
 *
 * @param ring - 一条闭合多边形轮廓。
 * @param point - 当前处理的坐标点。
 * @returns 点是否落在轮廓内部。
 */
function contains(ring: Ring, point: Pair) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
/**
 * 把嵌套轮廓组织为外环与孔洞，使布尔运算正确保留空心区域。
 *
 * @param rings - 参与几何运算的轮廓集合。
 * @returns 适合多边形布尔运算的轮廓分组。
 */
function groupRings(rings: Ring[]): MultiPolygon {
  const sorted = rings.sort(
    /** 比较 groupRings 中的两个条目，确定它们的先后顺序。 @param a - 第一个比较或计算对象。 @param b - 第二个比较或计算对象。 @returns 负数、零或正数，分别表示前排、相同顺序或后排。 */
    (a, b) => ringArea(b) - ringArea(a),
  );
  const ancestors = sorted.map(
    /**
     * 转换 groupRings 中的集合条目，供后续处理或展示。
     *
     * @param ring - 一条闭合多边形轮廓。
     * @param i - 当前循环位置，从 0 开始。
     * @returns 当前条目转换后的结果。
     */
    (ring, i) =>
      sorted
        .slice(0, i)
        .map(
          /** 转换 groupRings 中的集合条目，供后续处理或展示。 @param candidate - 正在校验或比较的候选值。 @param index - 空间查询索引或当前条目的位置。 @returns 当前条目转换后的结果。 */
          (candidate, index) => (contains(candidate, ring[0]) ? index : -1),
        )
        .filter(
          /** 检查位置不小于0，供集合筛选或定位使用。 @param index - 空间查询索引或当前条目的位置。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
          (index) => index >= 0,
        ),
  );
  const result: MultiPolygon = [];
  const outer = new Map<number, Polygon>();
  sorted.forEach(
    /**
     * 逐项处理 groupRings 中的内容，把结果写入外层维护的集合或绘制上下文。
     *
     * @param ring - 一条闭合多边形轮廓。
     * @param i - 当前循环位置，从 0 开始。
     * @returns 无返回值；当前项的处理通过副作用完成。
     */
    (ring, i) => {
      if (ancestors[i].length % 2 === 0) {
        const polygon = [ring];
        outer.set(i, polygon);
        result.push(polygon);
      } else outer.get(ancestors[i][ancestors[i].length - 1])?.push(ring);
    },
  );
  return result;
}

/**
 * 解析由直线组成的 SVG 路径，拒绝不能精确转换的曲线命令。
 *
 * @param path - 文件路径或矢量路径内容，具体格式由所属对象约定。
 * @returns 可用于布尔运算的线性轮廓。
 */
function linearPath(path: string): MultiPolygon {
  if (/[^MLZmlz\d\s.,+eE-]/.test(path))
    throw new Error('曲线路径暂不支持布尔运算，请使用封闭直线节点。');
  const tokens = path.match(/[MLZmlz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const rings: Ring[] = [];
  let ring: Ring = [],
    current: Pair = [0, 0],
    command = '',
    index = 0;
  while (index < tokens.length) {
    if (/^[MLZmlz]$/.test(tokens[index])) {
      command = tokens[index++];
      if (command.toUpperCase() === 'Z') {
        if (ring.length >= 3) rings.push(ring);
        current = ring[0] ?? current;
        ring = [];
        command = '';
        continue;
      }
    }
    if (!command || index + 1 >= tokens.length || /^[MLZmlz]$/.test(tokens[index + 1]))
      throw new Error('路径坐标不完整，无法进行布尔运算。');
    const x = Number(tokens[index++]),
      y = Number(tokens[index++]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('路径坐标无效。');
    const next: Pair =
      command === command.toLowerCase() ? [current[0] + x, current[1] + y] : [x, y];
    if (command.toUpperCase() === 'M' && ring.length) {
      if (ring.length >= 3) rings.push(ring);
      ring = [];
    }
    ring.push(next);
    current = next;
    command = command === command.toLowerCase() ? 'l' : 'L';
  }
  if (ring.length >= 3) rings.push(ring);
  if (!rings.length) throw new Error('至少需要三个顶点的封闭路径。');
  return groupRings(rings);
}

/**
 * 把节点形状转换为局部多边形，统一不同图形的布尔运算输入。
 *
 * @param node - 当前处理的设计节点。
 * @returns 节点的局部轮廓集合。
 */
function localGeometry(node: DesignNode): MultiPolygon {
  const w = node.width,
    h = node.height;
  if (node.type === 'path') {
    if (!node.closed) throw new Error('请先闭合路径，再进行布尔运算。');
    if (node.path) return linearPath(node.path);
    if (node.points && node.points.length >= 3)
      return [
        [
          node.points.map(
            /** 转换 localGeometry 中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
            (p) => [p.x, p.y] as Pair,
          ),
        ],
      ];
  }
  if (node.type === 'rectangle') {
    const radius = Math.min(Math.max(0, node.radius ?? 0), w / 2, h / 2);
    if (!radius)
      return [
        [
          [
            [0, 0],
            [w, 0],
            [w, h],
            [0, h],
          ],
        ],
      ];
    const corners: Pair[] = [
      [w - radius, radius],
      [w - radius, h - radius],
      [radius, h - radius],
      [radius, radius],
    ];
    return [
      [
        corners.flatMap(
          /**
           * 转换 localGeometry 中的集合条目并展开结果，供后续处理或展示。
           *
           * @param arg1 - 按顺序解构的当前条目。
           * @param arg1.cx - 图形中心的水平坐标。
           * @param arg1.cy - 图形中心的垂直坐标。
           * @param corner - 当前矩形角点。
           * @returns 当前条目展开后的结果。
           */
          ([cx, cy], corner) =>
            Array.from(
              { length: 17 },
              /**
               * 执行 localGeometry 传入的局部处理步骤，使调用处能够控制结果如何更新。
               *
               * @param _ - 当前步骤不使用的占位参数。
               * @param i - 当前循环位置，从 0 开始。
               * @returns 当前步骤的处理结果。
               */
              (_, i): Pair => {
                const angle = ((-90 + corner * 90 + (i * 90) / 16) * Math.PI) / 180;
                return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
              },
            ),
        ),
      ],
    ];
  }
  if (node.type === 'ellipse')
    return [
      [
        Array.from(
          { length: 96 },
          /**
           * 执行 localGeometry 传入的局部处理步骤，使调用处能够控制结果如何更新。
           *
           * @param _ - 当前步骤不使用的占位参数。
           * @param i - 当前循环位置，从 0 开始。
           * @returns 当前步骤的处理结果。
           */
          (_, i): Pair => {
            const angle = (i / 96) * Math.PI * 2;
            return [w / 2 + (Math.cos(angle) * w) / 2, h / 2 + (Math.sin(angle) * h) / 2];
          },
        ),
      ],
    ];
  if (node.type === 'polygon' || node.type === 'star') {
    if (node.points?.length)
      return [
        [
          node.points.map(
            /** 转换 localGeometry 中的集合条目，供后续处理或展示。 @param p - 当前坐标点或内容片段。 @returns 当前条目转换后的结果。 */
            (p) => [p.x, p.y] as Pair,
          ),
        ],
      ];
    const sides = Math.max(
      3,
      Math.min(64, Math.round(node.polygonSides ?? (node.type === 'star' ? 5 : 3))),
    );
    const count = node.type === 'star' ? sides * 2 : sides;
    return [
      [
        Array.from(
          { length: count },
          /**
           * 执行 localGeometry 传入的局部处理步骤，使调用处能够控制结果如何更新。
           *
           * @param _ - 当前步骤不使用的占位参数。
           * @param i - 当前循环位置，从 0 开始。
           * @returns 当前步骤的处理结果。
           */
          (_, i): Pair => {
            const angle = (i * Math.PI * 2) / count - Math.PI / 2;
            const ratio = node.type === 'star' && i % 2 ? (node.starRatio ?? 0.45) : 1;
            return [
              w / 2 + ((Math.cos(angle) * w) / 2) * ratio,
              h / 2 + ((Math.sin(angle) * h) / 2) * ratio,
            ];
          },
        ),
      ],
    ];
  }
  throw new Error('布尔运算支持矩形、椭圆、多边形、星形和封闭直线路径。');
}

/**
 * 解析选中节点的实际几何形状并执行布尔运算，再生成可编辑路径。
 *
 * @param nodes - 按约定顺序保存的设计节点集合。
 * @param ids - 参与当前操作的对象标识集合。
 * @param operation - 本次要执行的操作。
 * @param resolve - 异步操作成功时调用的完成函数。
 * @returns 更新后的节点集合与结果节点 ID。
 */
export function booleanNodes(
  nodes: DesignNode[],
  ids: string[],
  operation: BooleanOperation,
  /**
   * 执行 booleanNodes 传入的局部处理步骤，使调用处能够控制结果如何更新。
   *
   * @param node - 当前处理的设计节点。
   * @returns 当前步骤的处理结果。
   */
  resolve: (node: DesignNode) => DesignNode = (node) => node,
): {
  /** 按约定顺序保存的设计节点集合。 */
  nodes: DesignNode[];
  /** 当前选择对象的标识。 */
  selectedId: string;
} {
  const selected = nodes.filter(
    /** 检查ids包含节点的标识，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (node) => ids.includes(node.id),
  );
  if (selected.length < 2) throw new Error('请至少选择两个图形。');
  if (
    selected.some(
      /** 检查节点的锁定状态或节点的可见性等于假，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (node) => node.locked || node.visible === false,
    )
  )
    throw new Error('请先解锁并显示所有选中的图形。');
  const source = selected[0];
  if (
    selected.some(
      /** 检查节点的父节点标识不等于 source 的父节点标识，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (node) => node.parentId !== source.parentId,
    )
  )
    throw new Error('请将图形放在同一个父级中。');
  const geometries = selected.map(
    /**
     * 转换 booleanNodes 中的集合条目，供后续处理或展示。
     *
     * @param input - 当前步骤需要处理的输入。
     * @returns 当前条目转换后的结果。
     */
    (input) => {
      const node = resolve(input);
      const angle = ((node.rotation ?? 0) * Math.PI) / 180;
      return localGeometry(node).map(
        /**
         * 转换 booleanNodes 中的集合条目，供后续处理或展示。
         *
         * @param polygon - 当前参与计算的多边形。
         * @returns 当前条目转换后的结果。
         */
        (polygon) =>
          polygon.map(
            /**
             * 转换 booleanNodes 中的集合条目，供后续处理或展示。
             *
             * @param ring - 一条闭合多边形轮廓。
             * @returns 当前条目转换后的结果。
             */
            (ring) =>
              ring.map(
                /**
                 * 转换 booleanNodes 中的集合条目，供后续处理或展示。
                 *
                 * @param options - 按顺序解构的当前条目。
                 * @param options.x - 水平方向的位置。
                 * @param options.y - 垂直方向的位置。
                 * @returns 当前条目转换后的结果。
                 */
                ([x, y]): Pair => {
                  const dx = (x - node.width / 2) * (node.flipX ? -1 : 1),
                    dy = (y - node.height / 2) * (node.flipY ? -1 : 1);
                  return [
                    node.x + node.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
                    node.y + node.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle),
                  ];
                },
              ),
          ),
      );
    },
  );
  // The lowest selected layer is the subtraction subject, matching the layer stack.
  const result = polygonClipping[operation](geometries[0], ...geometries.slice(1));
  if (!result.length) throw new Error('运算结果为空，原始图形已保留。');
  const points = result.flat(2);
  const x = Math.min(
      ...points.map(
        /** 提取当前项中指定项，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项中指定项。 */
        (p) => p[0],
      ),
    ),
    y = Math.min(
      ...points.map(
        /** 提取当前项中指定项，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项中指定项。 */
        (p) => p[1],
      ),
    );
  const width =
      Math.max(
        ...points.map(
          /** 提取当前项中指定项，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项中指定项。 */
          (p) => p[0],
        ),
      ) - x,
    height =
      Math.max(
        ...points.map(
          /** 提取当前项中指定项，供后续计算或展示使用。 @param p - 当前坐标点或内容片段。 @returns 当前项中指定项。 */
          (p) => p[1],
        ),
      ) - y;
  /**
   * 把输入转换为可用数值，供当前几何或属性编辑流程继续计算。
   *
   * @param value - 当前字段、模式或控件的取值。
   * @returns 转换后的数值。
   */
  const number = (value: number) => String(Math.round(value * 10000) / 10000);
  const path = result
    .flatMap(
      /**
       * 转换 booleanNodes 中的集合条目并展开结果，供后续处理或展示。
       *
       * @param polygon - 当前参与计算的多边形。
       * @returns 当前条目展开后的结果。
       */
      (polygon) =>
        polygon.map(
          /**
           * 转换 booleanNodes 中的集合条目，供后续处理或展示。
           *
           * @param ring - 一条闭合多边形轮廓。
           * @returns 当前条目转换后的结果。
           */
          (ring) =>
            ring
              .map(
                /** 转换 booleanNodes 中的集合条目，供后续处理或展示。 @param point - 当前处理的坐标点。 @param i - 当前循环位置，从 0 开始。 @returns 当前条目转换后的结果。 */
                (point, i) => `${i ? 'L' : 'M'}${number(point[0] - x)} ${number(point[1] - y)}`,
              )
              .join(' ') + ' Z',
        ),
    )
    .join(' ');
  const id = crypto.randomUUID();
  const geometryProperties = new Set(['x', 'y', 'width', 'height', 'rotation', 'radius']);
  const variableBindings = Object.fromEntries(
    Object.entries(source.variableBindings ?? {}).filter(
      /** 检查geometryProperties包含property不成立，供集合筛选或定位使用。 @param options - 按顺序解构的当前条目。 @param options.property - 要读取或绑定的属性名称。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      ([property]) => !geometryProperties.has(property),
    ),
  );
  const tokenBindings = Object.fromEntries(
    Object.entries(source.tokenBindings ?? {}).filter(
      /** 检查geometryProperties包含property不成立，供集合筛选或定位使用。 @param options - 按顺序解构的当前条目。 @param options.property - 要读取或绑定的属性名称。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      ([property]) => !geometryProperties.has(property),
    ),
  );
  const combined: DesignNode = {
    ...source,
    id,
    name: operationLabels[operation],
    type: 'path',
    x,
    y,
    width,
    height,
    path,
    closed: true,
    rotation: 0,
    flipX: false,
    flipY: false,
    radius: undefined,
    points: undefined,
    polygonSides: undefined,
    starRatio: undefined,
    prototype: undefined,
    constraints: undefined,
    variableBindings,
    tokenBindings,
  };
  const selectedSet = new Set(ids);
  const insert = nodes.findIndex(
    /** 检查节点的标识等于 source 的标识，供集合筛选或定位使用。 @param node - 当前处理的设计节点。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (node) => node.id === source.id,
  );
  return {
    nodes: nodes.flatMap(
      /** 转换 booleanNodes 中的集合条目并展开结果，供后续处理或展示。 @param node - 当前处理的设计节点。 @param i - 当前循环位置，从 0 开始。 @returns 当前条目展开后的结果。 */
      (node, i) => (i === insert ? [combined] : selectedSet.has(node.id) ? [] : [node]),
    ),
    selectedId: id,
  };
}
