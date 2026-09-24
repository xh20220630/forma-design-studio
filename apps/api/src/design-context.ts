import type { Project } from '@forma/schema';
import { createHash } from 'node:crypto';

/**
 * 递归按键名排序对象，使内容相同但字段顺序不同的数据产生相同摘要。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @returns 顺序稳定的数据副本。
 */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(
          /** 转换 stable 中的集合条目，供后续处理或展示。 @param key - 要访问或更新的字段名。 @returns 当前条目转换后的结果。 */
          (key) => [key, stable((value as Record<string, unknown>)[key])],
        ),
    );
  return value;
}

/**
 * 提取影响生成结果的设计信息，排除与生成无关的运行状态。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 模型使用的设计上下文。
 */
export function designContext(project: Project) {
  return {
    name: project.name,
    description: project.description,
    tokens: activeProjectTokens(project),
    themeModes: project.themeModes,
    activeMode: project.activeMode,
    variableCollections: project.variableCollections,
    activeVariableModes: project.activeVariableModes,
    components: project.components,
    pages: project.pages.map(
      /**
       * 转换 designContext 中的集合条目，供后续处理或展示。
       *
       * @param options - 按字段解构的输入，字段用途见对应类型定义。
       * @param options.id - 唯一标识，用于查找、更新和建立引用。
       * @param options.name - 面向用户展示的名称。
       * @param options.width - 对象的宽度。
       * @param options.height - 对象的高度。
       * @returns 当前条目转换后的结果。
       */
      ({ id, name, width, height }) => ({ id, name, width, height }),
    ),
  };
}

/**
 * 优先读取当前主题模式，缺少模式定义时回退到项目默认主题。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 当前生效的主题 Token。
 */
export function activeProjectTokens(project: Project) {
  return project.activeMode &&
    project.themeModes &&
    Object.hasOwn(project.themeModes, project.activeMode)
    ? project.themeModes[project.activeMode]
    : project.tokens;
}

/**
 * 为稳定排序后的设计上下文计算摘要，用于判断参考图是否过期。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 十六进制 SHA-256 摘要。
 */
export function designContextHash(project: Project) {
  return createHash('sha256')
    .update(JSON.stringify(stable(designContext(project))))
    .digest('hex');
}

/**
 * 比较保存前后的设计上下文；上下文变化后必须重新确认参考图。
 *
 * @param current - 更新前的当前值。
 * @param incoming - 新收到并准备合并的数据。
 * @returns 沿用或撤销确认后的生成记录；原来没有记录时返回 undefined。
 */
export function currentGeneration(current: Project | undefined, incoming: Project) {
  if (!current?.generation) return undefined;
  if (designContextHash(current) === designContextHash(incoming)) return current.generation;
  return { ...current.generation, approved: false };
}
