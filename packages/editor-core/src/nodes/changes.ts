import type { DesignNode } from '@forma/schema';

function equalValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) && equalValue(left[key], right[key]),
    )
  );
}

/** 只检查被替换的节点，避免把图片字符串序列化成另一份整页副本。 */
export function hasNodeChanges(before: DesignNode[], after: DesignNode[]): boolean {
  return (
    before !== after &&
    (before.length !== after.length ||
      before.some((node, index) => !equalValue(node, after[index])))
  );
}
