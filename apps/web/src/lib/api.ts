/**
 * 统一请求 API 并转换失败响应，使调用方只处理业务数据。
 *
 * @param path - 文件路径或矢量路径内容，具体格式由所属对象约定。
 * @param body - 请求正文或文档内容。
 * @param method - HTTP 请求方法。
 * @returns 解析后的 API 响应。
 */
export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(
    /** 处理 api 中的异步失败，按当前流程决定回退或继续抛出。 @returns 当前步骤的处理结果。 */
    () => ({ error: `服务请求失败 (${response.status})` }),
  );
  if (!response.ok) throw new Error(result.error || `请求失败 (${response.status})`);
  return result as T;
}

/**
 * 把设计数据序列化为 JSON 下载，供备份或后续导入使用。
 *
 * @param name - 面向用户展示的名称。
 * @param data - 当前操作处理的数据。
 * @returns 无返回值；触发浏览器下载。
 */
export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(
    /** 基于最新状态计算 Timeout 的下一份值，避免连续更新时读到旧状态。 @returns 供 React 保存的新状态。 */
    () => URL.revokeObjectURL(url),
    1000,
  );
}
