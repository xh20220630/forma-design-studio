import type { Project, DesignPage, DesignComponent } from '@forma/schema';
import type { ExportFile, ExportManifest, SyncPreview, SyncBaselines } from './types.ts';
import { errorProperty } from './errors.ts';
import { createHash, randomUUID } from 'node:crypto';
import { getStandaloneRendererSource } from '@forma/renderer/source';
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError, requireValue } from './errors.ts';
import { readJson } from './store.ts';
import { embedLocalAsset } from './assets.ts';
import { activeProjectTokens } from './design-context.ts';

export const generatedDirectory = 'forma-generated';
/**
 * 计算文本摘要，用于识别生成文件和本地文件是否发生变化。
 *
 * @param content - 文件、消息或编辑文档的正文。
 * @returns 十六进制 SHA-256 摘要。
 */
export const hash = (content: string) => createHash('sha256').update(content).digest('hex');
/**
 * 把数据转换为统一的 JSON 表达。
 *
 * @param value - 当前字段、模式或控件的取值。
 * @returns 计算得到的文本。
 */
const json = (value: unknown) => JSON.stringify(value, null, 2);

/** 导出到消费项目的 React 运行时源码；字符串内容属于生成模板。 */
const runtime = `${getStandaloneRendererSource()}

import design from './design.json';
import './tokens.css';

/**
 * 导出组件对外通知节点交互的回调，使消费项目可以接入自己的业务逻辑。
 * @param nodeId - 目标设计节点的标识。
 * @returns 无返回值；由回调提交操作或通知。
 */
type Interaction = (nodeId: string) => void;
const project = design as unknown as Project;
const pages = project.pages;
const components = project.components;
/**
 * 渲染导出项目中的页面，并在组件内部维护跳转历史和覆盖层，使原型可以独立运行。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.pageId - 目标页面的唯一标识。
 * @param props.onAction - 在动作时通知调用方，由外层决定如何更新业务状态。
 * @param props.style - 自定义内联样式。
 * @param props.className - 调用方追加的 CSS 类名。
 * @param props.mode - 当前使用的模式或操作方式。
 * @param props.variableModes - 消费项目指定的各变量集合模式，用于覆盖项目默认模式。
 * @returns 目标页面的 React 内容；页面不存在时返回 null。
 */
export function FormaPage({
  pageId = pages.find(
    /** 检查条目的prototypeStart，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (item) => item.prototypeStart,
  )?.id || pages[0]?.id,
  onAction,
  style,
  className = '',
  mode,
  variableModes,
}: {
  /** 目标页面的唯一标识。 */
  pageId?: string;
  /** 在动作时通知调用方，由外层决定如何更新业务状态。 */
  onAction?: Interaction;
  /** 自定义内联样式。 */
  style?: React.CSSProperties;
  /** 调用方追加的 CSS 类名。 */
  className?: string;
  /** 当前使用的模式或操作方式。 */
  mode?: string;
  /** 消费项目指定的各变量集合模式，用于覆盖项目默认模式。 */
  variableModes?: Record<string, string>;
}) {
  /** 界面状态：原型当前展示的页面标识。通过状态更新驱动界面刷新。 */
  const [currentPage, setCurrentPage] = React.useState(pageId);
  /** 界面状态：原型页面跳转历史，返回动作从这里取上一页。通过状态更新驱动界面刷新。 */
  const [history, setHistory] = React.useState<string[]>([]);
  /** 界面状态：当前以覆盖层显示的页面标识。通过状态更新驱动界面刷新。 */
  const [overlay, setOverlay] = React.useState<string>();
  /** 界面状态：页面跳转或动画过渡配置。通过状态更新驱动界面刷新。 */
  const [transition, setTransition] = React.useState<DesignNode['prototype']>();
  React.useEffect(
    /**
     * 在 FormaPage 的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      setCurrentPage(pageId);
      setHistory([]);
      setOverlay(undefined);
    },
    [pageId],
  );
  const activeProject = {
    ...project,
    activeMode: mode ?? project.activeMode,
    activeVariableModes: variableModes ?? project.activeVariableModes,
  };
  const page = pages.find(
    /** 检查条目的标识等于currentPage，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (item) => item.id === currentPage,
  );
  if (!page) return null;
  /**
   * 响应节点激活事件，将原型动作通知外层。
   *
   * @param node - 当前处理的设计节点。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  const activate = (node: DesignNode) => {
    onAction?.(node.id);
    const action = node.prototype;
    if (!action) return;
    setTransition(action);
    if (
      action.action === 'navigate' &&
      action.target &&
      pages.some(
        /** 检查条目的标识等于 action 的目标，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (item) => item.id === action.target,
      )
    ) {
      setHistory(
        /** 基于最新状态计算 History 的下一份值，避免连续更新时读到旧状态。 @param previous - 上一次保存或计算的值。 @returns 供 React 保存的新状态。 */
        (previous) => [...previous, currentPage!],
      );
      setCurrentPage(action.target);
      setOverlay(undefined);
    }
    if (
      action.action === 'overlay' &&
      pages.some(
        /** 检查条目的标识等于 action 的目标，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (item) => item.id === action.target,
      )
    )
      setOverlay(action.target);
    if (action.action === 'back') {
      if (overlay) setOverlay(undefined);
      else {
        setCurrentPage(history.at(-1) || pageId);
        setHistory(
          /** 基于最新状态计算 History 的下一份值，避免连续更新时读到旧状态。 @param previous - 上一次保存或计算的值。 @returns 供 React 保存的新状态。 */
          (previous) => previous.slice(0, -1),
        );
      }
    }
    if (
      action.action === 'url' &&
      /^https?:\\/\\//i.test(action.target || '') &&
      typeof window !== 'undefined'
    )
      window.open(action.target, '_blank', 'noopener,noreferrer');
  };
  const animation =
    transition?.animation && transition.animation !== 'instant'
      ? 'forma-' + transition.animation + ' ' + (transition.duration ?? 250) + 'ms ease both'
      : undefined;
  const overlayPage = pages.find(
    /** 检查条目的标识等于overlay，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (item) => item.id === overlay,
  );
  return (
    <main
      className={'forma-theme ' + className}
      data-forma-page={page.id}
      style={{
        ...getThemeStyle(activeProject),
        position: 'relative',
        width: page.width,
        minHeight: page.height,
        isolation: 'isolate',
        background: page.background || getProjectTokens(activeProject).background,
        ...style,
      }}
    >
      <div
        key={page.id}
        style={{ position: 'relative', width: page.width, height: page.height, animation }}
      >
        {page.nodes.map(
          /**
           * 转换 FormaPage 中的集合条目，供后续处理或展示。
           *
           * @param node - 当前处理的设计节点。
           * @returns 当前条目转换后的结果。
           */
          (node) => (
            <NodeView
              key={node.id}
              node={node}
              nodes={page.nodes}
              project={activeProject}
              onClick={activate}
            />
          ),
        )}
      </div>
      {overlayPage && (
        <div
          role="presentation"
          onClick={
            /** 响应 onClick 交互，将用户操作应用到FormaPage。 @returns 当前步骤的处理结果。 */
            () => setOverlay(undefined)
          }
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: '#0005',
            zIndex: 10000,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={overlayPage.name}
            onClick={
              /** 响应 onClick 交互，将用户操作应用到FormaPage。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
              (event) => event.stopPropagation()
            }
            style={{
              position: 'relative',
              width: overlayPage.width,
              height: overlayPage.height,
              background: overlayPage.background || getProjectTokens(activeProject).background,
              animation,
            }}
          >
            {overlayPage.nodes.map(
              /**
               * 转换 FormaPage 中的集合条目，供后续处理或展示。
               *
               * @param node - 当前处理的设计节点。
               * @returns 当前条目转换后的结果。
               */
              (node) => (
                <NodeView
                  key={node.id}
                  node={node}
                  nodes={overlayPage.nodes}
                  project={activeProject}
                  onClick={activate}
                />
              ),
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * 按组件标识渲染独立组件实例，并将交互事件交给消费项目处理。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.componentId - 引用的组件母版标识。
 * @param props.onAction - 在动作时通知调用方，由外层决定如何更新业务状态。
 * @param props.style - 自定义内联样式。
 * @param props.mode - 当前使用的模式或操作方式。
 * @param props.variableModes - 消费项目指定的各变量集合模式，用于覆盖项目默认模式。
 * @returns 目标组件的 React 内容；组件不存在时返回 null。
 */
export function FormaComponent({
  componentId,
  onAction,
  style,
  mode,
  variableModes,
}: {
  /** 引用的组件母版标识。 */
  componentId: string;
  /** 在动作时通知调用方，由外层决定如何更新业务状态。 */
  onAction?: Interaction;
  /** 自定义内联样式。 */
  style?: React.CSSProperties;
  /** 当前使用的模式或操作方式。 */
  mode?: string;
  /** 消费项目指定的各变量集合模式，用于覆盖项目默认模式。 */
  variableModes?: Record<string, string>;
}) {
  const component = components.find(
    /** 检查条目的标识等于组件引用，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (item) => item.id === componentId,
  );
  if (!component) return null;
  const activeProject = {
    ...project,
    activeMode: mode ?? project.activeMode,
    activeVariableModes: variableModes ?? project.activeVariableModes,
  };
  return (
    <div
      className="forma-theme"
      data-forma-component={component.id}
      style={{
        ...getThemeStyle(activeProject),
        position: 'relative',
        width: component.width,
        height: component.height,
        ...style,
      }}
    >
      {component.nodes.map(
        /**
         * 转换 FormaComponent 中的集合条目，供后续处理或展示。
         *
         * @param node - 当前处理的设计节点。
         * @returns 当前条目转换后的结果。
         */
        (node) => (
          <NodeView
            key={node.id}
            node={node}
            nodes={component.nodes}
            project={activeProject}
            onClick={
              /** 响应 onClick 交互，将用户操作应用到FormaComponent。 @param node - 当前处理的设计节点。 @returns 无返回值；通过副作用完成当前操作。 */
              (node) => onAction?.(node.id)
            }
          />
        ),
      )}
    </div>
  );
}

export const formaProject = { id: design.id, name: design.name, revision: design.revision };
export { design };
`;
/**
 * 将设计模型展开为可独立运行的 React 源码和配套数据。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 待导出的相对路径与文件内容列表。
 */
