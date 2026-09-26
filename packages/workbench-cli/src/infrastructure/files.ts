import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 只在目标文件不存在时写入模板，避免初始化覆盖已有设计文档。
 *
 * @param file - 需要读取、写入或导入的文件。
 * @param content - 文件、消息或编辑文档的正文。
 * @returns 是否创建了文件。
 */
export async function writeIfMissing(file: string, content: string) {
  try {
    await readFile(file);
    return false;
  } catch {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
    return true;
  }
}

/**
 * 为本机状态补充忽略规则，避免个人缓存被提交到仓库。
 *
 * @param projectRoot - 执行初始化或安装的项目根目录。
 * @returns 忽略文件是新建、更新还是保持原样。
 */
export async function ensureGitignore(projectRoot: string) {
  const file = path.join(projectRoot, '.gitignore');
  try {
    const current = await readFile(file, 'utf8');
    if (current.split(/\r?\n/).includes('.forma/')) return 'unchanged' as const;
    await writeFile(file, `${current}${current && !current.endsWith('\n') ? '\n' : ''}.forma/\n`);
    return 'updated' as const;
  } catch {
    await writeFile(file, '.forma/\n');
    return 'created' as const;
  }
}
