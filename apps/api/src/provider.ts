import type { Project, GenerationState, ThemeTokens } from '@forma/schema';
import type { ChatMessage } from './types.ts';
import { isRecord, errorMessage } from './errors.ts';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { ApiError, requireValue } from './errors.ts';
import { dataRoot } from './store.ts';
import { resolveModel } from './provider-settings.ts';
import { saveGeneratedMedia } from './generated-media.ts';
import { reconstructWithAssets } from './reconstruction.ts';
import { requestText, requestImage } from './provider-transport.ts';
export { getProviderSettings, saveProviderSettings } from './provider-settings.ts';
import { requireApproved, validateTokens } from './validate.ts';
import { designContext, designContextHash } from './design-context.ts';

/**
 * 将当前项目约束组织为提示词，保证生成内容沿用已有设计规范。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 提供给模型的设计上下文文本。
 */
function projectContext(project: Project) {
  return JSON.stringify(designContext(project));
}

/**
 * 结合项目设计上下文生成参考图，并保存其上下文摘要以支持后续确认。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @param prompt - 发送给模型的生成要求。
 * @returns 尚待用户确认的图片生成记录。
 */
export async function generateImage(project: Project, prompt: unknown): Promise<GenerationState> {
  requireValue(
    typeof prompt === 'string' && prompt.trim().length > 0 && prompt.length <= 20000,
    '请输入 1–20000 字的设计需求。',
  );
  const { provider, model } = await resolveModel('image');
  const result = await requestImage(
    provider,
    model,
    `Create a polished desktop web application UI design screenshot for the following request. This is one project; enforce its exact palette, typography, radii, spacing scale, component shapes and navigation conventions across all pages. Show the entire requested UI edge-to-edge. Choose the appropriate aspect ratio and image dimensions for its content, including a tall full-page image for long pages. Do not crop the header or footer or compress a long page into a fixed landscape canvas. No device mockups. Project design contract: ${projectContext(project)}\nUser request: ${prompt}`,
  );
  const media = await saveGeneratedMedia(project.id, result);
  return {
    prompt: prompt.trim(),
    imageUrl: media.url,
    width: media.width,
    height: media.height,
    approved: false,
    generatedAt: new Date().toISOString(),
    contextHash: designContextHash(project),
  };
}

/**
 * 请求结构化模型结果并解析 JSON，给业务动作提供统一入口。
 *
 * @param messages - 按会话顺序保存的消息列表。
 * @returns 解析后的模型输出对象。
 */
export async function generateJson(messages: ChatMessage[]): Promise<Record<string, unknown>> {
  const { provider, model } = await resolveModel('text');
  const content = await requestText(provider, model, messages);
  requireValue(content.trim(), '模型没有返回有效文本。', 502);
  try {
    const result: unknown = JSON.parse(
      content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''),
    );
    if (!isRecord(result)) throw new Error('Expected object');
    return result;
  } catch {
    throw new ApiError(502, '模型返回的数据不是有效 JSON，请重试或更换文本模型。');
  }
}

/**
 * 依据已确认的参考图还原可编辑设计，并交由素材重建流程处理独立视觉素材。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @param prompt - 发送给模型的生成要求。
 * @returns 还原后的页面和组件数据。
 */
