import { readFile } from 'node:fs/promises';
import type { JsonObject } from '../../types/json.ts';
import { isObject } from '../../utils/json.ts';

/** 读取 UTF-8 JSON 数据，供持久化状态和配置加载使用。 */
export async function readJson(file: string): Promise<JsonObject> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!isObject(value)) throw new Error(`${file} 必须包含 JSON 对象。`);
  return value;
}
