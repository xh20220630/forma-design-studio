import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import path from 'node:path';
import type { Project, ReconstructionAsset, ReconstructionStatus } from '@forma/schema';
import { dataRoot, readJson, writeJson } from './store.ts';
import { ApiError, errorMessage, isRecord, requireValue } from './errors.ts';
import { imageMetadata, saveGeneratedMedia } from './generated-media.ts';
import { localAssetFilename } from './assets.ts';
import { resolveModel } from './provider-settings.ts';
import { requestImage } from './provider-transport.ts';
import { normalizeGeneratedDesign } from './generated-design.ts';
import { validateProject, validateId } from './validate.ts';

/** 带内部草稿的素材还原状态，公开进度时会去掉草稿。 */
type State = ReconstructionStatus & {
  /** 尚未提交的编辑内容或待组装的设计草稿。 */
  draft?: Record<string, unknown>;
};
/** 集中维护 active 的进行中任务，防止同一目标被重复执行。 */
const active = new Set<string>();
/**
 * 以项目和参考图共同生成状态文件名，防止不同图片的还原进度相互覆盖。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 当前参考图的还原状态文件路径。
 */
function statePath(project: Project) {
  const hash = createHash('sha256')
    .update(`${project.id}:${project.generation?.imageUrl}`)
    .digest('hex');
  return path.join(dataRoot, 'reconstructions', `${hash}.json`);
}
/**
 * 读取还原进度并识别已中断的任务，避免前端无限显示进行中。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 公开的还原进度；尚无任务时返回 null。
 */
export async function getReconstructionStatus(
  project: Project,
): Promise<ReconstructionStatus | null> {
  if (!project.generation?.imageUrl) return null;
  const state = await readJson<State | null>(statePath(project), null);
  if (!state) return null;
  /** 集中维护 { draft: _, ...status } 的约定值或当前状态，供相关分支保持一致。 */
  const { draft: _, ...status } = state;
  if (
    !active.has(statePath(project)) &&
    ['analyzing', 'assets', 'assembling'].includes(status.phase)
  ) {
    return {
      ...status,
      phase: 'failed',
      error: '还原已中断，可重试；已完成的素材会保留。',
    };
  }
  return status;
}
/**
 * 校验模型拆出的素材清单和归一化范围，在花费生图额度前拒绝无效计划。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @returns 初始状态为 pending 的素材列表。
 */
function parseAssets(value: unknown): ReconstructionAsset[] {
  requireValue(
    Array.isArray(value) && value.length <= 24,
    '参考图分析必须返回素材清单（最多 24 项，无独立素材时返回空数组）。',
    502,
  );
  const ids = new Set<string>();
  return value.map(
    /**
     * 转换 parseAssets 中的集合条目，供后续处理或展示。
     *
     * @param item - 当前遍历的条目。
     * @returns 当前条目转换后的结果。
     */
    (item) => {
      requireValue(isRecord(item) && typeof item.id === 'string', '素材清单格式无效。', 502);
      validateId(item.id);
      requireValue(!ids.has(item.id), '素材 ID 重复。', 502);
      ids.add(item.id);
      requireValue(
        typeof item.name === 'string' &&
          item.name.length > 0 &&
          item.name.length <= 200 &&
          typeof item.prompt === 'string' &&
          item.prompt.length > 0 &&
          item.prompt.length <= 6000,
        '素材名称或重建描述无效。',
        502,
      );
      const bounds = item.bounds;
      requireValue(
        isRecord(bounds) &&
          ['x', 'y', 'width', 'height'].every(
            /** 判断 parseAssets 中的条目是否符合检查条件。 @param key - 要访问或更新的字段名。 @returns 该条目是否符合条件。 */
            (key) =>
              typeof bounds[key] === 'number' &&
              Number.isFinite(bounds[key]) &&
              bounds[key] >= 0 &&
              bounds[key] <= 1,
          ),
        '素材区域必须是 0–1 的归一化坐标。',
        502,
      );
      const { x, y, width, height } = bounds as ReconstructionAsset['bounds'];
      requireValue(
        width > 0 && height > 0 && x + width <= 1.001 && y + height <= 1.001,
        '素材区域超出参考图。',
        502,
      );
      requireValue(
        item.background === 'transparent' || item.background === 'opaque',
        '请指定素材的透明或不透明背景。',
        502,
      );
      return {
        id: item.id,
        name: item.name,
        prompt: item.prompt,
        background: item.background,
        bounds: { x, y, width, height },
        status: 'pending',
      };
    },
  );
}
/**
 * 将素材占位引用替换成实际图片地址，并校验整张页面的可编辑结构。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @param draft - 尚未提交的编辑内容或待组装的设计草稿。
 * @param assets - 还原过程中需要独立生成的素材集合。
 * @param placeholders - 是否用占位地址预先校验结构，避免无效计划触发生图。
 * @returns 通过校验的页面与组件。
 */
