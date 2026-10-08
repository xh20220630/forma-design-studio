import { useEffect, useId, useState } from 'react';
import { Check, Plus, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import type {
  ImageProtocol,
  LocalAgentId,
  ModelBinding,
  ModelProvider,
  ProviderModel,
  ProviderSettings,
  TextProtocol,
} from '@forma/schema';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';
import { Textarea } from '@forma/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@forma/ui/select';
import { api } from '../../../shared/api/client';
import Modal from '../../../shared/ui/Modal';
import { LocalAgentEditor, LocalAgentsPanel } from './LocalAgentConnections';
import '../styles/provider-connections.css';

/** 集中维护 textProtocols 的约定值或当前状态，供相关分支保持一致。 */
const textProtocols: [TextProtocol, string][] = [
  ['openai', 'OpenAI 兼容 · Chat Completions'],
  ['openai-responses', 'OpenAI Responses'],
  ['anthropic', 'Claude / Anthropic'],
  ['gemini', 'Google Gemini'],
  ['local-agent', '本地 Agent CLI'],
  ['none', '不提供文本服务'],
];
/** 集中维护 imageProtocols 的约定值或当前状态，供相关分支保持一致。 */
const imageProtocols: [ImageProtocol, string][] = [
  ['openai-images', 'OpenAI 兼容 · Images'],
  ['gemini', 'Gemini 生图'],
  ['imagen', 'Google Imagen'],
  ['local-agent', 'Codex 内置生图'],
  ['none', '不提供生图服务'],
];
const presets = [
  {
    name: '自定义供应商',
    baseUrl: '',
    textProtocol: 'openai',
    imageProtocol: 'openai-images',
    auth: 'auto',
  },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    textProtocol: 'openai-responses',
    imageProtocol: 'openai-images',
    auth: 'auto',
  },
  {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    textProtocol: 'anthropic',
    imageProtocol: 'none',
    auth: 'auto',
  },
  {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    textProtocol: 'gemini',
    imageProtocol: 'gemini',
    auth: 'auto',
  },
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    textProtocol: 'openai',
    imageProtocol: 'none',
    auth: 'auto',
  },
  {
    name: 'Ollama / 本地服务',
    baseUrl: 'http://localhost:11434/v1',
    textProtocol: 'openai',
    imageProtocol: 'none',
    auth: 'none',
  },
] as const;
/**
 * 呈现选项选择控件，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.value - 当前字段、模式或控件的取值。
 * @param props.onChange - 在值变化时通知调用方，由外层决定如何更新业务状态。
 * @param props.options - 本次操作的配置选项。
 * @param props.label - 面向用户显示的简短标签。
 * @param props.disabled - 是否禁止用户操作。
 * @returns 供 React 渲染的界面内容。
 */
