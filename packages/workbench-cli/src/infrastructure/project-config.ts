import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 优先读取项目配置中的设计目录，让命令行与工作台使用相同数据源。
 *
 * @param projectRoot - 执行初始化或安装的项目根目录。
 * @returns 解析后的设计目录。
 */
export async function configuredDesignRoot(projectRoot: string) {
  try {
    const config: unknown = JSON.parse(
      await readFile(path.join(projectRoot, 'forma.config.json'), 'utf8'),
    );
    if (
      config &&
      typeof config === 'object' &&
      !Array.isArray(config) &&
      typeof (
        config as {
          /** 设计文档与素材所在的根目录。 */
          designRoot?: unknown;
        }
      ).designRoot === 'string'
    )
      return path.resolve(
        projectRoot,
        (
          config as {
            /** 设计文档与素材所在的根目录。 */
            designRoot: string;
          }
        ).designRoot,
      );
  } catch {
    /* use default */
  }
  return path.join(projectRoot, 'design');
}