function assemble(
  project: Project,
  draft: Record<string, unknown>,
  assets: ReconstructionAsset[],
  placeholders = false,
) {
  const used = new Set<string>();
  /**
   * 替换还原草稿中的素材引用，确保图片节点只使用清单中声明的素材。
   *
   * @param input - 当前步骤需要处理的输入。
   * @returns 替换后的页面或组件集合。
   */
  const replace = (input: unknown): unknown =>
    !Array.isArray(input)
      ? input
      : input.map(
          /**
           * 转换 replace 中的集合条目，供后续处理或展示。
           *
           * @param entry - 缓存的已编译场景条目。
           * @returns 当前条目转换后的结果。
           */
          (entry) => {
            if (!isRecord(entry) || !Array.isArray(entry.nodes)) return entry;
            return {
              ...entry,
              nodes: entry.nodes.map(
                /**
                 * 转换 replace 中的集合条目，供后续处理或展示。
                 *
                 * @param value - 当前字段、模式或控件的取值。
                 * @returns 当前条目转换后的结果。
                 */
                (value) => {
                  if (!isRecord(value) || value.type !== 'image') return value;
                  requireValue(
                    typeof value.src === 'string' && value.src.startsWith('asset:'),
                    '还原中的图片节点必须引用素材清单，不能使用整张参考图或未识别的图片地址。',
                    502,
                  );
                  const id = value.src.slice(6);
                  const asset = assets.find(
                    /** 检查 a 的标识等于标识，供集合筛选或定位使用。 @param a - 第一个比较或计算对象。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                    (a) => a.id === id,
                  );
                  requireValue(asset && (placeholders || asset.url), `素材 ${id} 尚未生成。`, 502);
                  used.add(id);
                  return {
                    ...value,
                    src: placeholders ? `/api/assets/pending-${id}.png` : asset.url,
                    imageFit: 'contain',
                  };
                },
              ),
            };
          },
        );
  const normalized = normalizeGeneratedDesign(draft);
  requireValue(
    Array.isArray(normalized.pages) && normalized.pages.length === 1,
    '请按完整参考图返回一个页面。',
    502,
  );
  const candidate = validateProject({
    ...project,
    pages: replace(normalized.pages),
    components:
      normalized.components === undefined ? project.components : replace(normalized.components),
  });
  requireValue(
    assets.every(
      /** 检查used包含 a 的标识，供集合筛选或定位使用。 @param a - 第一个比较或计算对象。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (a) => used.has(a.id),
    ),
    '素材清单中有未放置到页面或组件的素材，请重新分析。',
    502,
  );
  return { pages: candidate.pages, components: candidate.components };
}
/**
 * 先校验分析结果，再逐个生成独立素材；持久化进度以便失败后复用已完成素材。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @param image - 图片数据、图片模型绑定或页面图片节点。
 * @param mime - 图片或文件的 MIME 类型。
 * @param analyze - 根据指定说明请求模型分析参考图的函数。
 * @returns 组装完成的可编辑页面与组件。
 */
export async function reconstructWithAssets(
  project: Project,
  image: Uint8Array,
  mime: string,
  analyze: (instructions: string) => Promise<Record<string, unknown>>,
) {
  const file = statePath(project);
  requireValue(!active.has(file), '这张参考图正在还原，请等待当前任务结束。', 409);
  active.add(file);
  let state: State = {
    phase: 'analyzing',
    sourceImageUrl: project.generation!.imageUrl!,
    assets: [],
    updatedAt: new Date().toISOString(),
  };
  /**
   * 在每个还原阶段更新时间并保存状态，让轮询和失败重试使用同一份进度。
   * @returns 完成进度文件写入的 Promise。
   */
  const save = async () => {
    state.updatedAt = new Date().toISOString();
    await writeJson(file, state);
  };
  try {
    state = await readJson<State>(file, state);
    state.phase = 'analyzing';
    delete state.error;
    const source = imageMetadata(image);
    const canvasWidth = project.pages[0]?.width || source.width;
    const canvasHeight = Math.max(1, Math.round((canvasWidth * source.height) / source.width));
    if (!state.draft) {
      state.phase = 'analyzing';
      await save();
      const draft = await analyze(
        `Reference image is ${source.width} × ${source.height}. Set the output page to ${canvasWidth} × ${canvasHeight}, preserving the FULL reference including header and footer. First identify independent visual assets: product/workbench screenshots, illustrations, photos, decorative hero visuals and complex code/interface preview panels. Treat these visuals as images, NOT dozens of crude rectangles. Keep the surrounding real page headings, body text, buttons, separators and card layout as editable nodes. Return assets:[{id,name,prompt,background:"transparent"|"opaque",bounds:{x,y,width,height}}]. Bounds are normalized 0–1 coordinates in the reference; exclude surrounding page text. The prompt must precisely describe the isolated visual's content, colors, composition, internal text and clean edges for faithful regeneration with the reference image. Reuse one asset ID for identical repeated visuals. Use transparent backgrounds only for isolated illustrations/icons; preserve opaque backgrounds inside screenshot panels. For each asset place an image node with src:"asset:ID" at the right coordinates. Do not embed the entire page as an image. Return assets:[] only when there are no independent visuals. Do not fabricate local/remote image URLs.`,
      );
      const plan = parseAssets(draft.assets);
      // Validate the complete graph before making any image-generation calls.
      assemble(project, draft, plan, true);
      const previous = state.assets;
      state.assets = plan.map(
        /**
         * 转换 reconstructWithAssets 中的集合条目，供后续处理或展示。
         *
         * @param asset - 当前图片素材记录。
         * @returns 当前条目转换后的结果。
         */
        (asset) =>
          previous.find(
            /**
             * 判断 reconstructWithAssets 中的条目是否符合查找条件。
             *
             * @param p - 当前坐标点或内容片段。
             * @returns 该条目是否符合条件。
             */
            (p) =>
              p.id === asset.id &&
              p.prompt === asset.prompt &&
              p.background === asset.background &&
              JSON.stringify(p.bounds) === JSON.stringify(asset.bounds) &&
              p.status === 'completed',
          ) || asset,
      );
      state.draft = draft;
      await save();
    }
    // Validate cached draft too; a malformed or stale cache must not trigger image spend.
    assemble(project, state.draft, state.assets, true);
    state.phase = 'assets';
    await save();
    let imageConnection: Awaited<ReturnType<typeof resolveModel>> | undefined;
    for (const asset of state.assets) {
      if (asset.url && asset.status === 'completed') {
        try {
          await access(path.join(dataRoot, 'assets', localAssetFilename(asset.url)));
          continue;
        } catch {
          /* regenerate a missing file */
        }
      }
      imageConnection ??= await resolveModel('image');
      asset.status = 'generating';
      delete asset.error;
      await save();
      const b = asset.bounds;
      const sourceRegion = {
        x: Math.round(b.x * source.width),
        y: Math.round(b.y * source.height),
        width: Math.max(1, Math.round(b.width * source.width)),
        height: Math.max(1, Math.round(b.height * source.height)),
      };
      try {
        const output = await requestImage(
          imageConnection.provider,
          imageConnection.model,
          `Re-create ONE standalone production UI asset from the attached reference. Asset: ${asset.name}. Its source rectangle in the ${source.width}x${source.height} reference is ${JSON.stringify(sourceRegion)}. Use that region as the visual reference, but REGENERATE its content cleanly rather than returning a screenshot crop. ${asset.prompt}\nAsset preparation: faithfully preserve subject, arrangement, palette, perspective and internal interface details. Exclude surrounding page headings, descriptions, buttons and any red annotation boxes. Keep the complete subject and a small safe inset; no clipped shadows or edges. Match aspect ratio ${sourceRegion.width}:${sourceRegion.height}. Aim for at least 2x the region's display resolution when supported. ${asset.background === 'transparent' ? 'Use real transparent background, no checkerboard pattern or solid matte.' : 'Preserve the intended opaque panel/background inside this asset.'} Output only this single asset, not the whole landing page or an asset contact sheet.`,
          { bytes: image, mime, background: asset.background },
        );
        const media = await saveGeneratedMedia(project.id, output);
        Object.assign(asset, {
          url: media.url,
          width: media.width,
          height: media.height,
          status: 'completed',
        });
        await save();
      } catch (error) {
        asset.status = 'failed';
        asset.error = errorMessage(error);
        await save();
        throw new ApiError(
          502,
          `素材「${asset.name}」重建失败：${asset.error}。已完成素材会保留，重试时继续。`,
        );
      }
    }
    state.phase = 'assembling';
    await save();
    const design = assemble(project, state.draft, state.assets);
    state.phase = 'completed';
    await save();
    return design;
  } catch (error) {
    const invalidGraph = state.phase === 'analyzing' || state.phase === 'assembling';
    if (invalidGraph) delete state.draft;
    const failure =
      invalidGraph && error instanceof ApiError && error.status === 400
        ? new ApiError(502, `模型设计结构未通过验证：${errorMessage(error)}`)
        : error;
    state.phase = 'failed';
    state.error = errorMessage(failure);
    await save();
    throw failure;
  } finally {
    active.delete(file);
  }
}
