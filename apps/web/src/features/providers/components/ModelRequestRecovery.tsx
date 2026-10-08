import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, RefreshCw } from 'lucide-react';
import type { ModelRequestDiagnostic, ProviderModelCatalog, ProviderSettings } from '@forma/schema';
import type { AgentMessage } from '@forma/schema/agent';
import { Button } from '@forma/ui/button';
import { api } from '../../../shared/api/client';
import '../styles/model-request-recovery.css';

export function messageModelDiagnostic(message: AgentMessage, settings: ProviderSettings) {
  if (message.errorDetails)
    return {
      ...message.errorDetails,
      operation:
        message.errorDetails.operation ||
        (message.actions?.some((action) => action.type === 'reconstruct_design')
          ? 'reconstruction'
          : undefined),
    } satisfies ModelRequestDiagnostic;
  if (message.status !== 'failed' || !message.content.includes('本地 Agent 请求失败')) return;
  const model = /The ['"]([^'"]+)['"] model is not supported/i.exec(message.content)?.[1];
  if (!model) return;
  // Older sessions did not store a provider ID; only a unique Codex connection can be inferred.
  const providers = settings.providers.filter(
    (provider) => provider.localAgent?.agentId === 'codex',
  );
  const provider = providers.length === 1 ? providers[0] : undefined;
  return {
    id: `legacy-${message.id}`,
    code: 'model_unavailable',
    providerId: provider?.id || '',
    providerName: provider?.name || 'Codex · 历史连接',
    model,
    channel: 'text',
    upstreamStatus: /"status"\s*:\s*400/.test(message.content) ? 400 : undefined,
    localAgentId: 'codex',
    occurredAt: message.createdAt,
    detail: message.content,
  } satisfies ModelRequestDiagnostic;
}

