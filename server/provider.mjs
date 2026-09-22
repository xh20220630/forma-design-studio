import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ApiError, requireValue } from './errors.mjs';
import { dataRoot, readJson, transact, writeJson } from './store.mjs';
import { requireApproved, validateProject, validateTokens } from './validate.mjs';
import { designContext, designContextHash } from './design-context.mjs';

const settingsPath = path.join(dataRoot, 'settings.json');

export async function getProviderSettings({ privateValues = false } = {}) {
  const stored = await readJson(settingsPath, {});
  const settings = {
    baseUrl: stored.baseUrl || process.env.FORMA_API_BASE_URL || 'https://api.openai.com/v1',
    textModel: stored.textModel || process.env.FORMA_TEXT_MODEL || 'gpt-4.1',
    imageModel: stored.imageModel || process.env.FORMA_IMAGE_MODEL || 'gpt-image-1',
    apiKey: stored.apiKey || process.env.OPENAI_API_KEY || '',
  };
  return privateValues ? settings : { configured: Boolean(settings.apiKey), baseUrl: settings.baseUrl, textModel: settings.textModel, imageModel: settings.imageModel };
}

export function saveProviderSettings(input) {
  return transact(async () => {
    const current = await getProviderSettings({ privateValues: true });
    const settings = { ...current };
    for (const key of ['baseUrl', 'textModel', 'imageModel']) if (input[key] !== undefined) { requireValue(typeof input[key] === 'string' && input[key].trim().length > 0 && input[key].length < 1000, `${key} 不能为空。`); settings[key] = input[key].trim(); }
    if (typeof input.apiKey === 'string' && input.apiKey.trim()) settings.apiKey = input.apiKey.trim();
    let base;
    try { base = new URL(settings.baseUrl); } catch { throw new ApiError(400, 'API Base URL 格式无效。'); }
    requireValue(!base.username && !base.password && !base.search && !base.hash, 'API Base URL 不能包含凭据、查询参数或片段。');
    requireValue(base.protocol === 'https:' || (base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)), 'API 服务必须使用 HTTPS，本地服务可使用 HTTP。');
    settings.baseUrl = settings.baseUrl.replace(/\/+$/, '');
    await writeJson(settingsPath, settings); return getProviderSettings();
  });
}

async function providerRequest(route, body) {
  const settings = await getProviderSettings({ privateValues: true });
  requireValue(settings.apiKey, '请先在设置中配置模型 API Key。', 400);
  let response;
  try { response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) }); }
  catch (error) { throw new ApiError(502, error.name === 'TimeoutError' ? '模型服务超时，请重试。' : '无法连接模型服务，请检查 API Base URL 和网络。'); }
  let payload;
  try { payload = await response.json(); } catch { throw new ApiError(502, `模型服务返回非 JSON 数据（HTTP ${response.status}）。`); }
  if (!response.ok) throw new ApiError(502, `模型服务请求失败（HTTP ${response.status}）：${String(payload?.error?.message || payload?.message || '未知错误').replaceAll(settings.apiKey, '[REDACTED]').slice(0, 700)}`);
  requireValue(payload && typeof payload === 'object', '模型服务返回的数据结构无效。', 502);
  return payload;
}

function projectContext(project) {
  return JSON.stringify(designContext(project));
}

export async function generateImage(project, prompt) {
  requireValue(typeof prompt === 'string' && prompt.trim().length > 0 && prompt.length <= 20000, '请输入 1–20000 字的设计需求。');
  const settings = await getProviderSettings();
  const payload = await providerRequest('images/generations', {
    model: settings.imageModel, n: 1, size: '1536x1024',
    prompt: `Create a polished desktop web application UI design screenshot for the following request. This is one project; enforce its exact palette, typography, radii, spacing scale, component shapes and navigation conventions across all pages. Show the actual usable UI edge-to-edge, no device mockups. Project design contract: ${projectContext(project)}\nUser request: ${prompt}`,
  });
  const result = payload.data?.[0]; requireValue(result?.b64_json || result?.url, '模型没有返回图片。请确认图片模型支持 Images API。', 502);
  let bytes; let extension = 'png';
  if (result.b64_json) {
    requireValue(typeof result.b64_json === 'string' && result.b64_json.length < 40000000, '生成图片过大。', 502);
    bytes = Buffer.from(result.b64_json, 'base64');
  } else {
    let imageUrl; try { imageUrl = new URL(result.url); } catch { throw new ApiError(502, '模型返回了无效图片地址。'); }
    requireValue(imageUrl.protocol === 'https:', '模型返回的图片必须使用 HTTPS。', 502);
    let response;
    try { response = await fetch(imageUrl, { signal: AbortSignal.timeout(45000), redirect: 'error' }); }
    catch { throw new ApiError(502, '无法下载模型图片，图片地址不可访问或已过期。'); }
    requireValue(response.ok, '无法下载模型生成的图片。', 502);
    requireValue(Number(response.headers.get('content-length') || 0) < 30000000, '生成图片过大。', 502);
    bytes = Buffer.from(await response.arrayBuffer());
    requireValue(bytes.length < 30000000, '生成图片过大。', 502);
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) extension = 'jpeg';
  else if (bytes.subarray(8, 12).toString() === 'WEBP') extension = 'webp';
  else requireValue(bytes.subarray(1, 4).toString() === 'PNG', '模型返回内容不是受支持的 PNG/JPEG/WebP 图片。', 502);
  const filename = `${project.id}-${randomUUID()}.${extension}`;
  await mkdir(path.join(dataRoot, 'assets'), { recursive: true });
  await writeFile(path.join(dataRoot, 'assets', filename), bytes);
  return { prompt: prompt.trim(), imageUrl: `/api/assets/${filename}`, approved: false, generatedAt: new Date().toISOString(), contextHash: designContextHash(project) };
}