export function generateFiles(project: Project): ExportFile[] {
  const cssTokens = Object.entries(activeProjectTokens(project))
    .map(
      /**
       * 转换 generateFiles 中的集合条目，供后续处理或展示。
       *
       * @param options - 按顺序解构的当前条目。
       * @param options.key - 要访问或更新的字段名。
       * @param options.value - 当前字段、模式或控件的取值。
       * @returns 当前条目转换后的结果。
       */
      ([key, value]) =>
        `  --forma-${key.replace(
          /[A-Z]/g,
          /** 执行 generateFiles 传入的局部处理步骤，使调用处能够控制结果如何更新。 @param letter - 当前处理的字符。 @returns 计算得到的文本。 */
          (letter) => `-${letter.toLowerCase()}`,
        )}: ${typeof value === 'number' ? `${value}px` : value};`,
    )
    .join('\n');
  const embedded = new Map<string, string>();
  /**
   * 把页面和组件中的本地图片内嵌，保证导出后仍可显示。
   *
   * @param surfaces - 需要处理的页面或组件表面集合。
   * @returns 替换了本地图片引用的页面或组件集合。
   */
  const portableSurfaces = <T extends DesignPage | DesignComponent>(surfaces: T[]) =>
    surfaces.map(
      /**
       * 转换 portableSurfaces 中的集合条目，供后续处理或展示。
       *
       * @param surface - 卡片或面板的表面颜色。
       * @returns 当前条目转换后的结果。
       */
      (surface) => ({
        ...surface,
        nodes: surface.nodes.map(
          /**
           * 转换 portableSurfaces 中的集合条目，供后续处理或展示。
           *
           * @param node - 当前处理的设计节点。
           * @returns 当前条目转换后的结果。
           */
          (node) => {
            if (!node.src?.startsWith('/api/assets/')) return node;
            if (!embedded.has(node.src)) embedded.set(node.src, embedLocalAsset(node.src));
            return { ...node, src: embedded.get(node.src)! };
          },
        ),
      }),
    );
  const content = {
    id: project.id,
    name: project.name,
    revision: project.revision,
    tokens: project.tokens,
    themeModes: project.themeModes,
    activeMode: project.activeMode,
    variableCollections: project.variableCollections,
    activeVariableModes: project.activeVariableModes,
    pages: portableSurfaces(project.pages),
    components: portableSurfaces(project.components),
  };
  const files = [
    {
      path: 'tokens.css',
      content: `.forma-theme {\n${cssTokens}\n  color: var(--forma-text);\n  font-family: var(--forma-font-family);\n}\n@keyframes forma-dissolve { from { opacity: 0; } to { opacity: 1; } }\n@keyframes forma-slide { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }\n@media (prefers-reduced-motion: reduce) { .forma-theme * { animation-duration: 0.01ms !important; } }\n`,
    },
    { path: 'design.json', content: `${json(content)}\n` },
    { path: 'index.tsx', content: runtime },
    {
      path: 'README.md',
      content: `# ${project.name}\n\nGenerated by Forma. Requires React and TypeScript with resolveJsonModule enabled.\n\nImport { FormaPage, FormaComponent } from './forma-generated';\n\nRender <FormaPage pageId="${project.pages[0]?.id || ''}" onAction={handleNodeAction} />. Navigation, overlays, back actions, safe external URLs, click/hover triggers and basic dissolve/slide transitions are included. onAction also receives the clicked node ID for application behavior.\n\nPass mode="your-mode" and variableModes={{ collectionId: "mode-name" }} to choose saved theme or variable modes. Components use their saved variant IDs and instance overrides. Local PNG/JPEG/WebP/safe SVG images are embedded as data URLs.\n\nThe editor and exported bundle share the same renderer source for shapes, typography, effects, themes and instances. Keep business logic outside this folder. Revisions update these generated files; locally changed files block synchronization.\nThe renderer preserves fixed canvas coordinates. Auto-layout and constraints are applied while editing; responsive breakpoints, live application data, collaborative state and production routing must be implemented in the consuming app. Ancestor clipping uses axis-aligned bounds; rotated frame clipping, advanced vector stroke alignment and arbitrary masks are not supported.\n`,
    },
  ];
  const manifest = {
    schemaVersion: 1,
    projectId: project.id,
    revision: project.revision,
    files: Object.fromEntries(
      files.map(
        /** 转换 generateFiles 中的集合条目，供后续处理或展示。 @param file - 需要读取、写入或导入的文件。 @returns 当前条目转换后的结果。 */
        (file) => [file.path, hash(file.content)],
      ),
    ),
  };
  return [...files, { path: 'manifest.json', content: `${json(manifest)}\n` }];
}

