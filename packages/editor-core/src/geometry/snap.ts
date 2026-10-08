export function nearestSnap(sorted: number[], value: number, distance: number): number | undefined {
  let left = 0,
    right = sorted.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    if (sorted[middle] < value) left = middle + 1;
    else right = middle;
  }
  let result: number | undefined;
  for (const index of [left - 1, left]) {
    if (index < 0 || index >= sorted.length) continue;
    const delta = Math.abs(sorted[index] - value);
    if (delta < distance) {
      result = sorted[index];
      distance = delta;
    }
  }
  return result;
}
