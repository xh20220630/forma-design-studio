import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** 按稳定顺序计算目录内容摘要，用于识别技能安装是否被修改。 */
export async function checksumDirectory(root: string) {
  const { readdir } = await import('node:fs/promises');
  const hash = createHash('sha256');
  async function visit(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name === '.forma-skill.json') continue;
      const file = path.join(directory, entry.name);
      const relative = path.relative(root, file).split(path.sep).join('/');
      hash.update(relative);
      if (entry.isDirectory()) await visit(file);
      else hash.update(await readFile(file));
    }
  }
  await visit(root);
  return `sha256:${hash.digest('hex')}`;
}
