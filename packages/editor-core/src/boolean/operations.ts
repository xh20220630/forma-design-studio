import polygonClipping, { type MultiPolygon, type Pair } from 'polygon-clipping';
import type { DesignNode } from '@forma/schema';
import type { BooleanOperation } from './types.ts';
import { linearPath } from './paths.ts';

export const operationLabels: Record<BooleanOperation, string> = {
  union: '联合',
  difference: '减去顶层',
  intersection: '相交',
  xor: '排除重叠',
};

/**
 * 把节点形状转换为局部多边形，统一不同图形的布尔运算输入。
 *
 * @param node - 当前处理的设计节点。
 * @returns 节点的局部轮廓集合。
 */
export function localGeometry(node: DesignNode): MultiPolygon {
  const w = node.width,
    h = node.height;
  if (node.type === 'path') {
    if (!node.closed) throw new Error('请先闭合路径，再进行布尔运算。');
    if (node.path) return linearPath(node.path);
    if (node.points && node.points.length >= 3)
      return [[node.points.map((p) => [p.x, p.y] as Pair)]];
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
        corners.flatMap(([cx, cy], corner) =>
          Array.from({ length: 17 }, (_, i): Pair => {
            const angle = ((-90 + corner * 90 + (i * 90) / 16) * Math.PI) / 180;
            return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
          }),
        ),
      ],
    ];
  }
  if (node.type === 'ellipse')
    return [
      [
        Array.from({ length: 96 }, (_, i): Pair => {
          const angle = (i / 96) * Math.PI * 2;
          return [w / 2 + (Math.cos(angle) * w) / 2, h / 2 + (Math.sin(angle) * h) / 2];
        }),
      ],
    ];
  if (node.type === 'polygon' || node.type === 'star') {
    if (node.points?.length) return [[node.points.map((p) => [p.x, p.y] as Pair)]];
    const sides = Math.max(
      3,
      Math.min(64, Math.round(node.polygonSides ?? (node.type === 'star' ? 5 : 3))),
    );
    const count = node.type === 'star' ? sides * 2 : sides;
    return [
      [
        Array.from({ length: count }, (_, i): Pair => {
          const angle = (i * Math.PI * 2) / count - Math.PI / 2;
          const ratio = node.type === 'star' && i % 2 ? (node.starRatio ?? 0.45) : 1;
          return [
            w / 2 + ((Math.cos(angle) * w) / 2) * ratio,
            h / 2 + ((Math.sin(angle) * h) / 2) * ratio,
          ];
        }),
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
 * @param resolve - 解析节点绑定后的实际几何属性；默认使用原节点。
 * @returns 更新后的节点集合与结果节点 ID。
 */
export function booleanNodes(
  nodes: DesignNode[],
  ids: string[],
  operation: BooleanOperation,
  resolve: (node: DesignNode) => DesignNode = (node) => node,
): {
  /** 按约定顺序保存的设计节点集合。 */
  nodes: DesignNode[];
  /** 当前选择对象的标识。 */
  selectedId: string;
} {
  const selected = nodes.filter((node) => ids.includes(node.id));
  if (selected.length < 2) throw new Error('请至少选择两个图形。');
  if (selected.some((node) => node.locked || node.visible === false))
    throw new Error('请先解锁并显示所有选中的图形。');
  const source = selected[0];
  if (selected.some((node) => node.parentId !== source.parentId))
    throw new Error('请将图形放在同一个父级中。');
  const geometries = selected.map((input) => {
    const node = resolve(input);
    const angle = ((node.rotation ?? 0) * Math.PI) / 180;
    return localGeometry(node).map((polygon) =>
      polygon.map((ring) =>
        ring.map(([x, y]): Pair => {
          const dx = (x - node.width / 2) * (node.flipX ? -1 : 1),
            dy = (y - node.height / 2) * (node.flipY ? -1 : 1);
          return [
            node.x + node.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
            node.y + node.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle),
          ];
        }),
      ),
    );
  });
  // The lowest selected layer is the subtraction subject, matching the layer stack.
  const result = polygonClipping[operation](geometries[0], ...geometries.slice(1));
  if (!result.length) throw new Error('运算结果为空，原始图形已保留。');
  const points = result.flat(2);
  const x = Math.min(...points.map((p) => p[0])),
    y = Math.min(...points.map((p) => p[1]));
  const width = Math.max(...points.map((p) => p[0])) - x,
    // 包围盒高度是最下方顶点到顶部 y 的距离。
    height = Math.max(...points.map((p) => p[1])) - y;
  const number = (value: number) => String(Math.round(value * 10000) / 10000);
  const path = result
    .flatMap((polygon) =>
      polygon.map(
        (ring) =>
          ring
            .map((point, i) => `${i ? 'L' : 'M'}${number(point[0] - x)} ${number(point[1] - y)}`)
            .join(' ') + ' Z',
      ),
    )
    .join(' ');
  const id = crypto.randomUUID();
  const geometryProperties = new Set(['x', 'y', 'width', 'height', 'rotation', 'radius']);
  const variableBindings = Object.fromEntries(
    Object.entries(source.variableBindings ?? {}).filter(
      ([property]) => !geometryProperties.has(property),
    ),
  );
  const tokenBindings = Object.fromEntries(
    Object.entries(source.tokenBindings ?? {}).filter(
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
  const insert = nodes.findIndex((node) => node.id === source.id);
  return {
    nodes: nodes.flatMap((node, i) =>
      i === insert ? [combined] : selectedSet.has(node.id) ? [] : [node],
    ),
    selectedId: id,
  };
}
