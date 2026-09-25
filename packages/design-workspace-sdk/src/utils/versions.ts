/** 按版本号的各段数值比较，避免把 10 错排在 2 前面。 */
export function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10));
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10));
  if (leftParts.some(Number.isNaN) || rightParts.some(Number.isNaN))
    return left.localeCompare(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) return difference;
  }
  return 0;
}
