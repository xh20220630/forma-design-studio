import { isRecord } from '../shared/errors.ts';

// Adapt unambiguous model spellings at the model boundary. Project validation
// remains strict, including ranges, token types, conflicting bindings and IDs.
/**
 * 只修正模型输出中无歧义的字段写法，保留严格校验对错误数据的拦截。
 *
 * @param result - 上一步操作得到的结果。
 * @returns 字段写法规范化后的设计对象。
 */
export function normalizeGeneratedDesign(result: Record<string, unknown>) {
  // 页面和组件共用相同的字体粗细及 Token 别名规范化规则。
  const normalizeEntries = (entries: unknown): unknown =>
    !Array.isArray(entries)
      ? entries
      : entries.map((entry) => {
          if (!isRecord(entry) || !Array.isArray(entry.nodes)) return entry;
          return {
            ...entry,
            nodes: entry.nodes.map((value) => {
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
            }),
          };
        });
  return {
    ...result,
    pages: normalizeEntries(result.pages),
    components: normalizeEntries(result.components),
  };
}
