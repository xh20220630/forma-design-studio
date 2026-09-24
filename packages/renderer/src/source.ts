import { readFileSync } from 'node:fs';
import { getDesignTypeSource } from '@forma/schema/source';

// Keep export packaging here so the API never reaches into the Web application's source.
/**
 * 读取独立渲染所需源码，让导出项目无需依赖当前仓库。
 * @returns 可写入导出项目的渲染器源码。
 */
export function getStandaloneRendererSource() {
  const values = readFileSync(new URL('./scene-values.ts', import.meta.url), 'utf8').replace(
    /^import type .* from ['"]@forma\/schema['"];?\r?\n/gm,
    '',
  );
  const renderer = readFileSync(new URL('./SceneRenderer.tsx', import.meta.url), 'utf8')
    .replace(/^import type .* from ['"]@forma\/schema['"];?\r?\n/gm, '')
    .replace(/^(?:import|export) .* from ['"]\.\/scene-values['"];?\r?\n/gm, '');
  return `${renderer}\n${values}\n${getDesignTypeSource()}`;
}
