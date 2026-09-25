import type { JsonObject } from '../types/json.ts';

/** 确认 JSON 值为对象，使后续字段读取有明确的数据边界。 */
export function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** 仅接受字符串，其他类型使用默认值，便于读取不完整的设计文件。 */
export function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** 仅接受有限数值，防止 NaN 和无穷大进入布局计算。 */
export function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 把未知输入收敛为数组，避免读取缺失集合时中断整个工作空间。 */
export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** 仅保留数组中的字符串项，得到可安全展示和比较的文本集合。 */
export function stringArray(value: unknown): string[] {
  return arrayValue(value).filter((item): item is string => typeof item === 'string');
}
