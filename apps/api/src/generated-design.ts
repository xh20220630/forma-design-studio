import { isRecord } from './errors.ts';

// Adapt unambiguous model spellings at the model boundary. Project validation
// remains strict, including ranges, token types, conflicting bindings and IDs.
/**
 * 只修正模型输出中无歧义的字段写法，保留严格校验对错误数据的拦截。
 *
 * @param result - 上一步操作得到的结果。
 * @returns 字段写法规范化后的设计对象。
 */
export function normalizeGeneratedDesign(result: Record<string, unknown>) {
  /**
   * 统一页面和组件中的字体粗细与 Token 字段别名，避免两种入口行为不同。
   *
   * @param entries - 按绘制顺序排列的场景条目。
   * @returns 规范化后的集合；非数组输入留给后续校验处理。
   */
  const normalizeEntries = (entries: unknown): unknown =>
    !Array.isArray(entries)
      ? entries
      : entries.map(
          /**
           * 转换 normalizeEntries 中的集合条目，供后续处理或展示。
           *
           * @param entry - 缓存的已编译场景条目。
           * @returns 当前条目转换后的结果。
           */
          (entry) => {
            if (!isRecord(entry) || !Array.isArray(entry.nodes)) return entry;
            return {
              ...entry,
              nodes: entry.nodes.map(
                /**
                 * 转换 normalizeEntries 中的集合条目，供后续处理或展示。
                 *
                 * @param value - 当前字段、模式或控件的取值。
                 * @returns 当前条目转换后的结果。
                 */
                (value) => {
                  if (!isRecord(value)) return value;
                  const node = { ...value };
                  if (node.fontWeight === null) delete node.fontWeight;
                  if (typeof node.fontWeight === 'string') {
                    const weight = node.fontWeight.trim().toLowerCase();
                    if (weight === 'normal') node.fontWeight = 400;
                    else if (weight === 'bold') node.fontWeight = 700;
                    else if (/^\d+(?:\.\d+)?$/.test(weight)) node.fontWeight = Number(weight);
                  }
                  if (isRecord(node.tokenBindings)) {
                    const bindings = { ...node.tokenBindings };
                    if (
                      bindings.border !== undefined &&
                      (bindings.stroke === undefined || bindings.stroke === bindings.border)
                    ) {
                      bindings.stroke = bindings.border;
                      delete bindings.border;
                    }
                    node.tokenBindings = bindings;
                  }
                  return node;
                },
              ),
            };
          },
        );
  return {
    ...result,
    pages: normalizeEntries(result.pages),
    components: normalizeEntries(result.components),
  };
}