export async function generateDesign(project: Project, prompt: unknown = '') {
  requireApproved(project);
  requireValue(
    typeof prompt === 'string' &&
      (!prompt.trim() || prompt.trim() === project.generation.prompt.trim()),
    '设计需求已改变，请重新生成并确认设计图，不能在还原时跳过图片审批。',
    409,
  );
  const filename = project.generation.imageUrl.replace('/api/assets/', '');
  requireValue(
    project.generation.imageUrl.startsWith('/api/assets/') && path.basename(filename) === filename,
    '设计图资源地址无效。',
  );
  let image;
  try {
    image = await readFile(path.join(dataRoot, 'assets', filename));
  } catch {
    throw new ApiError(409, '已确认的设计图资源不存在，请重新生成设计图。');
  }
  const mime = filename.endsWith('.jpeg')
    ? 'image/jpeg'
    : filename.endsWith('.webp')
      ? 'image/webp'
      : 'image/png';
  return reconstructWithAssets(
    project,
    image,
    mime,
    /**
     * 执行 generateDesign 传入的局部处理步骤，使调用处能够控制结果如何更新。
     *
     * @param assetInstructions - 素材分析与还原时需要遵守的补充要求。
     * @returns 当前步骤的处理结果。
     */
    async (assetInstructions) =>
      generateJson([
        {
          role: 'system',
          content: `You translate approved web UI images into editable scene graphs. Return JSON {"pages": [...], "components": [...], "assets": [...]}. Preserve existing stable page IDs where appropriate. Node IDs must be unique stable ASCII letters/digits/hyphens/underscores. Every page/component: {id,name,width,height,nodes}. Component additionally has description/category. Every node: {id,name,type,x,y,width,height,fill?,color?,text?,fontSize?,radius?,opacity?,parentId?,componentId?,tokenBindings?,visible?,layout?,gap?,src?,stroke?,strokeWidth?,rotation?,fontWeight?,textAlign?,lineHeight?,letterSpacing?,gradient?,shadow?,path?,points?,closed?}. Types: frame,text,rectangle,button,image,component,group,ellipse,line,polygon,star,path,section. gradient={type:"linear"|"radial",from:color,to:color,angle:number}; shadow={x,y,blur,spread,color}; points=[{x,y}] use local shape coordinates. path contains SVG path coordinate commands only, never XML markup. All node x/y are absolute coordinates within the page, even children; parentId is optional and must refer to another node in the same page. Avoid deep nesting. Use tokenBindings such as {fill:"primary",color:"text",radius:"radius"}. Bind the exact project theme tokens. Colors are CSS hex/rgb/hsl strings. No executable code, XML markup or remote image URLs. Reuse existing component IDs when meaningful. Accurately reconstruct the approved screenshot with editable typography, shapes, cards and controls. Preserve its hierarchy. The project graph is the source of truth for consistency. Return exactly one page matching the approved screenshot, with as many editable nodes as needed; do not invent additional screens. Use compact JSON and omit unused optional properties instead of null. All numeric fields must be JSON numbers; fontWeight must be a number between 1 and 1000, never a CSS name or a string. Token bindings use node property names: bind fill/color/stroke to color tokens, fontFamily to fontFamily, and radius/gap/padding/paddingX/paddingY to radius or spacing. Never use border as a binding property; the border token is bound through stroke. Token keys: primary,background,surface,text,muted,border,radius,fontFamily,spacing.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Project: ${projectContext(project)}\nApproved image request: ${project.generation.prompt}\nReconstruct only the approved image. Preserve the full reference image aspect ratio; do not force it into existing page height. ${assetInstructions} Preserve flat node array stacking order from background to foreground. parentId is grouping metadata; all positions remain absolute to the page or component surface. Use type component only for actual reusable instances; do not attach componentId to ordinary buttons.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${image.toString('base64')}` },
            },
          ],
        },
      ]),
  );
}

/**
 * 根据文字要求生成主题 Token，供用户应用到项目中。
 *
 * @param prompt - 发送给模型的生成要求。
 * @returns 模型生成的主题数据。
 */
export async function generateTheme(prompt: unknown) {
  requireValue(
    typeof prompt === 'string' && prompt.trim() && prompt.length <= 20000,
    '请输入主题描述。',
  );
  const result = await generateJson([
    {
      role: 'system',
      content:
        'Create a cohesive accessible web UI theme. Return JSON {name,description,tokens:{primary,background,surface,text,muted,border,radius,fontFamily,spacing}}. Colors must be hexadecimal CSS colors. radius and spacing are numbers in pixels. fontFamily is a CSS font stack. Use Chinese for name and description. Text must have good contrast against background/surface.',
    },
    { role: 'user', content: prompt },
  ]);
  let tokens: ThemeTokens;
  try {
    tokens = validateTokens(result.tokens);
  } catch (error) {
    throw new ApiError(502, `模型主题结构未通过验证：${errorMessage(error)}`);
  }
  return {
    name: String(result.name || 'AI 主题').slice(0, 100),
    description: String(result.description || '').slice(0, 1000),
    tokens,
  };
}
