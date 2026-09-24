import type {
  ApplyResult,
  ValidationReport,
  WorkspaceChangeSet,
  WorkspaceDocument,
  WorkspaceLocalState,
} from '@forma/schema/workbench';

/**
 * 发送当前模块的 JSON 请求，并将服务端失败转换为可展示错误。
 *
 * @param url - 资源或服务的访问地址。
 * @param init - 传给 fetch 的请求配置。
 * @returns 解析后的响应数据。
 */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json().catch(
    /** 处理 request 中的异步失败，按当前流程决定回退或继续抛出。 @returns 当前步骤的处理结果。 */
    () => ({ error: `请求失败 (${response.status})` }),
  );
  if (!response.ok) throw new Error(result.error || `请求失败 (${response.status})`);
  return result as T;
}

/**
 * 读取工作空间文档，作为流程画布与侧栏的共同数据源。
 * @returns 完整工作空间文档。
 */
export function getDocument() {
  return request<WorkspaceDocument>('/api/document');
}
/**
 * 读取工作空间校验报告，向用户展示缺失引用或格式问题。
 * @returns 校验报告。
 */
export function getValidation() {
  return request<ValidationReport>('/api/validation');
}
/**
 * 读取本机保存的视口偏好，恢复上次浏览位置。
 * @returns 本地工作空间状态。
 */
export function getLocalState() {
  return request<WorkspaceLocalState>('/api/local-state');
}
/**
 * 保存当前流程的本地视口，恢复浏览时使用同一缩放和位置。
 *
 * @param flowId - 目标流程的唯一标识。
 * @param viewport - 画布可见区域的尺寸或相机状态。
 * @returns 更新后的本地状态。
 */
export function setLocalViewport(
  flowId: string,
  viewport: {
    /** 水平方向的位置。 */
    x: number;
    /** 垂直方向的位置。 */
    y: number;
    /** 缩放倍率，1 表示原始尺寸。 */
    zoom: number;
  },
) {
  return request<WorkspaceLocalState>('/api/local-state/viewport', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, ...viewport }),
  });
}
/**
 * 提交带基线版本的工作空间操作，让服务端发现并发修改。
 *
 * @param changeSet - 携带基线版本的工作空间变更集。
 * @returns 包含新文档和修订号的提交结果。
 */
export function applyChanges(changeSet: WorkspaceChangeSet) {
  return request<ApplyResult>('/api/changes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changeSet),
  });
}

/**
 * 把设计素材路径转换为工作台服务地址，供浏览器加载图片。
 *
 * @param assetPath - 设计根目录内的图片素材相对路径。
 * @returns 浏览器可访问的素材 URL。
 */
export function assetUrl(assetPath: string) {
  return `/assets/${assetPath.split('/').map(encodeURIComponent).join('/')}`;
}
