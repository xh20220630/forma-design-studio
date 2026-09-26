/**
 * 整理语义 Token 为展示条目，便于设计系统面板按组浏览。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @param prefix - 生成名称、路径或标签时使用的前缀。
 * @returns 可展示的 Token 条目。
 */
export function tokenEntries(
  value: unknown,
  prefix = '',
): {
  /** 面向用户展示的名称。 */
  name: string;
  /** 当前字段、模式或控件的取值。 */
  value: string;
}[] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      tokenEntries(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [
    { name: prefix, value: typeof value === 'string' ? value : (JSON.stringify(value) ?? '—') },
  ];
}
