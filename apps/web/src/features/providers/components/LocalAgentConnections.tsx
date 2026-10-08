import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Terminal } from 'lucide-react';
import type {
  LocalAgentId,
  LocalAgentInfo,
  ModelProvider,
  ProviderSettings,
  ModelRequestDiagnostic,
} from '@forma/schema';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@forma/ui/select';
import Modal from '../../../shared/ui/Modal';
import { api } from '../../../shared/api/client';
import { ModelRequestRecovery } from './ModelRequestRecovery';

export function LocalAgentsPanel({ onConnect }: { onConnect: (agentId: LocalAgentId) => void }) {
  const [agents, setAgents] = useState<LocalAgentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void api<{ agents: LocalAgentInfo[] }>('/local-agents')
      .then((result) => {
        if (active) setAgents(result.agents);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return (
    <section className="wf-panel">
      <header className="pc-heading">
        <div>
          <h2>
            <Terminal size={17} aria-hidden="true" /> 本地 Agent
          </h2>
          <p>连接本机已安装的 AI CLI，沿用 CLI 的登录与模型配置。</p>
        </div>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? '检测中…' : '重新检测'}
        </Button>
      </header>
      <div className="pc-providers">
        {error && (
          <p role="alert" className="pc-error">
            {error}
          </p>
        )}
        {loading && !agents.length && (
          <p className="pc-empty" role="status">
            正在检测 Codex、Claude Code 和 Kimi…
          </p>
        )}
        {agents.map((agent) => (
          <article className="pc-provider" key={agent.id}>
            <div>
              <h3>{agent.name}</h3>
              <p title={agent.executable}>
                {agent.available
                  ? agent.version || 'CLI 已就绪'
                  : agent.installed
                    ? agent.error
                    : '未检测到，请安装 CLI 并加入 PATH'}
              </p>
              {agent.executable && <p title={agent.executable}>{agent.executable}</p>}
              <div className="pc-tags">
                <span>{agent.available ? '已安装' : agent.installed ? '检测失败' : '未安装'}</span>
                <span>{agent.transport === 'acp' ? 'ACP' : '标准输入 / 输出'}</span>
                {agent.id === 'codex' && <span>内置生图</span>}
              </div>
            </div>
            <Button
              variant="outline"
              disabled={loading || !agent.available}
              onClick={() => onConnect(agent.id)}
            >
              添加连接
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LocalAgentEditor({
  provider,
  agentId,
  settings,
  onSettings,
  onClose,
}: {
  provider?: ModelProvider;
  agentId?: LocalAgentId;
  settings: ProviderSettings;
  onSettings: (settings: ProviderSettings) => void;
  onClose: () => void;
}) {
  const selectedAgent = provider?.localAgent?.agentId || agentId || 'codex';
  const [name, setName] = useState(
    provider?.name ||
      `${selectedAgent === 'claude' ? 'Claude Code' : selectedAgent === 'kimi' ? 'Kimi Code' : 'Codex'} · 本地连接`,
  );
  const [timeoutMs, setTimeoutMs] = useState(provider?.timeoutMs || 180000);
  const [reconstructionTimeoutMs, setReconstructionTimeoutMs] = useState(
    provider?.localAgent?.reconstructionTimeoutMs ?? 600000,
  );
  const [reasoningEffort, setReasoningEffort] = useState<
    NonNullable<ModelProvider['localAgent']>['reasoningEffort']
  >(provider?.localAgent?.reasoningEffort ?? 'medium');
  const [useForText, setUseForText] = useState(!provider);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState({ error: false, message: '' });
  const [diagnostic, setDiagnostic] = useState<ModelRequestDiagnostic>();
  const testController = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => testController.current?.abort(), []);
  const payload = {
    name,
    textProtocol: 'local-agent',
    imageProtocol: selectedAgent === 'codex' ? 'local-agent' : 'none',
    auth: 'none',
    localAgent: {
      agentId: selectedAgent,
      reconstructionTimeoutMs,
      ...(selectedAgent === 'codex' ? { reasoningEffort } : {}),
    },
    timeoutMs,
  };
  const probe = async () => {
    setBusy('probe');
    setFeedback({ error: false, message: '' });
    try {
      const result = await api<{ latencyMs: number }>('/providers/probe', {
        ...payload,
        id: provider?.id,
      });
      setFeedback({
        error: false,
        message: `CLI 可启动，检测耗时 ${result.latencyMs} ms。登录与模型可用性请通过测试对话验证。`,
      });
    } catch (error) {
      setFeedback({ error: true, message: (error as Error).message });
    } finally {
      setBusy('');
    }
  };
  const test = async () => {
    if (!provider) return;
    const controller = new AbortController();
    testController.current = controller;
    setBusy('test');
    setDiagnostic(undefined);
    setFeedback({ error: false, message: '正在使用已保存的连接发送测试消息…' });
    try {
      const response = await fetch('/api/providers/local-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provider.id }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) {
        setDiagnostic(result.errorDetails);
        throw new Error(result.error || '测试失败。');
      }
      setFeedback({
        error: false,
        message: `${result.text}（${(result.latencyMs / 1000).toFixed(1)} 秒）`,
      });
    } catch (error) {
      setFeedback({
        error: true,
        message: controller.signal.aborted ? '测试对话已取消。' : (error as Error).message,
      });
    } finally {
      setBusy('');
      testController.current = undefined;
    }
  };
  return (
    <Modal
      title={provider ? '编辑本地连接' : '添加本地连接'}
      subtitle="通过本机 CLI 与设计 AI 通信。"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="pc-editor"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy('save');
          setFeedback({ error: false, message: '' });
          try {
            let settings = await api<ProviderSettings>(
              provider ? `/providers/${encodeURIComponent(provider.id)}` : '/providers',
              payload,
              provider ? 'PUT' : 'POST',
            );
            onSettings(settings);
            if (useForText) {
              const saved = provider
                ? settings.providers.find((item) => item.id === provider.id)
                : settings.providers.at(-1);
              if (saved)
                settings = await api<ProviderSettings>('/settings/models', {
                  text: { providerId: saved.id, model: 'default' },
                });
              onSettings(settings);
            }
            onClose();
          } catch (error) {
            setFeedback({ error: true, message: (error as Error).message });
          } finally {
            setBusy('');
          }
        }}
      >
        <fieldset disabled={!!busy}>
          <label>
            Agent
            <Input
              value={
                selectedAgent === 'claude'
                  ? 'Claude Code'
                  : selectedAgent === 'kimi'
                    ? 'Kimi Code'
                    : 'Codex'
              }
              readOnly
            />
          </label>
          <label>
            连接名称
            <Input required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            对话 / 生图超时（秒）
            <Input
              type="number"
              min={1}
              max={600}
              required
              value={timeoutMs / 1000}
              onChange={(event) => setTimeoutMs(Number(event.target.value) * 1000)}
            />
          </label>
          <label>
            设计图还原超时（秒）
            <Input
              type="number"
              min={1}
              max={600}
              required
              value={reconstructionTimeoutMs / 1000}
              onChange={(event) => setReconstructionTimeoutMs(Number(event.target.value) * 1000)}
            />
            <small>复杂参考图需要更长的视觉分析时间，默认等待最多 10 分钟。</small>
          </label>
          {selectedAgent === 'codex' && (
            <label>
              思考强度
              <Select
                value={reasoningEffort}
                onValueChange={(value) => setReasoningEffort(value as typeof reasoningEffort)}
              >
                <SelectTrigger aria-label="Codex 思考强度">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medium">标准 · medium（推荐）</SelectItem>
                  <SelectItem value="low">快速 · low</SelectItem>
                  <SelectItem value="high">深入 · high</SelectItem>
                  <SelectItem value="xhigh">最高 · xhigh</SelectItem>
                  <SelectItem value="default">使用 CLI 配置</SelectItem>
                </SelectContent>
              </Select>
              <small>仅作用于此网页连接的对话与视觉分析。更高的强度通常需要更长等待。</small>
            </label>
          )}
          <p className="pc-hint">
            请先在终端完成该 CLI 的登录。模型 ID 填写 default 时使用 CLI
            默认模型，也可手动指定。支持对话、主题生成与图片输入；图片理解能力取决于所选模型。
            {selectedAgent === 'codex'
              ? 'Codex 可调用内置生图，沿用 CLI 登录与额度，无需另配生图模型或 API Key。未配置独立生图连接时会自动复用当前 Codex。'
              : '生图需要选择 Codex 内置生图或独立生图连接。'}
          </p>
          <label className="pc-check">
            <input
              type="checkbox"
              checked={useForText}
              onChange={(event) => setUseForText(event.target.checked)}
            />
            保存后用于文本 / 视觉任务
          </label>
          {provider && (
            <div>
              <Button type="button" variant="outline" onClick={() => void test()}>
                测试对话
              </Button>
              <small> 使用已保存的连接发送一次消息，会消耗 CLI 模型额度。</small>
            </div>
          )}
          {feedback.message && !diagnostic && (
            <p
              className={feedback.error ? 'pc-error' : 'pc-hint'}
              role={feedback.error ? 'alert' : 'status'}
            >
              {feedback.message}
            </p>
          )}
          {diagnostic && (
            <ModelRequestRecovery
              diagnostic={diagnostic}
              settings={settings}
              onSettings={onSettings}
              disabled={!!busy}
            />
          )}
          <footer className="pc-footer">
            <Button type="button" variant="outline" onClick={() => void probe()}>
              检测 CLI
            </Button>
            <Button type="submit">{busy === 'save' ? '保存中…' : '保存本地连接'}</Button>
          </footer>
        </fieldset>
        {busy === 'test' && (
          <Button type="button" variant="outline" onClick={() => testController.current?.abort()}>
            取消测试
          </Button>
        )}
      </form>
    </Modal>
  );
}