export function ModelRequestRecovery({
  diagnostic,
  settings,
  onSettings,
  onManage,
  disabled = false,
  autoLoad = true,
}: {
  diagnostic: ModelRequestDiagnostic;
  settings: ProviderSettings;
  onSettings: (settings: ProviderSettings) => void;
  onManage?: () => void;
  disabled?: boolean;
  autoLoad?: boolean;
}) {
  const timedOut =
    diagnostic.code === 'request_timeout' ||
    /本地 Agent 请求超过\s*\d+(?:\.\d+)?\s*秒/.test(diagnostic.detail);
  const failedTimeoutSeconds =
    diagnostic.timeoutMs !== undefined
      ? diagnostic.timeoutMs / 1000
      : Number(/本地 Agent 请求超过\s*(\d+(?:\.\d+)?)\s*秒/.exec(diagnostic.detail)?.[1]);
  const [catalog, setCatalog] = useState<ProviderModelCatalog>();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(autoLoad ? 1 : 0);
  const [saving, setSaving] = useState('');
  const [feedback, setFeedback] = useState('');
  const provider = settings.providers.find((item) => item.id === diagnostic.providerId);
  const unavailable = diagnostic.code === 'model_unavailable';
  const currentTimeout =
    diagnostic.operation === 'reconstruction'
      ? (provider?.localAgent?.reconstructionTimeoutMs ?? 600000)
      : provider?.timeoutMs;
  const channel =
    diagnostic.channel === 'image' &&
    settings.imageFollowsText &&
    settings.effectiveImage?.providerId === diagnostic.providerId
      ? 'text'
      : diagnostic.channel;
  const binding = settings[channel];
  const connectionChanged = binding.providerId !== diagnostic.providerId;
  const models = catalog?.models.filter((model) => model.id !== 'default') || [];
  useEffect(() => {
    if (!revision || !provider || timedOut) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    setCatalog(undefined);
    void fetch(`/api/providers/${encodeURIComponent(provider.id)}/models`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '读取模型列表失败。');
        if (!controller.signal.aborted) setCatalog(result);
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [diagnostic.id, provider?.id, revision, timedOut]);
  const switchModel = async (model: string) => {
    if (!provider || disabled || connectionChanged) return;
    setSaving(model);
    setFeedback('');
    try {
      const updated = await api<ProviderSettings>('/settings/models', {
        [channel]: { providerId: provider.id, model },
      });
      onSettings(updated);
      setFeedback(`已切换到 ${model}，可重新发送消息。`);
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setSaving('');
    }
  };
  return (
    <section className="mr-recovery" aria-label="模型请求排查">
      <header className="mr-header">
        <span className="mr-icon">
          <AlertTriangle size={16} aria-hidden="true" />
        </span>
        <strong>
          {timedOut
            ? '任务等待超时'
            : unavailable
              ? '模型不可用'
              : diagnostic.code === 'invalid_request'
                ? '模型请求未被接受'
                : '模型连接需要检查'}
        </strong>
        {diagnostic.upstreamStatus && (
          <span className="mr-status">HTTP {diagnostic.upstreamStatus}</span>
        )}
      </header>
      <p className="mr-description">
        {timedOut
          ? diagnostic.operation === 'reconstruction'
            ? '参考图分析未在等待上限内完成。已确认的设计图会保留，可调整等待时间或思考强度后重试还原。'
            : '任务未在等待上限内完成。请检查连接、等待时间和思考强度，再重试当前任务。'
          : unavailable
            ? `请求时，${diagnostic.localAgentId ? 'CLI 或账号' : '供应商或账号'}未接受这个模型。可从最新列表直接切换，再重试。`
            : diagnostic.upstreamStatus === 400
              ? '400 表示请求未被接受，可能与模型、参数或权限有关。先核对模型，再按原始错误排查。'
              : diagnostic.detail}
      </p>
      {diagnostic.code === 'invalid_request' && (
        <p className="mr-notice mr-error">{diagnostic.detail.slice(0, 300)}</p>
      )}
      <dl className="mr-context">
        <div>
          <dt>出错连接</dt>
          <dd>{diagnostic.providerName}</dd>
        </div>
        <div>
          <dt>出错模型</dt>
          <dd>
            <code>
              {diagnostic.model === 'default' ? 'default · CLI 配置的默认模型' : diagnostic.model}
            </code>
          </dd>
        </div>
      </dl>
      {timedOut && provider && (
        <div className="mr-notice" role="status">
          {Number.isFinite(failedTimeoutSeconds) && (
            <p>此次请求达到 {failedTimeoutSeconds} 秒上限。</p>
          )}
          <p>
            当前{diagnostic.operation === 'reconstruction' ? '还原' : '请求'}等待上限：
            {(currentTimeout || 180000) / 1000} 秒。
          </p>
          {provider.localAgent?.agentId === 'codex' && (
            <p>
              当前思考强度：
              {provider.localAgent.reasoningEffort === 'default'
                ? '沿用 CLI 配置'
                : provider.localAgent.reasoningEffort || 'medium'}
              。可在连接设置中选择标准（medium）或快速（low）。
            </p>
          )}
        </div>
      )}
      {!timedOut && (
        <>
          <div className="mr-catalog-heading">
            <strong>可选模型{models.length ? ` · ${models.length}` : ''}</strong>
            {provider && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={() => setRevision((value) => value + 1)}
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                {loading ? '读取中…' : catalog ? '刷新列表' : '读取列表'}
              </Button>
            )}
          </div>
          {catalog?.agent?.version && (
            <p className="mr-source">来自当前 CLI · {catalog.agent.version}</p>
          )}
          {loading && (
            <p className="mr-notice" role="status">
              正在读取当前连接的模型列表…
            </p>
          )}
          {loadError && (
            <p className="mr-notice mr-error" role="alert">
              {loadError}
            </p>
          )}
          {!provider && (
            <p className="mr-notice">原连接已删除或无法识别，请在模型连接设置中选择当前连接。</p>
          )}
          {connectionChanged && provider && (
            <p className="mr-notice">
              当前已使用其他连接。此处保留原错误记录，请到模型设置调整当前连接。
            </p>
          )}
          {!!models.length && (
            <ul className="mr-model-list">
              {models.map((model) => (
                <li key={model.id}>
                  <span>
                    <code title={model.id}>{model.id}</code>
                    {model.isDefault && <small>CLI 推荐</small>}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      disabled || !!saving || connectionChanged || binding.model === model.id
                    }
                    onClick={() => void switchModel(model.id)}
                    aria-label={`切换到 ${model.id}`}
                  >
                    {binding.model === model.id && !connectionChanged ? (
                      <>
                        <Check size={12} />
                        已选
                      </>
                    ) : saving === model.id ? (
                      '切换中…'
                    ) : (
                      '切换'
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {catalog && !loading && !models.length && (
            <p className="mr-notice">
              {catalog.source === 'default-only'
                ? '此 CLI 尚未提供可查询的模型目录。请在终端确认可用模型，再到模型设置填写 ID。'
                : '当前连接没有返回可选模型。请检查 CLI 登录状态、版本或账号权限后刷新。'}
            </p>
          )}
          {catalog && !!models.length && catalog.source !== 'cli' && (
            <p className="mr-source">列表由当前供应商返回，请选择支持本次任务的模型。</p>
          )}
        </>
      )}
      {feedback && (
        <p className="mr-notice" role="status">
          {feedback}
        </p>
      )}
      <details className="mr-help">
        <summary>还没解决？查看排查步骤</summary>
        {timedOut ? (
          <ol>
            <li>检查 CLI 登录与网络连接，确认服务能正常响应简单对话。</li>
            <li>在模型连接中调整等待上限，Codex 可选择标准或快速思考强度。</li>
            <li>
              {diagnostic.operation === 'reconstruction'
                ? '重新执行还原；已保存的设计图和素材会继续复用。'
                : '重新发送消息或执行当前任务。'}
            </li>
          </ol>
        ) : (
          <ol>
            <li>确认当前账号已登录，所选模型出现在上方列表中。</li>
            <li>
              {diagnostic.localAgentId === 'codex'
                ? '如果缺少预期模型，检查 codex --version，更新 CLI 后刷新列表。'
                : '核对模型 ID、账号权限、请求参数和连接地址。'}
            </li>
            <li>切换后重新发送消息；仍失败时，复制下方错误记录用于排查。</li>
          </ol>
        )}
        {diagnostic.localAgentId === 'codex' && !timedOut && (
          <div className="mr-command">
            <code>npm install -g @openai/codex@latest</code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="复制 Codex 更新命令"
              onClick={() =>
                navigator.clipboard
                  .writeText('npm install -g @openai/codex@latest')
                  .then(() => setFeedback('更新命令已复制，请在终端执行后刷新列表。'))
                  .catch(() => setFeedback('无法访问剪贴板，请手动复制命令。'))
              }
            >
              <Copy size={13} />
            </Button>
          </div>
        )}
      </details>
      <details className="mr-details">
        <summary>
          错误记录 · {new Date(diagnostic.occurredAt).toLocaleString('zh-CN', { hour12: false })}
        </summary>
        <pre>{diagnostic.detail}</pre>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            navigator.clipboard
              .writeText(JSON.stringify(diagnostic, null, 2))
              .then(() => setFeedback('错误记录已复制。'))
              .catch(() => setFeedback('无法访问剪贴板。'))
          }
        >
          <Copy size={12} />
          复制错误记录
        </Button>
      </details>
      {onManage &&
        (timedOut ||
          !provider ||
          connectionChanged ||
          loadError ||
          catalog?.source === 'default-only') && (
          <Button type="button" variant="ghost" size="sm" onClick={onManage}>
            打开模型连接设置
          </Button>
        )}
    </section>
  );
}
