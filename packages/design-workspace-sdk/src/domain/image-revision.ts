/** 优先使用显式版本，否则从素材文件名推断版本以兼容旧数据。 */
export function parseImageRevision(value: unknown, assetPath: string) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  return Number(/-v(\d+)\.[^.]+$/i.exec(assetPath)?.[1] || 1);
}
