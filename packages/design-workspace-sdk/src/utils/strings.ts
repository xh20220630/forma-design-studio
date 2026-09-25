/** 把名称规范化为路径友好的标识，无法提取时使用稳定的默认名称。 */
export function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'design-project'
  );
}