function Choice({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  /** 当前字段、模式或控件的取值。 */
  value: string;
  /**
   * 在值变化时通知调用方，由外层决定如何更新业务状态。
   * @param value - 当前字段、模式或控件的取值。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onChange: (value: string) => void;
  /** 本次操作的配置选项。 */
  options: readonly (readonly [string, string])[];
  /** 面向用户显示的简短标签。 */
  label: string;
  /** 是否禁止用户操作。 */
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([id, name]) => (
          <SelectItem key={id} value={id}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
/**
 * 呈现模型选择字段，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.channel - 文字或图片任务通道。
 * @param props.settings - 当前生效的设置。
 * @param props.value - 当前字段、模式或控件的取值。
 * @param props.onChange - 在值变化时通知调用方，由外层决定如何更新业务状态。
 * @param props.disabled - 是否禁止用户操作。
 * @returns 供 React 渲染的界面内容。
 */
function ModelField({
  channel,
  settings,
  value,
  onChange,
  disabled,
}: {
  /** 文字或图片任务通道。取值：text（文字）、image（图片）。 */
  channel: 'text' | 'image';
  /** 当前生效的设置。 */
  settings: ProviderSettings;
  /** 当前字段、模式或控件的取值。 */
  value: ModelBinding;
  /**
   * 在值变化时通知调用方，由外层决定如何更新业务状态。
   * @param binding - 当前属性或模型使用的绑定关系。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onChange: (binding: ModelBinding) => void;
  /** 是否禁止用户操作。 */
  disabled: boolean;
}) {
  const listId = useId();
  /** 界面状态：按供应商保存的模型列表缓存。通过状态更新驱动界面刷新。 */
  const [catalogs, setCatalogs] = useState<Record<string, ProviderModel[]>>({});
  /** 界面状态：是否正在等待异步数据。通过状态更新驱动界面刷新。 */
  const [loading, setLoading] = useState('');
  /** 界面状态：连接操作的即时反馈。通过状态更新驱动界面刷新。 */
  const [feedback, setFeedback] = useState({
    id: '',
    message: '',
    error: false,
  });
  const title = channel === 'text' ? '文本 / 视觉模型' : '图片生成模型';
  const providers = settings.providers.filter(
    (p) => p[channel === 'text' ? 'textProtocol' : 'imageProtocol'] !== 'none',
  );
  const fetchModels = async () => {
    const id = value.providerId;
    setLoading(id);
    setFeedback({ id, message: '', error: false });
    try {
      const result = await api<{
        /** 供应商提供的模型选项。 */
        models: ProviderModel[];
      }>(`/providers/${encodeURIComponent(id)}/models`);
      setCatalogs((old) => ({ ...old, [id]: result.models }));
      setFeedback({
        id,
        message: `已获取 ${result.models.length} 个模型，请选择支持${channel === 'text' ? '文本 / 视觉' : '生图'}的模型。`,
        error: false,
      });
    } catch (error) {
      setFeedback({
        id,
        message: `${(error as Error).message} 可手动填写模型 ID。`,
        error: true,
      });
    } finally {
      setLoading('');
    }
  };
  const models = catalogs[value.providerId] || [];
  const isLocal =
    providers.find((provider) => provider.id === value.providerId)?.textProtocol === 'local-agent';
  const automaticCodex =
    channel === 'image'
      ? settings.providers.find(
          (provider) =>
            provider.id === settings.text.providerId && provider.imageProtocol === 'local-agent',
        )
      : undefined;
  const isBuiltinImage =
    channel === 'image' && (isLocal || (!!automaticCodex && !value.providerId));
  return (
    <section className="pc-model-field">
      <h3>{title}</h3>
      <p>
        {channel === 'text'
          ? '用于对话、主题生成与设计图还原；还原需要视觉能力。'
          : '用于生成 UI 设计图和素材。Codex 可直接调用内置生图，也可选择独立供应商。'}
      </p>
      <label>
        服务供应商
        <Choice
          label={`${title}供应商`}
          value={value.providerId || '__none'}
          disabled={disabled || !!loading}
          options={[
            ['__none', automaticCodex ? '自动复用当前 Codex · 内置生图' : '暂不配置'],
            ...providers.map((p) => [p.id, p.name] as const),
          ]}
          onChange={(id) =>
            onChange({
              providerId: id === '__none' ? '' : id,
              model:
                providers.find((provider) => provider.id === id)?.textProtocol === 'local-agent'
                  ? channel === 'image' && id === settings.text.providerId
                    ? settings.text.model || 'default'
                    : 'default'
                  : '',
            })
          }
        />
      </label>
      {automaticCodex && !value.providerId && (
        <p className="pc-builtin-image" role="status">
          <Check size={16} aria-hidden="true" />
          <span>
            已自动启用 {automaticCodex.name} 的内置生图。沿用 CLI 登录与额度，无需配置生图模型或 API
            Key。
          </span>
        </p>
      )}
      {isBuiltinImage && value.providerId && (
        <p className="pc-builtin-image">
          <Check size={16} aria-hidden="true" />
          <span>
            使用 Codex 内置生图，无需另选生图模型。调度模型：{value.model || 'default'}
            ；图片由内置工具生成。
          </span>
        </p>
      )}
      {!isBuiltinImage && (
        <>
          <label>
            模型 ID
            <div className="pc-model-input">
              <Input
                aria-label={`${title} ID`}
                list={listId}
                value={value.model}
                disabled={disabled || !value.providerId}
                placeholder={isLocal ? 'default 使用 CLI 默认模型' : '选择或输入上游模型 ID'}
                onChange={(event) => onChange({ ...value, model: event.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                disabled={disabled || !value.providerId || !!loading}
                onClick={() => void fetchModels()}
                title={isLocal ? '读取当前 CLI 的模型列表' : '从上游获取模型列表'}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                获取模型
              </Button>
            </div>
          </label>
          <datalist id={listId}>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </datalist>
          {models.length > 0 && (
            <Choice
              label={`${title}上游列表`}
              value={models.some((m) => m.id === value.model) ? value.model : '__choose'}
              disabled={disabled}
              onChange={(model) => {
                if (model !== '__choose') onChange({ ...value, model });
              }}
              options={[
                ['__choose', `从 ${models.length} 个上游模型中选择`],
                ...models.map(
                  (m) => [m.id, m.name === m.id ? m.id : `${m.name} · ${m.id}`] as const,
                ),
              ]}
            />
          )}
          {feedback.id === value.providerId && feedback.message && (
            <p
              className={feedback.error ? 'pc-error' : 'pc-hint'}
              role={feedback.error ? 'alert' : 'status'}
            >
              {feedback.message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
/**
 * 呈现模型任务绑定，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.settings - 当前生效的设置。
 * @param props.onSettings - 在设置时通知调用方，由外层决定如何更新业务状态。
 * @param props.onDone - 在完成时通知调用方，由外层决定如何更新业务状态。
 * @param props.quick - 是否采用快捷操作路径。
 * @returns 供 React 渲染的界面内容。
 */
function Bindings({
  settings,
  onSettings,
  onDone,
  quick = false,
}: {
  /** 当前生效的设置。 */
  settings: ProviderSettings;
  /**
   * 在设置时通知调用方，由外层决定如何更新业务状态。
   * @param value - 当前字段、模式或控件的取值。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSettings: (value: ProviderSettings) => void;
  /**
   * 在完成时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onDone?: () => void;
  /** 是否采用快捷操作路径。 */
  quick?: boolean;
}) {
  /** 界面状态：需要展示或编辑的文字内容。通过状态更新驱动界面刷新。 */
  const [text, setText] = useState(settings.text);
  /** 界面状态：图片数据、图片模型绑定或页面图片节点。通过状态更新驱动界面刷新。 */
  const [image, setImage] = useState(
    settings.imageFollowsText ? { providerId: '', model: '' } : settings.image,
  );
  /** 界面状态：是否有操作进行中，用于阻止重复提交。通过状态更新驱动界面刷新。 */
  const [busy, setBusy] = useState(false);
  /** 界面状态：连接操作的即时反馈。通过状态更新驱动界面刷新。 */
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    const available = (value: ModelBinding, channel: 'textProtocol' | 'imageProtocol') =>
      !value.providerId ||
      settings.providers.some((p) => p.id === value.providerId && p[channel] !== 'none');
    setText((value) => (available(value, 'textProtocol') ? value : { providerId: '', model: '' }));
    setImage((value) =>
      available(value, 'imageProtocol') ? value : { providerId: '', model: '' },
    );
  }, [settings.providers]);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setFeedback('');
        try {
          onSettings(await api<ProviderSettings>('/settings/models', { text, image }));
          setFeedback('模型选择已保存，将用于接下来的请求。');
          onDone?.();
        } catch (error) {
          setFeedback((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="pc-models">
        <ModelField
          channel="text"
          settings={settings}
          value={text}
          onChange={setText}
          disabled={busy}
        />
        <ModelField
          channel="image"
          settings={{ ...settings, text }}
          value={image}
          onChange={setImage}
          disabled={busy}
        />
      </div>
      {feedback && (
        <p className="pc-feedback" role="status">
          {feedback}
        </p>
      )}
      <footer className="pc-footer">
        <span>保存后用于接下来的请求</span>
        <Button type="submit" disabled={busy}>
          <Check size={14} />
          {busy ? '保存中…' : quick ? '应用模型' : '保存模型选择'}
        </Button>
      </footer>
    </form>
  );
}
/**
 * 把供应商与模型组合为稳定选项值，避免不同供应商的同名模型冲突。
 *
 * @param settings - 当前生效的设置。
 * @returns 绑定的唯一选项键。
 */
const bindingKey = (settings: ProviderSettings) =>
  JSON.stringify([
    settings.text,
    settings.image,
    settings.effectiveImage,
    settings.imageFollowsText,
  ]);
/**
 * 呈现模型切换入口，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.settings - 当前生效的设置。
 * @param props.onSettings - 在设置时通知调用方，由外层决定如何更新业务状态。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @param props.onManage - 在管理入口时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function ModelSwitcher({
  settings,
  onSettings,
  onClose,
  onManage,
}: {
  /** 当前生效的设置。 */
  settings: ProviderSettings;
  /**
   * 在设置时通知调用方，由外层决定如何更新业务状态。
   * @param value - 当前字段、模式或控件的取值。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSettings: (value: ProviderSettings) => void;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
  /**
   * 在管理入口时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onManage: () => void;
}) {
  return (
    <Modal
      title="更换模型"
      subtitle="选择任务连接，Codex 可直接使用内置生图。"
      wide
      onClose={onClose}
    >
      <div className="pc-switcher">
        <Bindings
          key={bindingKey(settings)}
          settings={settings}
          onSettings={onSettings}
          onDone={onClose}
          quick
        />
        <Button variant="ghost" onClick={onManage}>
          <Settings2 size={14} />
          管理服务供应商
        </Button>
      </div>
    </Modal>
  );
}
/**
 * 呈现供应商配置编辑器，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.provider - 当前上游连接配置。
 * @param props.onSettings - 在设置时通知调用方，由外层决定如何更新业务状态。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
function ProviderEditor({
  provider,
  onSettings,
  onClose,
}: {
  /** 当前上游连接配置。 */
  provider?: ModelProvider;
  /**
   * 在设置时通知调用方，由外层决定如何更新业务状态。
   * @param value - 当前字段、模式或控件的取值。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSettings: (value: ProviderSettings) => void;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
}) {
  /** 界面状态：尚未提交的编辑内容或待组装的设计草稿。通过状态更新驱动界面刷新。 */
  const [draft, setDraft] = useState({
    ...presets[0],
    modelsPath: '',
    textPath: '',
    imagePath: '',
    timeoutMs: 180000,
    maxOutputTokens: 8192,
    jsonMode: true,
    imageSize: '',
    imageEditPath: '',
    ...provider,
  } as Omit<ModelProvider, 'id' | 'hasApiKey' | 'headerNames'>);
  const versionHint = (() => {
    const openaiText =
      ['openai', 'openai-responses'].includes(draft.textProtocol) && !draft.textPath;
    const openaiImage = draft.imageProtocol === 'openai-images' && !draft.imagePath;
    if (!openaiText && !openaiImage) return '';
    try {
      const base = new URL(draft.baseUrl);
      return base.pathname === '/' && !base.username && !base.password && !base.search && !base.hash
        ? `${base.origin}/v1`
        : '';
    } catch {
      return '';
    }
  })();
  /** 界面状态：服务端保存的供应商密钥，禁止作为公开配置返回。通过状态更新驱动界面刷新。 */
  const [apiKey, setApiKey] = useState('');
  /** 界面状态：是否明确删除已经保存的密钥；空输入本身不等同于清除。通过状态更新驱动界面刷新。 */
  const [clearApiKey, setClearApiKey] = useState(false);
  /** 界面状态：发给供应商的额外请求头，可能包含私密认证值。通过状态更新驱动界面刷新。 */
  const [headers, setHeaders] = useState('');
  /** 界面状态：是否有操作进行中，用于阻止重复提交。通过状态更新驱动界面刷新。 */
  const [busy, setBusy] = useState('');
  /** 界面状态：连接操作的即时反馈。通过状态更新驱动界面刷新。 */
  const [feedback, setFeedback] = useState({ error: false, message: '' });
  const update = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const perform = async (probe: boolean) => {
    setBusy(probe ? 'probe' : 'save');
    setFeedback({ error: false, message: '' });
    try {
      const payload = {
        ...draft,
        apiKey,
        clearApiKey,
        ...(headers.trim() ? { headers: JSON.parse(headers) } : {}),
      };
      if (probe) {
        const result = await api<{
          /** 供应商提供的模型选项。 */
          models: ProviderModel[];
          /** 请求耗时，单位为毫秒。 */
          latencyMs: number;
        }>('/providers/probe', { ...payload, id: provider?.id });
        setFeedback({
          error: false,
          message: `模型目录可访问 · ${result.models.length} 个模型 · ${result.latencyMs} ms。此检测仅访问模型目录，聊天和生图接口仍需使用正确的 API 路径。`,
        });
      } else {
        onSettings(
          await api<ProviderSettings>(
            provider ? `/providers/${encodeURIComponent(provider.id)}` : '/providers',
            payload,
            provider ? 'PUT' : 'POST',
          ),
        );
        onClose();
      }
    } catch (error) {
      setFeedback({
        error: true,
        message:
          (error as Error).message +
          (probe ? ' 若上游未提供模型目录，可保存后手动填写模型 ID。' : ''),
      });
    } finally {
      setBusy('');
    }
  };
  return (
    <Modal
      title={provider ? '编辑供应商' : '添加供应商'}
      subtitle="密钥保存在本地服务端；文本和生图协议可以分别指定。"
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="pc-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void perform(false);
        }}
      >
        <fieldset disabled={!!busy}>
          {!provider && (
            <label>
              快速开始
              <Choice
                label="供应商预设"
                value={presets.find((p) => p.name === draft.name)?.name || presets[0].name}
                options={presets.map((p) => [p.name, p.name])}
                onChange={(name) => {
                  const preset = presets.find((p) => p.name === name)!;
                  setDraft((old) => ({ ...old, ...preset }));
                }}
              />
            </label>
          )}
          <div className="pc-two">
            <label>
              供应商名称
              <Input required value={draft.name} onChange={(e) => update('name', e.target.value)} />
            </label>
            <label>
              认证方式
              <Choice
                label="认证方式"
                value={draft.auth}
                onChange={(value) => update('auth', value as typeof draft.auth)}
                options={[
                  ['auto', '按协议自动认证'],
                  ['none', '无需密钥 · 本地服务'],
                  ['bearer', 'Authorization: Bearer'],
                  ['api-key', 'api-key 请求头'],
                ]}
              />
            </label>
          </div>
          <label>
            API Base URL
            <Input
              aria-label="API Base URL"
              required
              type="url"
              value={draft.baseUrl}
              placeholder="https://api.example.com/v1"
              onChange={(e) => update('baseUrl', e.target.value)}
            />
            <small>填写包含 API 版本的基础地址；本机服务可使用 HTTP。</small>
            {versionHint && (
              <small className="pc-endpoint-hint">
                当前仅填写了域名。若供应商使用标准 OpenAI 路径，请填写 {versionHint}
                ；自定义接口以供应商文档为准。
              </small>
            )}
          </label>
          <label>
            API Key
            <Input
              aria-label="API Key"
              type="password"
              autoComplete="new-password"
              disabled={clearApiKey}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider?.hasApiKey ? '已保存密钥，留空保留' : '输入密钥；无需认证时可留空'
              }
            />
          </label>
          {provider?.hasApiKey && (
            <label className="pc-check">
              <input
                type="checkbox"
                checked={clearApiKey}
                onChange={(e) => {
                  setClearApiKey(e.target.checked);
                  setApiKey('');
                }}
              />
              清除已保存的密钥
            </label>
          )}
          <div className="pc-two">
            <label>
              文本协议
              <Choice
                label="文本协议"
                value={draft.textProtocol}
                options={textProtocols.filter(([id]) => id !== 'local-agent')}
                onChange={(v) => update('textProtocol', v as TextProtocol)}
              />
            </label>
            <label>
              生图协议
              <Choice
                label="生图协议"
                value={draft.imageProtocol}
                options={imageProtocols.filter(([id]) => id !== 'local-agent')}
                onChange={(v) => update('imageProtocol', v as ImageProtocol)}
              />
            </label>
          </div>
          <details>
            <summary>高级连接选项</summary>
            <div className="pc-advanced">
              <label>
                模型目录路径
                <Input
                  value={draft.modelsPath}
                  placeholder="models"
                  onChange={(e) => update('modelsPath', e.target.value)}
                />
              </label>
              <div className="pc-two">
                <label>
                  文本接口路径
                  <Input
                    value={draft.textPath}
                    placeholder="留空按协议自动选择"
                    onChange={(e) => update('textPath', e.target.value)}
                  />
                </label>
                <label>
                  生图接口路径
                  <Input
                    value={draft.imagePath}
                    placeholder="留空按协议自动选择"
                    onChange={(e) => update('imagePath', e.target.value)}
                  />
                </label>
              </div>
              <small>接口路径相对于 Base URL，Gemini / Imagen 路径可用 {'{model}'} 占位符。</small>
              <div className="pc-two">
                <label>
                  请求超时（秒）
                  <Input
                    type="number"
                    min={1}
                    max={600}
                    value={draft.timeoutMs / 1000}
                    onChange={(e) => update('timeoutMs', Number(e.target.value) * 1000)}
                  />
                </label>
                <label>
                  输出 Token 上限
                  <Input
                    type="number"
                    min={128}
                    max={131072}
                    value={draft.maxOutputTokens}
                    onChange={(e) => update('maxOutputTokens', Number(e.target.value))}
                  />
                  <small>用于 Responses、Claude 和 Gemini。</small>
                </label>
              </div>
              <label className="pc-check">
                <input
                  type="checkbox"
                  checked={draft.jsonMode}
                  onChange={(e) => update('jsonMode', e.target.checked)}
                />
                请求 JSON 输出模式（Claude 通过提示词约束）
              </label>
              {draft.imageProtocol === 'openai-images' && (
                <label>
                  参考图素材接口路径
                  <Input
                    value={draft.imageEditPath ?? ''}
                    placeholder="images/edits"
                    onChange={(e) => update('imageEditPath', e.target.value)}
                  />
                  <small>素材重建需要支持图片输入的编辑接口。</small>
                </label>
              )}
              <p className="pc-hint">参考图与素材尺寸由模型决定，保留完整内容与实际比例。</p>
              <label>
                自定义请求头（JSON）
                <Textarea
                  value={headers}
                  onChange={(e) => setHeaders(e.target.value)}
                  placeholder={'{"X-Custom-Header": "value"}'}
                />
                <small>
                  {provider?.headerNames.length
                    ? `已保存：${provider.headerNames.join('、')}。`
                    : ''}
                  留空保留，输入 {'{}'} 清除；填写后整体替换。
                </small>
              </label>
            </div>
          </details>
          {feedback.message && (
            <p
              className={feedback.error ? 'pc-error' : 'pc-hint'}
              role={feedback.error ? 'alert' : 'status'}
            >
              {feedback.message}
            </p>
          )}
          <footer className="pc-footer">
            <Button type="button" variant="outline" onClick={() => void perform(true)}>
              <RefreshCw size={14} className={busy === 'probe' ? 'animate-spin' : ''} />
              {busy === 'probe' ? '检测中…' : '检测连接'}
            </Button>
            <Button type="submit">{busy === 'save' ? '保存中…' : '保存供应商'}</Button>
          </footer>
        </fieldset>
      </form>
    </Modal>
  );
}
/**
 * 呈现模型连接管理面板，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.settings - 当前生效的设置。
 * @param props.onSettings - 在设置时通知调用方，由外层决定如何更新业务状态。
 * @param props.notify - 向外层界面发送操作提示的回调。
 * @returns 供 React 渲染的界面内容。
 */
export function ProviderConnections({
  settings,
  onSettings,
  notify,
}: {
  /** 当前生效的设置。 */
  settings: ProviderSettings;
  /**
   * 在设置时通知调用方，由外层决定如何更新业务状态。
   * @param value - 当前字段、模式或控件的取值。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSettings: (value: ProviderSettings) => void;
  /**
   * 向外层界面发送操作提示的回调。
   * @param message - 面向用户或调用方的说明消息。
   * @param error - 当前操作的失败信息，供界面反馈或重试判断。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  notify: (message: string, error?: boolean) => void;
}) {
  /** 界面状态：当前是否编辑或正在编辑的目标。通过状态更新驱动界面刷新。 */
  const [editing, setEditing] = useState<ModelProvider | 'new'>();
  const [localEditing, setLocalEditing] = useState<{
    provider?: ModelProvider;
    agentId?: LocalAgentId;
  }>();
  /** 界面状态：正在执行删除的目标或状态。通过状态更新驱动界面刷新。 */
  const [deleting, setDeleting] = useState<ModelProvider>();
  /** 界面状态：是否有操作进行中，用于阻止重复提交。通过状态更新驱动界面刷新。 */
  const [busy, setBusy] = useState(false);
  return (
    <div className="pc-connections">
      <section className="wf-panel">
        <header className="pc-heading">
          <div>
            <h2>当前模型</h2>
            <p>选择对话与生图能力；本地 Codex 可同时完成两类任务。</p>
          </div>
        </header>
        <Bindings
          key={bindingKey(settings)}
          settings={settings}
          onSettings={(value) => {
            onSettings(value);
            notify('模型选择已保存，将用于接下来的请求');
          }}
        />
      </section>
      <LocalAgentsPanel onConnect={(agentId) => setLocalEditing({ agentId })} />
      <section className="wf-panel">
        <header className="pc-heading">
          <div>
            <h2>
              服务供应商 <span>{settings.providers.length}</span>
            </h2>
            <p>管理 API Key、本地服务与自定义兼容接口。</p>
          </div>
          <Button onClick={() => setEditing('new')}>
            <Plus size={14} />
            添加供应商
          </Button>
        </header>
        <div className="pc-providers">
          {settings.providers.length ? (
            settings.providers.map((provider) => (
              <article key={provider.id} className="pc-provider">
                <div>
                  <h3>{provider.name}</h3>
                  <p title={provider.baseUrl}>{provider.baseUrl}</p>
                  <div className="pc-tags">
                    {provider.textProtocol !== 'none' && (
                      <span>
                        文本 · {textProtocols.find(([id]) => id === provider.textProtocol)?.[1]}
                      </span>
                    )}
                    {provider.imageProtocol !== 'none' && (
                      <span>
                        生图 · {imageProtocols.find(([id]) => id === provider.imageProtocol)?.[1]}
                      </span>
                    )}
                    <span>
                      {provider.auth === 'none'
                        ? '无需密钥'
                        : provider.hasApiKey || provider.headerNames.length
                          ? '已保存凭据'
                          : '未配置凭据'}
                    </span>
                    {settings.text.providerId === provider.id && <span>当前文本</span>}
                    {(settings.effectiveImage || settings.image).providerId === provider.id && (
                      <span>当前生图{settings.imageFollowsText ? ' · 自动复用' : ''}</span>
                    )}
                  </div>
                </div>
                <div className="pc-actions">
                  <Button
                    variant="outline"
                    onClick={() =>
                      provider.textProtocol === 'local-agent'
                        ? setLocalEditing({ provider })
                        : setEditing(provider)
                    }
                    aria-label={`编辑 ${provider.name}`}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setDeleting(provider)}
                    aria-label={`删除 ${provider.name}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <p className="pc-empty">添加供应商后，即可分别选择文本与生图模型。</p>
          )}
        </div>
      </section>
      {localEditing && (
        <LocalAgentEditor
          {...localEditing}
          settings={settings}
          onSettings={onSettings}
          onClose={() => setLocalEditing(undefined)}
        />
      )}
      {editing && (
        <ProviderEditor
          provider={editing === 'new' ? undefined : editing}
          onSettings={(value) => {
            onSettings(value);
            notify('供应商已保存');
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
      {deleting && (
        <Modal
          title="删除供应商"
          subtitle={`删除「${deleting.name}」及其本地连接凭据。`}
          onClose={() => {
            if (!busy) setDeleting(undefined);
          }}
        >
          <div className="pc-delete">
            <p>
              {settings.text.providerId === deleting.id || settings.image.providerId === deleting.id
                ? '正在使用此供应商的模型绑定也会清除，需要重新选择供应商。'
                : '已生成的设计和对话会保留。'}
            </p>
            <footer className="pc-footer">
              <Button variant="outline" disabled={busy} onClick={() => setDeleting(undefined)}>
                取消
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    onSettings(
                      await api<ProviderSettings>(
                        `/providers/${encodeURIComponent(deleting.id)}`,
                        undefined,
                        'DELETE',
                      ),
                    );
                    setDeleting(undefined);
                    notify('供应商已删除');
                  } catch (error) {
                    notify((error as Error).message, true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                删除供应商
              </Button>
            </footer>
          </div>
        </Modal>
      )}
    </div>
  );
}