/**
 * 检查绑定目录是否合法、可访问，避免把生成文件写到错误位置。
 *
 * @param workspacePath - 已解析的代码工作空间目录。
 * @returns 解析后的工作空间路径。
 */
export async function validateWorkspacePath(workspacePath: unknown) {
  requireValue(
    typeof workspacePath === 'string' && path.isAbsolute(workspacePath),
    '工作空间必须是已存在的绝对目录路径。',
  );
  let resolved;
  try {
    resolved = await realpath(workspacePath);
    requireValue((await lstat(resolved)).isDirectory(), '工作空间路径必须是目录。');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, '工作空间目录不存在或无法访问。');
  }
  return resolved;
}

/**
 * 检查生成目录及其路径关系，拒绝通过符号链接越出工作空间。
 *
 * @param workspacePath - 已解析的代码工作空间目录。
 * @returns 允许写入的生成目录。
 */
async function safeGeneratedRoot(workspacePath: unknown) {
  const workspaceRoot = await validateWorkspacePath(workspacePath);
  const generatedRoot = path.join(workspaceRoot, generatedDirectory);
  try {
    const metadata = await lstat(generatedRoot);
    requireValue(
      metadata.isDirectory() && !metadata.isSymbolicLink(),
      'forma-generated 必须是普通目录，不能是符号链接。',
      409,
    );
    const resolved = await realpath(generatedRoot);
    requireValue(
      path.dirname(resolved).toLowerCase() === workspaceRoot.toLowerCase(),
      '导出目录超出绑定的工作空间。',
      409,
    );
  } catch (error) {
    if (errorProperty(error, 'code') !== 'ENOENT') throw error;
  }
  return generatedRoot;
}