export async function generateJson(messages) {
  const settings = await getProviderSettings();
  const response = await providerRequest('chat/completions', { model: settings.textModel, messages, response_format: { type: 'json_object' } });
  const content = response.choices?.[0]?.message?.content;
  requireValue(typeof content === 'string', '模型没有返回有效文本。', 502);
  try {
    const result = JSON.parse(content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Expected object');
    return result;
  }
  catch { throw new ApiError(502, '模型返回的数据不是有效 JSON，请重试或更换文本模型。'); }
}

export async function generateDesign(project, prompt = '') {
  requireApproved(project);
  requireValue(typeof prompt === 'string' && (!prompt.trim() || prompt.trim() === project.generation.prompt.trim()), '设计需求已改变，请重新生成并确认设计图，不能在还原时跳过图片审批。', 409);
  const filename = project.generation.imageUrl.replace('/api/assets/', '');
  requireValue(project.generation.imageUrl.startsWith('/api/assets/') && path.basename(filename) === filename, '设计图资源地址无效。');
  let image;
  try { image = await readFile(path.join(dataRoot, 'assets', filename)); }
  catch { throw new ApiError(409, '已确认的设计图资源不存在，请重新生成设计图。'); }
  const mime = filename.endsWith('.jpeg') ? 'image/jpeg' : filename.endsWith('.webp') ? 'image/webp' : 'image/png';
  const result = await generateJson([
    { role: 'system', content: `You translate approved web UI images into editable scene graphs. Return JSON {"pages": [...], "components": [...]}. Preserve existing stable page IDs where appropriate. Node IDs must be unique stable ASCII letters/digits/hyphens/underscores. Every page/component: {id,name,width,height,nodes}. Component additionally has description/category. Every node: {id,name,type,x,y,width,height,fill?,color?,text?,fontSize?,radius?,opacity?,parentId?,componentId?,tokenBindings?,visible?,layout?,gap?,src?,stroke?,strokeWidth?,rotation?,fontWeight?,textAlign?,lineHeight?,letterSpacing?,gradient?,shadow?,path?,points?,closed?}. Types: frame,text,rectangle,button,image,component,group,ellipse,line,polygon,star,path,section. gradient={type:"linear"|"radial",from:color,to:color,angle:number}; shadow={x,y,blur,spread,color}; points=[{x,y}] use local shape coordinates. path contains SVG path coordinate commands only, never XML markup. All node x/y are absolute coordinates within the page, even children; parentId is optional and must refer to another node in the same page. Avoid deep nesting. Use tokenBindings such as {fill:"primary",color:"text",radius:"radius"}. Bind the exact project theme tokens. Colors are CSS hex/rgb/hsl strings. No executable code, XML markup or remote image URLs. Reuse existing component IDs when meaningful. Accurately reconstruct the approved screenshot with editable typography, shapes, cards and controls. Preserve its hierarchy. The project graph is the source of truth for consistency. Return 1–5 complete pages with 15–100 nodes per page. Token keys: primary,background,surface,text,muted,border,radius,fontFamily,spacing.` },
    { role: 'user', content: [{ type: 'text', text: `Project: ${projectContext(project)}\nApproved image request: ${project.generation.prompt}\nReconstruct only the approved image. Match the existing page IDs and canvas dimensions when that page appears in the image. Scale screenshot coordinates proportionally to that target canvas. Preserve flat node array stacking order from background to foreground. parentId is grouping metadata; all positions remain absolute to the page or component surface. Use type component only for actual reusable instances; do not attach componentId to ordinary buttons.` }, { type: 'image_url', image_url: { url: `data:${mime};base64,${image.toString('base64')}` } }] },
  ]);
  requireValue(Array.isArray(result.pages) && result.pages.length > 0, '模型没有返回设计页面。', 502);
  const candidate = { ...project, pages: result.pages, components: result.components || project.components };
  try { validateProject(candidate); } catch (error) { throw new ApiError(502, `模型设计结构未通过验证：${error.message}`); }
  return { pages: candidate.pages, components: candidate.components };
}

export async function generateTheme(prompt) {
  requireValue(typeof prompt === 'string' && prompt.trim() && prompt.length <= 20000, '请输入主题描述。');
  const result = await generateJson([
    { role: 'system', content: 'Create a cohesive accessible web UI theme. Return JSON {name,description,tokens:{primary,background,surface,text,muted,border,radius,fontFamily,spacing}}. Colors must be hexadecimal CSS colors. radius and spacing are numbers in pixels. fontFamily is a CSS font stack. Use Chinese for name and description. Text must have good contrast against background/surface.' },
    { role: 'user', content: prompt },
  ]);
  try { result.tokens = validateTokens(result.tokens); } catch (error) { throw new ApiError(502, `模型主题结构未通过验证：${error.message}`); }
  return { name: String(result.name || 'AI 主题').slice(0, 100), description: String(result.description || '').slice(0, 1000), tokens: result.tokens };
}
