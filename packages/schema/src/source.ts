import { readFileSync } from 'node:fs';

// Public Node-only entry for embedding the design contract in standalone exports.
/**
 * 从共享定义读取设计类型源码，避免导出项目维护另一套数据契约。
 * @returns 设计模型的 TypeScript 源码。
 */
export function getDesignTypeSource() {
  return readFileSync(new URL('./design.ts', import.meta.url), 'utf8');
}