/**
 * 读取已有生成文件的内容，用于比较本地修改和同步基线。
 *
 * @param root - 路径解析与访问检查共同使用的根目录。
 * @param filename - 文件名称。
 * @returns 文件内容；文件不存在时返回 null。
 */
async function existingFile(root: string, filename: string) {
  requireValue(path.basename(filename) === filename, '无效的导出文件路径。');
  const target = path.join(root, filename);
  try {
    const metadata = await lstat(target);
    requireValue(
      metadata.isFile() && !metadata.isSymbolicLink(),
      `拒绝覆盖特殊文件：${filename}`,
      409,
    );
    return await readFile(target, 'utf8');
  } catch (error) {
    if (errorProperty(error, 'code') === 'ENOENT') return null;
    throw error;
  }
}

/**
 * 对比生成内容、本地文件和上次同步摘要，在写入前列出冲突。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @param arg2 - 按字段解构的输入，字段用途见对应类型定义。
 * @param arg2.includeBaselines - 是否返回文件基线，供后续应用时复核预览一致性。
 * @returns 同步预览；按选项附带后续审查需要的基线。
 */
export async function previewSync(
  project: Project,
  {
    includeBaselines = false,
  }: {
    /** 是否返回文件基线，供后续应用时复核预览一致性。 */
    includeBaselines?: boolean;
  } = {},
): Promise<SyncPreview> {
  requireValue(project.workspace?.path, '请先绑定本地目录或 GitHub 仓库。', 409);
  const root = await safeGeneratedRoot(project.workspace?.path);
  const oldManifestText = await existingFile(root, 'manifest.json');
  let manifest: ExportManifest | undefined;
  if (oldManifestText) {
    try {
      manifest = JSON.parse(oldManifestText);
    } catch {
      throw new ApiError(409, '已有导出清单损坏，请先检查 forma-generated/manifest.json。');
    }
  }
  requireValue(
    !manifest || manifest.projectId === project.id,
    '该目录已绑定另一个 Forma 项目，请选择其他工作空间。',
    409,
  );
  const files: SyncPreview['files'] = [];
  const baselines: SyncBaselines = {};
  for (const file of generateFiles(project)) {
    const before = await existingFile(root, file.path);
    baselines[file.path] = before === null ? null : hash(before);
    /** 集中维护 status 的约定值或当前状态，供相关分支保持一致。 */
    let status: SyncPreview['files'][number]['status'] =
      before === null ? 'added' : before === file.content ? 'unchanged' : 'modified';
    if (
      before !== null &&
      file.path !== 'manifest.json' &&
      before !== file.content &&
      (!manifest?.files?.[file.path] || hash(before) !== manifest.files[file.path])
    )
      status = 'conflict';
    if (before !== null && file.path === 'manifest.json' && !manifest?.files) status = 'conflict';
    files.push({ ...file, path: `${generatedDirectory}/${file.path}`, status });
  }
  return {
    files,
    revision: project.revision,
    conflicts: files
      .filter(
        /** 检查 file 的状态等于“conflict”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (file) => file.status === 'conflict',
      )
      .map(
        /** 提取 file 的路径，供后续计算或展示使用。 @param file - 需要读取、写入或导入的文件。 @returns file的路径。 */
        (file) => file.path,
      ),
    ...(includeBaselines ? { baselines } : {}),
  };
}

