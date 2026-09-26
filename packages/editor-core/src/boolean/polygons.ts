import { type Polygon, type MultiPolygon, type Pair, type Ring } from 'polygon-clipping';

/**
 * 计算轮廓面积的绝对值，用于按面积从大到小组织外环与孔洞。
 *
 * @param ring - 一条闭合多边形轮廓。
 * @returns 轮廓面积的绝对值。
 */
export function ringArea(ring: Ring) {
  return Math.abs(
    ring.reduce((sum, point, i) => {
      const next = ring[(i + 1) % ring.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2,
  );
}

/**
 * 判断点是否位于轮廓内，为孔洞与外环的归属关系提供依据。
 *
 * @param ring - 一条闭合多边形轮廓。
 * @param point - 当前处理的坐标点。
 * @returns 点是否落在轮廓内部。
 */
export function contains(ring: Ring, point: Pair) {
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
export function groupRings(rings: Ring[]): MultiPolygon {
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
