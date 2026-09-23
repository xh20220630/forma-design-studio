import type {
  ApplyResult,
  ValidationReport,
  WorkspaceChangeSet,
  WorkspaceDocument,
  WorkspaceLocalState,
} from "@forma/schema/workbench";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response
    .json()
    .catch(() => ({ error: `请求失败 (${response.status})` }));
  if (!response.ok)
    throw new Error(result.error || `请求失败 (${response.status})`);
  return result as T;
}

export function getDocument() {
  return request<WorkspaceDocument>("/api/document");
}
export function getValidation() {
  return request<ValidationReport>("/api/validation");
}
export function getLocalState() {
  return request<WorkspaceLocalState>("/api/local-state");
}
export function setLocalViewport(
  flowId: string,
  viewport: { x: number; y: number; zoom: number },
) {
  return request<WorkspaceLocalState>("/api/local-state/viewport", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flowId, ...viewport }),
  });
}
export function applyChanges(changeSet: WorkspaceChangeSet) {
  return request<ApplyResult>("/api/changes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changeSet),
  });
}

export function assetUrl(assetPath: string) {
  return `/assets/${assetPath.split("/").map(encodeURIComponent).join("/")}`;
}