/**
 * 在确认没有本地冲突后写入生成文件，并更新同步清单。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 本次同步的文件和版本信息。
 */
export async function applySync(project: Project) {
  const preview = await previewSync(project, { includeBaselines: true });
  requireValue(
    !preview.conflicts.length,
    `同步已停止，以下文件有本地修改：${preview.conflicts.join('、')}`,
    409,
  );
  const root = await safeGeneratedRoot(project.workspace?.path);
  await mkdir(root, { recursive: true });
  for (const file of preview.files) {
    const filename = path.basename(file.path);
    const current = await existingFile(root, filename);
    requireValue(
      (current === null ? null : hash(current)) === preview.baselines![filename],
      `同步期间文件发生变化，已停止：${file.path}`,
      409,
    );
  }
  for (const file of preview.files.filter(
    /** 检查 file 的状态不等于“unchanged”，供集合筛选或定位使用。 @param file - 需要读取、写入或导入的文件。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (file) => file.status !== 'unchanged',
  )) {
    const filename = path.basename(file.path);
    const temporary = path.join(root, `.${filename}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, file.content, { flag: 'wx' });
      const current = await existingFile(root, filename);
      requireValue(
        (current === null ? null : hash(current)) === preview.baselines![filename],
        `同步期间文件发生变化，已停止：${file.path}`,
        409,
      );
      await rename(temporary, path.join(root, filename));
    } finally {
      await unlink(temporary).catch(
        /**
         * 处理 applySync 中的异步失败，按当前流程决定回退或继续抛出。
         *
         * @param error - 当前操作的失败信息，供界面反馈或重试判断。
         * @returns 无返回值；通过副作用完成当前操作。
         */
        (error) => {
          if (errorProperty(error, 'code') !== 'ENOENT') throw error;
        },
      );
    }
  }
  return { files: preview.files, revision: project.revision };
}

/**
 * 确认工作空间是否有同步基线，防止首次自动同步直接覆盖文件。
 *
 * @param project - 当前设计项目或工作空间项目元信息。
 * @returns 是否存在可用的同步清单。
 */
export async function hasSyncManifest(project: Project) {
  if (!project.workspace?.path) return false;
  const root = await safeGeneratedRoot(project.workspace?.path);
  const manifest = await readJson<ExportManifest | null>(path.join(root, 'manifest.json'), null);
  return manifest?.projectId === project.id;
}
