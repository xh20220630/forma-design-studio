/**
 * 按两个坐标轴缩放 SVG 路径，并修正椭圆弧参数以保留几何形状。
 *
 * @param path - 文件路径或矢量路径内容，具体格式由所属对象约定。
 * @param sx - 水平方向的缩放倍率。
 * @param sy - 垂直方向的缩放倍率。
 * @returns 缩放后的路径；无法安全解析时保留原路径。
 */
export function scalePath(path: string, sx: number, sy: number): string {
  if ((sx === 1 && sy === 1) || !Number.isFinite(sx) || !Number.isFinite(sy)) return path;
  if (!/^[MmLlHhVvCcSsQqTtAaZzEe0-9+.,\s-]+$/.test(path)) return path;
  const tokens =
    path.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const arity: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
  const output: string[] = [];
  let command = '',
    index = 0;
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    const upper = command.toUpperCase();
    if (upper === 'Z') {
      output.push(command);
      command = '';
      continue;
    }
    const count = arity[upper];
    if (!count || index + count > tokens.length) return path;
    const values = tokens.slice(index, index + count).map(Number);
    if (!values.every(Number.isFinite)) return path;
    index += count;
    if (upper === 'H') values[0] *= sx;
    else if (upper === 'V') values[0] *= sy;
    else if (upper === 'A') {
      const [rx, ry, degrees] = values,
        angle = (degrees * Math.PI) / 180;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      // Nonuniform scaling changes a rotated ellipse's principal axes.
      const a = sx * sx * (rx * rx * cos * cos + ry * ry * sin * sin);
      const b = sx * sy * cos * sin * (rx * rx - ry * ry);
      const d = sy * sy * (rx * rx * sin * sin + ry * ry * cos * cos);
      const delta = Math.hypot(a - d, 2 * b);
      values[0] = Math.sqrt(Math.max(0, (a + d + delta) / 2));
      values[1] = Math.sqrt(Math.max(0, (a + d - delta) / 2));
      values[2] = (Math.atan2(2 * b, a - d) * 90) / Math.PI;
      if (sx * sy < 0) values[4] = values[4] ? 0 : 1;
      values[5] *= sx;
      values[6] *= sy;
    } else
      for (let coordinate = 0; coordinate < values.length; coordinate++)
        values[coordinate] *= coordinate % 2 ? sy : sx;
    output.push(command, ...values.map((value) => String(Number(value.toFixed(8)))));
    if (upper === 'M') command = command === 'm' ? 'l' : 'L';
  }
  return output.join(' ');
}
