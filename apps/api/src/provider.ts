import type { Project, GenerationState, ThemeTokens } from '@forma/schema';
import type { ChatMessage } from './types.ts';
import { isRecord, errorMessage } from './errors.ts';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ApiError, requireValue } from './errors.ts';
import { dataRoot } from './store.ts';
import { resolveModel } from './provider-settings.ts';
import { requestText, requestImage } from './provider-transport.ts';
export { getProviderSettings, saveProviderSettings } from './provider-settings.ts';
import { requireApproved, validateProject, validateTokens } from './validate.ts';
import { designContext, designContextHash } from './design-context.ts';

function projectContext(project: Project) {
  return JSON.stringify(designContext(project));
}

export async function generateImage(project: Project, prompt: unknown): Promise<GenerationState> {
  requireValue(typeof prompt === 'string' && prompt.trim().length > 0 && prompt.length <= 20000, '请输入 1–20000 字的设计需求。');
  const { provider, model } = await resolveModel('image');
  const result = await requestImage(provider, model,
    `Create a polished desktop web application UI design screenshot for the following request. This is one project; enforce its exact palette, typography, radii, spacing scale, component shapes and navigation conventions across all pages. Show the actual usable UI edge-to-edge, no device mockups. Project design contract: ${projectContext(project)}\nUser request: ${prompt}`,
  );
  let bytes; let extension = 'png';
  if (result.b64_json) {
    requireValue(typeof result.b64_json === 'string' && result.b64_json.length < 40000000, '生成图片过大。', 502);
    bytes = Buffer.from(result.b64_json, 'base64');
  } else {
    let imageUrl; try { imageUrl = new URL(typeof result.url === 'string' ? result.url : ''); } catch { throw new ApiError(502, '模型返回了无效图片地址。'); }
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

export async function generateJson(messages: ChatMessage[]): Promise<Record<string, unknown>> {
  const { provider, model } = await resolveModel('text');
  const content = await requestText(provider, model, messages);
  requireValue(content.trim(), '模型没有返回有效文本。', 502);
  try {
    const result: unknown = JSON.parse(content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
    if (!isRecord(result)) throw new Error('Expected object');
    return result;
  }
  catch { throw new ApiError(502, '模型返回的数据不是有效 JSON，请重试或更换文本模型。'); }
}

export async function generateDesign(project: Project, prompt: unknown = '') {
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
  let candidate: Project;
  try { candidate = validateProject({ ...project, pages: result.pages, components: result.components || project.components }); } catch (error) { throw new ApiError(502, `模型设计结构未通过验证：${errorMessage(error)}`); }
  return { pages: candidate.pages, components: candidate.components };
}

export async function generateTheme(prompt: unknown) {
  requireValue(typeof prompt === 'string' && prompt.trim() && prompt.length <= 20000, '请输入主题描述。');
  const result = await generateJson([
    { role: 'system', content: 'Create a cohesive accessible web UI theme. Return JSON {name,description,tokens:{primary,background,surface,text,muted,border,radius,fontFamily,spacing}}. Colors must be hexadecimal CSS colors. radius and spacing are numbers in pixels. fontFamily is a CSS font stack. Use Chinese for name and description. Text must have good contrast against background/surface.' },
    { role: 'user', content: prompt },
  ]);
  let tokens: ThemeTokens;
  try { tokens = validateTokens(result.tokens); } catch (error) { throw new ApiError(502, `模型主题结构未通过验证：${errorMessage(error)}`); }
  return { name: String(result.name || 'AI 主题').slice(0, 100), description: String(result.description || '').slice(0, 1000), tokens };
}
