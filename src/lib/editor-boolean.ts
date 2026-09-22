import polygonClipping, {
  type Polygon,
  type MultiPolygon,
  type Pair,
  type Ring,
} from "polygon-clipping";
import type { DesignNode } from "../types";

export type BooleanOperation = "union" | "difference" | "intersection" | "xor";
const operationLabels: Record<BooleanOperation, string> = {
  union: "联合",
  difference: "减去顶层",
  intersection: "相交",
  xor: "排除重叠",
};

function ringArea(ring: Ring) {
  return Math.abs(
    ring.reduce((sum, point, i) => {
      const next = ring[(i + 1) % ring.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2,
  );
}
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
function groupRings(rings: Ring[]): MultiPolygon {
  const sorted = rings.sort((a, b) => ringArea(b) - ringArea(a));
  const ancestors = sorted.map((ring, i) =>
    sorted
      .slice(0, i)
      .map((candidate, index) => (contains(candidate, ring[0]) ? index : -1))
      .filter((index) => index >= 0),
  );
  const result: MultiPolygon = [];
  const outer = new Map<number, Polygon>();
  sorted.forEach((ring, i) => {
    if (ancestors[i].length % 2 === 0) {
      const polygon = [ring];
      outer.set(i, polygon);
      result.push(polygon);
    } else outer.get(ancestors[i][ancestors[i].length - 1])?.push(ring);
  });
  return result;
}

function linearPath(path: string): MultiPolygon {
  if (/[^MLZmlz\d\s.,+eE-]/.test(path))
    throw new Error("曲线路径暂不支持布尔运算，请使用封闭直线节点。");
  const tokens =
    path.match(/[MLZmlz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const rings: Ring[] = [];
  let ring: Ring = [],
    current: Pair = [0, 0],
    command = "",
    index = 0;
  while (index < tokens.length) {
    if (/^[MLZmlz]$/.test(tokens[index])) {
      command = tokens[index++];
      if (command.toUpperCase() === "Z") {
        if (ring.length >= 3) rings.push(ring);
        current = ring[0] ?? current;
        ring = [];
        command = "";
        continue;
      }
    }
    if (
      !command ||
      index + 1 >= tokens.length ||
      /^[MLZmlz]$/.test(tokens[index + 1])
    )
      throw new Error("路径坐标不完整，无法进行布尔运算。");
    const x = Number(tokens[index++]),
      y = Number(tokens[index++]);
    if (!Number.isFinite(x) || !Number.isFinite(y))
      throw new Error("路径坐标无效。");
    const next: Pair =
      command === command.toLowerCase()
        ? [current[0] + x, current[1] + y]
        : [x, y];
    if (command.toUpperCase() === "M" && ring.length) {
      if (ring.length >= 3) rings.push(ring);
      ring = [];
    }
    ring.push(next);
    current = next;
    command = command === command.toLowerCase() ? "l" : "L";
  }
  if (ring.length >= 3) rings.push(ring);
  if (!rings.length) throw new Error("至少需要三个顶点的封闭路径。");
  return groupRings(rings);
}

function localGeometry(node: DesignNode): MultiPolygon {
  const w = node.width,
    h = node.height;
  if (node.type === "path") {
    if (!node.closed) throw new Error("请先闭合路径，再进行布尔运算。");
    if (node.path) return linearPath(node.path);
    if (node.points && node.points.length >= 3)
      return [[node.points.map((p) => [p.x, p.y] as Pair)]];
  }
  if (node.type === "rectangle") {
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
            return [
              cx + Math.cos(angle) * radius,
              cy + Math.sin(angle) * radius,
            ];
          }),
        ),
      ],
    ];
  }
  if (node.type === "ellipse")
    return [
      [
        Array.from({ length: 96 }, (_, i): Pair => {
          const angle = (i / 96) * Math.PI * 2;
          return [
            w / 2 + (Math.cos(angle) * w) / 2,
            h / 2 + (Math.sin(angle) * h) / 2,
          ];
        }),
      ],
    ];
  if (node.type === "polygon" || node.type === "star") {
    if (node.points?.length)
      return [[node.points.map((p) => [p.x, p.y] as Pair)]];
    const sides = Math.max(
      3,
      Math.min(
        64,
        Math.round(node.polygonSides ?? (node.type === "star" ? 5 : 3)),
      ),
    );
    const count = node.type === "star" ? sides * 2 : sides;
    return [
      [
        Array.from({ length: count }, (_, i): Pair => {
          const angle = (i * Math.PI * 2) / count - Math.PI / 2;
          const ratio =
            node.type === "star" && i % 2 ? (node.starRatio ?? 0.45) : 1;
          return [
            w / 2 + ((Math.cos(angle) * w) / 2) * ratio,
            h / 2 + ((Math.sin(angle) * h) / 2) * ratio,
          ];
        }),
      ],
    ];
  }
  throw new Error("布尔运算支持矩形、椭圆、多边形、星形和封闭直线路径。");
}

export function booleanNodes(
  nodes: DesignNode[],
  ids: string[],
  operation: BooleanOperation,
  resolve: (node: DesignNode) => DesignNode = (node) => node,
): { nodes: DesignNode[]; selectedId: string } {
  const selected = nodes.filter((node) => ids.includes(node.id));
  if (selected.length < 2) throw new Error("请至少选择两个图形。");
  if (selected.some((node) => node.locked || node.visible === false))
    throw new Error("请先解锁并显示所有选中的图形。");
  const source = selected[0];
  if (selected.some((node) => node.parentId !== source.parentId))
    throw new Error("请将图形放在同一个父级中。");
  const geometries = selected.map((input) => {
    const node = resolve(input);
    const angle = ((node.rotation ?? 0) * Math.PI) / 180;
    return localGeometry(node).map((polygon) =>
      polygon.map((ring) =>
        ring.map(([x, y]): Pair => {
          const dx = (x - node.width / 2) * (node.flipX ? -1 : 1),
            dy = (y - node.height / 2) * (node.flipY ? -1 : 1);
          return [
            node.x +
              node.width / 2 +
              dx * Math.cos(angle) -
              dy * Math.sin(angle),
            node.y +
              node.height / 2 +
              dx * Math.sin(angle) +
              dy * Math.cos(angle),
          ];
        }),
      ),
    );
  });
  // The lowest selected layer is the subtraction subject, matching the layer stack.
  const result = polygonClipping[operation](
    geometries[0],
    ...geometries.slice(1),
  );
  if (!result.length) throw new Error("运算结果为空，原始图形已保留。");
  const points = result.flat(2);
  const x = Math.min(...points.map((p) => p[0])),
    y = Math.min(...points.map((p) => p[1]));
  const width = Math.max(...points.map((p) => p[0])) - x,
    height = Math.max(...points.map((p) => p[1])) - y;
  const number = (value: number) => String(Math.round(value * 10000) / 10000);
  const path = result
    .flatMap((polygon) =>
      polygon.map(
        (ring) =>
          ring
            .map(
              (point, i) =>
                `${i ? "L" : "M"}${number(point[0] - x)} ${number(point[1] - y)}`,
            )
            .join(" ") + " Z",
      ),
    )
    .join(" ");
  const id = crypto.randomUUID();
  const geometryProperties = new Set([
    "x",
    "y",
    "width",
    "height",
    "rotation",
    "radius",
  ]);
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
    type: "path",
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
