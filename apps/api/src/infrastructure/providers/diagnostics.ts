import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ModelRequestDiagnostic } from '@forma/schema';
import type { PrivateProvider } from './settings.ts';
import { ApiError } from '../../shared/errors.ts';
import { dataRoot, readJson, writeJson } from '../storage/store.ts';

const file = path.join(dataRoot, 'model-request-errors.json');
let recording = Promise.resolve();

export async function modelRequestError(
  provider: PrivateProvider,
  model: string,
  channel: 'text' | 'image',
  detail: string,
  upstreamStatus?: number,
  upstreamCode?: string,
  context?: Pick<ModelRequestDiagnostic, 'operation' | 'timeoutMs'>,
) {
  let safeDetail = detail;
  for (const secret of [provider.apiKey, ...Object.values(provider.headers)].filter(Boolean))
    safeDetail = safeDetail.replaceAll(secret, '[REDACTED]');
  safeDetail = safeDetail.slice(0, 2000);
  const timedOut =
    upstreamCode === 'local_timeout' || /本地 Agent 请求超过\s*\d+(?:\.\d+)?\s*秒/.test(safeDetail);
  const unavailable =
    [
      'model_not_found',
      'model_not_supported',
      'unsupported_model',
      'invalid_model',
      'model_access_denied',
    ].includes(upstreamCode || '') ||
    /model[_ -]not[_ -]found|\bmodel(?:\s+(?:['"`][^'"`\n]{1,120}['"`]|[\w.-]+))?\s+(?:is\s+|was\s+)?(?:not supported|not available|does not exist|not found|do not have access|don't have access|unsupported)|(?:unsupported|unknown|invalid|unavailable) (?:model|model id)|(?:do not|don't) have access to (?:the )?model|模型(?:不可用|不存在|未找到|无权限)|(?:不支持|未知|无效)(?:的)?模型/i.test(
      safeDetail,
    );
  const errorDetails: ModelRequestDiagnostic = {
    id: randomUUID(),
    code: timedOut
      ? 'request_timeout'
      : unavailable
        ? 'model_unavailable'
        : upstreamStatus === 400
          ? 'invalid_request'
          : 'request_failed',
    providerId: provider.id,
    providerName: provider.name,
    model,
    channel,
    upstreamStatus,
    upstreamCode,
    localAgentId: provider.localAgent?.agentId,
    occurredAt: new Date().toISOString(),
    detail: safeDetail,
    ...context,
  };
  // A separate queue avoids nesting the project transaction during a model failure.
  recording = recording
    .catch(() => {})
    .then(async () => {
      const records = await readJson<ModelRequestDiagnostic[]>(file, []);
      await writeJson(file, [...records.slice(-199), errorDetails]);
    });
  await recording.catch(() => console.error('无法保存模型错误记录。'));
  const message = safeDetail.startsWith('模型服务请求失败')
    ? safeDetail
    : `${provider.localAgent ? '本地 Agent' : '模型服务'}请求失败${upstreamStatus ? `（HTTP ${upstreamStatus}）` : ''}：${safeDetail}`;
  return new ApiError(502, message, errorDetails);
}
