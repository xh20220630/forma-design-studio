import { type MultiPolygon, type Pair, type Ring } from 'polygon-clipping';
import { groupRings } from './polygons.ts';

/**
 * 解析由直线组成的 SVG 路径，拒绝不能精确转换的曲线命令。
 *
 * @param path - 文件路径或矢量路径内容，具体格式由所属对象约定。
 * @returns 可用于布尔运算的线性轮廓。
 */
export function linearPath(path: string): MultiPolygon {
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
