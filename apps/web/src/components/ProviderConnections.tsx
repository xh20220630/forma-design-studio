import { useId, useState } from 'react';
import { Check, Plus, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import type { ImageProtocol, ModelBinding, ModelProvider, ProviderModel, ProviderSettings, TextProtocol } from '@forma/schema';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';
import { Textarea } from '@forma/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@forma/ui/select';
import { api } from '../lib/api';
import Modal from './Modal';
import './provider-connections.css';

const textProtocols: [TextProtocol, string][] = [['openai', 'OpenAI 兼容 · Chat Completions'], ['openai-responses', 'OpenAI Responses'], ['anthropic', 'Claude / Anthropic'], ['gemini', 'Google Gemini'], ['none', '不提供文本服务']];
const imageProtocols: [ImageProtocol, string][] = [['openai-images', 'OpenAI 兼容 · Images'], ['gemini', 'Gemini 生图'], ['imagen', 'Google Imagen'], ['none', '不提供生图服务']];
const presets = [
  { name: '自定义供应商', baseUrl: '', textProtocol: 'openai', imageProtocol: 'openai-images', auth: 'auto' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', textProtocol: 'openai-responses', imageProtocol: 'openai-images', auth: 'auto' },
  { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', textProtocol: 'anthropic', imageProtocol: 'none', auth: 'auto' },
  { name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', textProtocol: 'gemini', imageProtocol: 'gemini', auth: 'auto' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', textProtocol: 'openai', imageProtocol: 'none', auth: 'auto' },
  { name: 'Ollama / 本地服务', baseUrl: 'http://localhost:11434/v1', textProtocol: 'openai', imageProtocol: 'none', auth: 'none' },
] as const;
function Choice({ value, onChange, options, label, disabled }: { value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[]; label: string; disabled?: boolean }) {
  return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>;
}
function ModelField({ channel, settings, value, onChange, disabled }: { channel: 'text' | 'image'; settings: ProviderSettings; value: ModelBinding; onChange: (binding: ModelBinding) => void; disabled: boolean }) {
  const listId = useId();
  const [catalogs, setCatalogs] = useState<Record<string, ProviderModel[]>>({});
  const [loading, setLoading] = useState('');
  const [feedback, setFeedback] = useState({ id: '', message: '', error: false });
  const title = channel === 'text' ? '文本 / 视觉模型' : '图片生成模型';
  const providers = settings.providers.filter(p => p[channel === 'text' ? 'textProtocol' : 'imageProtocol'] !== 'none');
  const fetchModels = async () => {
    const id = value.providerId;
    setLoading(id);
    setFeedback({ id, message: '', error: false });
    try {
      const result = await api<{ models: ProviderModel[] }>(`/providers/${encodeURIComponent(id)}/models`);
      setCatalogs(old => ({ ...old, [id]: result.models }));
      setFeedback({ id, message: `已获取 ${result.models.length} 个模型，请选择支持${channel === 'text' ? '文本 / 视觉' : '生图'}的模型。`, error: false });
    } catch (error) { setFeedback({ id, message: `${(error as Error).message} 可手动填写模型 ID。`, error: true }); }
    finally { setLoading(''); }
  };
  const models = catalogs[value.providerId] || [];
  return <section className="pc-model-field"><h3>{title}</h3><p>{channel === 'text' ? '用于对话、主题生成与设计图还原；还原需要视觉能力。' : '用于生成 UI 设计图，可使用独立的供应商。'}</p>
    <label>服务供应商<Choice label={`${title}供应商`} value={value.providerId || '__none'} disabled={disabled || !!loading} options={[["__none", '暂不配置'], ...providers.map(p => [p.id, p.name] as const)]} onChange={id => onChange({ providerId: id === '__none' ? '' : id, model: '' })} /></label>
    <label>模型 ID<div className="pc-model-input"><Input aria-label={`${title} ID`} list={listId} value={value.model} disabled={disabled || !value.providerId} placeholder="选择或输入上游模型 ID" onChange={event => onChange({ ...value, model: event.target.value })} /><Button type="button" variant="outline" disabled={disabled || !value.providerId || !!loading} onClick={() => void fetchModels()} title="从上游获取模型列表"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />获取模型</Button></div></label>
    <datalist id={listId}>{models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</datalist>
    {models.length > 0 && <Choice label={`${title}上游列表`} value={models.some(m => m.id === value.model) ? value.model : '__choose'} disabled={disabled} onChange={model => { if (model !== '__choose') onChange({ ...value, model }); }} options={[["__choose", `从 ${models.length} 个上游模型中选择`], ...models.map(m => [m.id, m.name === m.id ? m.id : `${m.name} · ${m.id}`] as const)]} />}
    {feedback.id === value.providerId && feedback.message && <p className={feedback.error ? 'pc-error' : 'pc-hint'} role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
  </section>;
}
function Bindings({ settings, onSettings, onDone, quick = false }: { settings: ProviderSettings; onSettings: (value: ProviderSettings) => void; onDone?: () => void; quick?: boolean }) {
  const [text, setText] = useState(settings.text);
  const [image, setImage] = useState(settings.image);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  return <form onSubmit={async event => { event.preventDefault(); setBusy(true); setFeedback(''); try { onSettings(await api<ProviderSettings>('/settings/models', { text, image })); setFeedback('模型选择已保存，将用于接下来的请求。'); onDone?.(); } catch (error) { setFeedback((error as Error).message); } finally { setBusy(false); } }}>
    <div className="pc-models"><ModelField channel="text" settings={settings} value={text} onChange={setText} disabled={busy} /><ModelField channel="image" settings={settings} value={image} onChange={setImage} disabled={busy} /></div>
    {feedback && <p className="pc-feedback" role="status">{feedback}</p>}
    <footer className="pc-footer"><span>保存后用于接下来的请求</span><Button type="submit" disabled={busy}><Check size={14} />{busy ? '保存中…' : quick ? '应用模型' : '保存模型选择'}</Button></footer>
  </form>;
}
const bindingKey = (settings: ProviderSettings) => JSON.stringify([settings.text, settings.image, settings.providers.map(p => [p.id, p.textProtocol, p.imageProtocol])]);
export function ModelSwitcher({ settings, onSettings, onClose, onManage }: { settings: ProviderSettings; onSettings: (value: ProviderSettings) => void; onClose: () => void; onManage: () => void }) {
  return <Modal title="更换模型" subtitle="分别选择文本与生图模型，供应商可以不同。" wide onClose={onClose}><div className="pc-switcher"><Bindings key={bindingKey(settings)} settings={settings} onSettings={onSettings} onDone={onClose} quick /><Button variant="ghost" onClick={onManage}><Settings2 size={14} />管理服务供应商</Button></div></Modal>;
}
function ProviderEditor({ provider, onSettings, onClose }: { provider?: ModelProvider; onSettings: (value: ProviderSettings) => void; onClose: () => void }) {
  const [draft, setDraft] = useState({ ...presets[0], modelsPath: '', textPath: '', imagePath: '', timeoutMs: 180000, maxOutputTokens: 8192, jsonMode: true, imageSize: '1536x1024', ...provider } as Omit<ModelProvider, 'id' | 'hasApiKey' | 'headerNames'>);
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [headers, setHeaders] = useState('');
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState({ error: false, message: '' });
  const update = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft(old => ({ ...old, [key]: value }));
  const perform = async (probe: boolean) => {
    setBusy(probe ? 'probe' : 'save'); setFeedback({ error: false, message: '' });
    try {
      const payload = { ...draft, apiKey, clearApiKey, ...(headers.trim() ? { headers: JSON.parse(headers) } : {}) };
      if (probe) {
        const result = await api<{ models: ProviderModel[]; latencyMs: number }>('/providers/probe', { ...payload, id: provider?.id });
        setFeedback({ error: false, message: `模型目录可访问 · ${result.models.length} 个模型 · ${result.latencyMs} ms。具体模型的生成能力以上游支持为准。` });
      } else {
        onSettings(await api<ProviderSettings>(provider ? `/providers/${encodeURIComponent(provider.id)}` : '/providers', payload, provider ? 'PUT' : 'POST'));
        onClose();
      }
    } catch (error) { setFeedback({ error: true, message: (error as Error).message + (probe ? ' 若上游未提供模型目录，可保存后手动填写模型 ID。' : '') }); }
    finally { setBusy(''); }
  };
  return <Modal title={provider ? '编辑供应商' : '添加供应商'} subtitle="密钥保存在本地服务端；文本和生图协议可以分别指定。" wide onClose={() => { if (!busy) onClose(); }}><form className="pc-editor" onSubmit={event => { event.preventDefault(); void perform(false); }}><fieldset disabled={!!busy}>
    {!provider && <label>快速开始<Choice label="供应商预设" value={presets.find(p => p.name === draft.name)?.name || presets[0].name} options={presets.map(p => [p.name, p.name])} onChange={name => { const preset = presets.find(p => p.name === name)!; setDraft(old => ({ ...old, ...preset })); }} /></label>}
    <div className="pc-two"><label>供应商名称<Input required value={draft.name} onChange={e => update('name', e.target.value)} /></label><label>认证方式<Choice label="认证方式" value={draft.auth} onChange={value => update('auth', value as typeof draft.auth)} options={[["auto", '按协议自动认证'], ['none', '无需密钥 · 本地服务'], ['bearer', 'Authorization: Bearer'], ['api-key', 'api-key 请求头']]} /></label></div>
    <label>API Base URL<Input required type="url" value={draft.baseUrl} placeholder="https://api.example.com/v1" onChange={e => update('baseUrl', e.target.value)} /><small>填写包含 API 版本的基础地址；本机服务可使用 HTTP。</small></label>
    <label>API Key<Input type="password" autoComplete="new-password" disabled={clearApiKey} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={provider?.hasApiKey ? '已保存密钥，留空保留' : '输入密钥；无需认证时可留空'} /></label>
    {provider?.hasApiKey && <label className="pc-check"><input type="checkbox" checked={clearApiKey} onChange={e => { setClearApiKey(e.target.checked); setApiKey(''); }} />清除已保存的密钥</label>}
    <div className="pc-two"><label>文本协议<Choice label="文本协议" value={draft.textProtocol} options={textProtocols} onChange={v => update('textProtocol', v as TextProtocol)} /></label><label>生图协议<Choice label="生图协议" value={draft.imageProtocol} options={imageProtocols} onChange={v => update('imageProtocol', v as ImageProtocol)} /></label></div>
    <details><summary>高级连接选项</summary><div className="pc-advanced">
      <label>模型目录路径<Input value={draft.modelsPath} placeholder="models" onChange={e => update('modelsPath', e.target.value)} /></label>
      <div className="pc-two"><label>文本接口路径<Input value={draft.textPath} placeholder="留空按协议自动选择" onChange={e => update('textPath', e.target.value)} /></label><label>生图接口路径<Input value={draft.imagePath} placeholder="留空按协议自动选择" onChange={e => update('imagePath', e.target.value)} /></label></div>
      <small>接口路径相对于 Base URL，Gemini / Imagen 路径可用 {'{model}'} 占位符。</small>
      <div className="pc-two"><label>请求超时（秒）<Input type="number" min={1} max={600} value={draft.timeoutMs / 1000} onChange={e => update('timeoutMs', Number(e.target.value) * 1000)} /></label><label>输出 Token 上限<Input type="number" min={128} max={131072} value={draft.maxOutputTokens} onChange={e => update('maxOutputTokens', Number(e.target.value))} /><small>用于 Responses、Claude 和 Gemini。</small></label></div>
      <label className="pc-check"><input type="checkbox" checked={draft.jsonMode} onChange={e => update('jsonMode', e.target.checked)} />请求 JSON 输出模式（Claude 通过提示词约束）</label>
      {draft.imageProtocol === 'openai-images' && <label>生成图片尺寸<Input value={draft.imageSize} placeholder="留空使用上游默认尺寸" onChange={e => update('imageSize', e.target.value)} /></label>}
      <label>自定义请求头（JSON）<Textarea value={headers} onChange={e => setHeaders(e.target.value)} placeholder={'{"X-Custom-Header": "value"}'} /><small>{provider?.headerNames.length ? `已保存：${provider.headerNames.join('、')}。` : ''}留空保留，输入 {'{}'} 清除；填写后整体替换。</small></label>
    </div></details>
    {feedback.message && <p className={feedback.error ? 'pc-error' : 'pc-hint'} role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
    <footer className="pc-footer"><Button type="button" variant="outline" onClick={() => void perform(true)}><RefreshCw size={14} className={busy === 'probe' ? 'animate-spin' : ''} />{busy === 'probe' ? '检测中…' : '检测连接'}</Button><Button type="submit">{busy === 'save' ? '保存中…' : '保存供应商'}</Button></footer>
  </fieldset></form></Modal>;
}
export function ProviderConnections({ settings, onSettings, notify }: { settings: ProviderSettings; onSettings: (value: ProviderSettings) => void; notify: (message: string, error?: boolean) => void }) {
  const [editing, setEditing] = useState<ModelProvider | 'new'>();
  const [deleting, setDeleting] = useState<ModelProvider>();
  const [busy, setBusy] = useState(false);
  return <div className="pc-connections"><section className="wf-panel"><header className="pc-heading"><div><h2>当前模型</h2><p>文本与生图独立连接，按任务选择合适的模型。</p></div></header><Bindings key={bindingKey(settings)} settings={settings} onSettings={onSettings} /></section>
    <section className="wf-panel"><header className="pc-heading"><div><h2>服务供应商 <span>{settings.providers.length}</span></h2><p>管理 API Key、本地服务与自定义兼容接口。</p></div><Button onClick={() => setEditing('new')}><Plus size={14} />添加供应商</Button></header>
      <div className="pc-providers">{settings.providers.length ? settings.providers.map(provider => <article key={provider.id} className="pc-provider"><div><h3>{provider.name}</h3><p title={provider.baseUrl}>{provider.baseUrl}</p><div className="pc-tags">{provider.textProtocol !== 'none' && <span>文本 · {textProtocols.find(([id]) => id === provider.textProtocol)?.[1]}</span>}{provider.imageProtocol !== 'none' && <span>生图 · {imageProtocols.find(([id]) => id === provider.imageProtocol)?.[1]}</span>}<span>{provider.auth === 'none' ? '无需密钥' : provider.hasApiKey || provider.headerNames.length ? '已保存凭据' : '未配置凭据'}</span>{settings.text.providerId === provider.id && <span>当前文本</span>}{settings.image.providerId === provider.id && <span>当前生图</span>}</div></div><div className="pc-actions"><Button variant="outline" onClick={() => setEditing(provider)} aria-label={`编辑 ${provider.name}`}>编辑</Button><Button variant="ghost" onClick={() => setDeleting(provider)} aria-label={`删除 ${provider.name}`}><Trash2 size={14} /></Button></div></article>) : <p className="pc-empty">添加供应商后，即可分别选择文本与生图模型。</p>}</div>
    </section>
    {editing && <ProviderEditor provider={editing === 'new' ? undefined : editing} onSettings={value => { onSettings(value); notify('供应商已保存'); }} onClose={() => setEditing(undefined)} />}
    {deleting && <Modal title="删除供应商" subtitle={`删除「${deleting.name}」及其本地连接凭据。`} onClose={() => { if (!busy) setDeleting(undefined); }}><div className="pc-delete"><p>{settings.text.providerId === deleting.id || settings.image.providerId === deleting.id ? '正在使用此供应商的模型绑定也会清除，需要重新选择供应商。' : '已生成的设计和对话会保留。'}</p><footer className="pc-footer"><Button variant="outline" disabled={busy} onClick={() => setDeleting(undefined)}>取消</Button><Button variant="destructive" disabled={busy} onClick={async () => { setBusy(true); try { onSettings(await api<ProviderSettings>(`/providers/${encodeURIComponent(deleting.id)}`, undefined, 'DELETE')); setDeleting(undefined); notify('供应商已删除'); } catch (error) { notify((error as Error).message, true); } finally { setBusy(false); } }}>删除供应商</Button></footer></div></Modal>}
  </div>;
}
