import { readFileSync } from 'node:fs';
import { getDesignTypeSource } from '@forma/schema/source';

// Keep export packaging here so the API never reaches into the Web application's source.
export function getStandaloneRendererSource() {
  const values = readFileSync(new URL('./scene-values.ts', import.meta.url), 'utf8')
    .replace(/^import type .* from ['"]@forma\/schema['"];?\r?\n/gm, '');
  const renderer = readFileSync(new URL('./SceneRenderer.tsx', import.meta.url), 'utf8')
    .replace(/^import type .* from ['"]@forma\/schema['"];?\r?\n/gm, '')
    .replace(/^(?:import|export) .* from ['"]\.\/scene-values['"];?\r?\n/gm, '');
  return `${renderer}\n${values}\n${getDesignTypeSource()}`;
}
