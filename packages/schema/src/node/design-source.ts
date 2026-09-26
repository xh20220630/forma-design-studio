import { readFileSync } from 'node:fs';

const contractFiles = [
  'theme',
  'nodes',
  'collaboration',
  'variables',
  'project',
  'providers',
  'reconstruction',
];

/** 拼接设计契约并移除内部类型引用，使导出项目不依赖工作区目录。 */
export function getDesignTypeSource() {
  return contractFiles
    .map((name) =>
      readFileSync(new URL(`../contracts/design/${name}.ts`, import.meta.url), 'utf8').replace(
        /^import type[\s\S]*?;\r?\n/gm,
        '',
      ),
    )
    .join('\n');
}
