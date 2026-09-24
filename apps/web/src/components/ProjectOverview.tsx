import type { View } from '../types';
import { useStudioMotion } from '../lib/motion';
import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Ellipsis,
  FolderGit2,
  FolderOpen,
  GitBranch,
  Github,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { DesignNode, DesignPage, Project } from '@forma/schema';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';
import { Badge } from '@forma/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@forma/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@forma/ui/dropdown-menu';
import ProjectPreview from './ProjectPreview';
import ProjectMark from './ProjectMark';
import { RinAvatar, RinIcon, RinIllustration } from './brand/RinBrand';
import { getProjectTokens } from '@forma/renderer';
import './project-overview.css';

/** ProjectOverview 的输入契约，把展示数据与交互回调交给调用方控制。 */
interface Props {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /**
   * 在打开页面时通知调用方，由外层决定如何更新业务状态。
   * @param pageId - 目标页面的唯一标识。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onOpenPage: (pageId?: string) => void;
  /**
   * 在导航时通知调用方，由外层决定如何更新业务状态。
   * @param view - 当前视图或画布相机参数。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onNavigate: (view: View) => void;
  /**
   * 在值变化时通知调用方，由外层决定如何更新业务状态。
   * @param project - 当前设计项目或工作空间项目元信息。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onChange: (project: Project) => void;
  /**
   * 在助手时通知调用方，由外层决定如何更新业务状态。
   * @param prompt - 发送给模型的生成要求。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onAgent: (prompt?: string) => void;
  /**
   * 在绑定时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onBind: () => void;
  /**
   * 在主题修改时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onTheme?: () => void;
}
/** 页面名称和尺寸等表单草稿，保存时再写回项目。 */
interface PageForm {
  /** 唯一标识，用于查找、更新和建立引用。 */
  id?: string;
  /** 面向用户展示的名称。 */
  name: string;
  /** 对象的宽度。 */
  width: number;
  /** 对象的高度。 */
  height: number;
}

/**
 * 呈现项目概览，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.onOpenPage - 在打开页面时通知调用方，由外层决定如何更新业务状态。
 * @param props.onNavigate - 在导航时通知调用方，由外层决定如何更新业务状态。
 * @param props.onChange - 在值变化时通知调用方，由外层决定如何更新业务状态。
 * @param props.onAgent - 在助手时通知调用方，由外层决定如何更新业务状态。
 * @param props.onBind - 在绑定时通知调用方，由外层决定如何更新业务状态。
 * @param props.onTheme - 在主题修改时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export default function ProjectOverview({
  project,
  onOpenPage,
  onNavigate,
  onChange,
  onAgent,
  onBind,
  onTheme,
}: Props) {
  const { reduced, transition } = useStudioMotion();
  /** 界面状态：尚未提交的表单值。通过状态更新驱动界面刷新。 */
  const [form, setForm] = useState<PageForm>();
  /** 界面状态：等待确认删除的资源标识。通过状态更新驱动界面刷新。 */
  const [deleteId, setDeleteId] = useState<string>();
  const tokens = getProjectTokens(project);
  const modeCount = Object.keys(project.themeModes ?? {}).length || 1;
  const selectedForDelete = project.pages.find(
    /** 检查页面的标识等于deleteId，供集合筛选或定位使用。 @param page - 当前正在展示或编辑的页面。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (page) => page.id === deleteId,
  );
  /**
   * 保存项目概览中的可编辑信息，成功后结束当前编辑状态。
   *
   * @param changes - 本次合并的局部变更。
   * @returns 保存操作的结果。
   */
  const saveChanges = (changes: Partial<Project>) =>
    onChange({
      ...project,
      ...changes,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
      status: 'in-progress',
    });
  /**
   * 根据表单创建页面并关联到项目，供后续进入画布编辑。
   * @returns 创建操作的结果。
   */
  const createPage = () =>
    setForm({
      name: `页面 ${project.pages.length + 1}`,
      width: 1440,
      height: 1000,
    });
  /**
   * 把页面表单中的名称或尺寸保存回项目。
   * @returns 保存操作的结果。
   */
  const savePage = () => {
    if (!form?.name.trim()) return;
    if (form.id) {
      saveChanges({
        pages: project.pages.map(
          /** 转换 savePage 中的集合条目，供后续处理或展示。 @param page - 当前正在展示或编辑的页面。 @returns 当前条目转换后的结果。 */
          (page) => (page.id === form.id ? { ...page, name: form.name.trim() } : page),
        ),
      });
      setForm(undefined);
      return;
    }
    const page: DesignPage = {
      id: `page-${crypto.randomUUID()}`,
      name: form.name.trim(),
      width: form.width,
      height: form.height,
      background: tokens.background,
      nodes: [],
    };
    saveChanges({ pages: [...project.pages, page] });
    setForm(undefined);
    onOpenPage(page.id);
  };
  /**
   * 复制页面及图层并重建标识，防止副本和原页面发生引用冲突。
   *
   * @param page - 当前正在展示或编辑的页面。
   * @returns 复制页面操作的结果。
   */
  const duplicatePage = (page: DesignPage) => {
    const id = `page-${crypto.randomUUID()}`;
    const nodeIds = new Map(
      page.nodes.map(
        /** 转换 duplicatePage 中的集合条目，供后续处理或展示。 @param node - 当前处理的设计节点。 @returns 当前条目转换后的结果。 */
        (node) => [node.id, `node-${crypto.randomUUID()}`],
      ),
    );
    const copy: DesignPage = {
      ...structuredClone(page),
      id,
      name: `${page.name} 副本`,
      prototypeStart: false,
      nodes: page.nodes.map(
        /**
         * 转换 duplicatePage 中的集合条目，供后续处理或展示。
         *
         * @param node - 当前处理的设计节点。
         * @returns 当前条目转换后的结果。
         */
        (node) => ({
          ...structuredClone(node),
          id: nodeIds.get(node.id)!,
          parentId: node.parentId ? nodeIds.get(node.parentId) : undefined,
          prototype:
            node.prototype?.target === page.id &&
            ['navigate', 'overlay'].includes(node.prototype.action)
              ? { ...node.prototype, target: id }
              : node.prototype,
        }),
      ),
    };
    const index = project.pages.findIndex(
      /** 检查条目的标识等于页面的标识，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (item) => item.id === page.id,
    );
    const pages = [...project.pages];
    pages.splice(index + 1, 0, copy);
    saveChanges({ pages });
  };
  /**
   * 移除目标页面并调整当前页，确保编辑器仍有可用页面。
   * @returns 删除页面操作的结果。
   */
  const deletePage = () => {
    if (!deleteId || project.pages.length < 2) return;
    /**
     * 清除页面上的既有链接关系，使页面不再沿用旧跳转配置。
     *
     * @param node - 当前处理的设计节点。
     * @returns 操作结果。
     */
    const clearLink = (node: DesignNode): DesignNode =>
      node.prototype?.target === deleteId && ['navigate', 'overlay'].includes(node.prototype.action)
        ? { ...node, prototype: undefined }
        : node;
    const pages = project.pages
      .filter(
        /** 检查页面的标识不等于deleteId，供集合筛选或定位使用。 @param page - 当前正在展示或编辑的页面。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (page) => page.id !== deleteId,
      )
      .map(
        /** 转换 deletePage 中的集合条目，供后续处理或展示。 @param page - 当前正在展示或编辑的页面。 @param index - 空间查询索引或当前条目的位置。 @returns 当前条目转换后的结果。 */
        (page, index) => ({
          ...page,
          nodes: page.nodes.map(clearLink),
          ...(selectedForDelete?.prototypeStart && index === 0 ? { prototypeStart: true } : {}),
        }),
      );
    saveChanges({
      pages,
      components: project.components.map(
        /** 转换 deletePage 中的集合条目，供后续处理或展示。 @param component - 当前组件母版或组件规范。 @returns 当前条目转换后的结果。 */
        (component) => ({
          ...component,
          nodes: component.nodes.map(clearLink),
        }),
      ),
      comments: project.comments?.filter(
        /** 检查 comment 的页面标识不等于deleteId，供集合筛选或定位使用。 @param comment - 当前页面评论。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
        (comment) => comment.pageId !== deleteId,
      ),
    });
    setDeleteId(undefined);
  };
  return (
    <motion.div
      className="project-overview"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition}
    >
      <header className="project-overview-header">
        <div className="project-overview-identity">
          <ProjectMark project={project} size={40} />
          <div>
            <div className="project-overview-title">
              <h1>{project.name}</h1>
              <Badge variant="outline">
                {project.status === 'synced'
                  ? '已同步'
                  : project.status === 'draft'
                    ? '草稿'
                    : '设计中'}
              </Badge>
            </div>
            <p>
              {project.description || `${project.pages.length} 个页面 · 版本 ${project.revision}`}
            </p>
          </div>
        </div>
        <div className="project-overview-actions">
          <Button
            variant="outline"
            className="project-rin-button"
            aria-label="与凛 Rin 讨论当前项目"
            onClick={
              /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
              () => onAgent('请分析当前项目的页面、组件和主题，给出下一步设计建议。')
            }
          >
            <RinAvatar size={24} />
            与凛对话
          </Button>
          <Button
            onClick={
              /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
              () => onOpenPage()
            }
          >
            打开画布
            <ArrowUpRight size={15} />
          </Button>
        </div>
      </header>
      <div className="project-overview-body">
        <div className="project-overview-main">
          <section className="project-pages-section">
            <div className="project-section-heading">
              <div>
                <h2>设计页面</h2>
              </div>
              <Button variant="outline" size="sm" onClick={createPage}>
                <Plus size={14} />
                新建页面
              </Button>
            </div>
            <div
              className={`project-pages-grid ${project.pages.length === 1 ? 'single-page' : ''}`}
            >
              {project.pages.map(
                /**
                 * 转换项目概览中的集合条目，供后续处理或展示。
                 *
                 * @param page - 当前正在展示或编辑的页面。
                 * @param index - 空间查询索引或当前条目的位置。
                 * @returns 当前条目转换后的结果。
                 */
                (page, index) => (
                  <motion.article
                    className="project-page-card"
                    key={page.id}
                    layout={!reduced}
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={transition}
                  >
                    <div
                      className="project-page-preview"
                      role="button"
                      tabIndex={0}
                      aria-label={`打开页面 ${page.name}`}
                      onClick={
                        /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => onOpenPage(page.id)
                      }
                      onKeyDown={
                        /**
                         * 响应 onKeyDown 交互，将用户操作应用到项目概览。
                         *
                         * @param event - 当前事件及其触发位置。
                         * @returns 无返回值；通过副作用完成当前操作。
                         */
                        (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onOpenPage(page.id);
                          }
                        }
                      }
                    >
                      <div inert className="project-preview-noninteractive">
                        <ProjectPreview project={{ ...project, pages: [page] }} />
                      </div>
                      <span className="project-page-open">
                        打开页面
                        <ArrowUpRight size={13} />
                      </span>
                      {page.nodes.length === 0 && (
                        <div className="project-page-blank">
                          <RinIllustration state="empty" size={88} />
                          <span>空白页面</span>
                        </div>
                      )}
                    </div>
                    <div className="project-page-info">
                      <span className="project-page-icon">
                        <RinIcon kind="canvas" size={16} />
                      </span>
                      <div>
                        <button
                          onClick={
                            /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
                            () => onOpenPage(page.id)
                          }
                        >
                          {page.name}
                        </button>
                        <small>
                          {page.width} × {page.height} · {page.nodes.length} 个图层
                        </small>
                      </div>
                      {(page.prototypeStart ||
                        (index === 0 &&
                          !project.pages.some(
                            /** 检查条目的prototypeStart，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                            (item) => item.prototypeStart,
                          ))) && <Badge variant="secondary">首页</Badge>}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`${page.name} 页面操作`}
                          >
                            <Ellipsis size={17} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={
                              /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
                              () => onOpenPage(page.id)
                            }
                          >
                            <RinIcon kind="canvas" size={14} />
                            打开页面
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={
                              /**
                               * 响应 onClick 交互，将用户操作应用到项目概览。
                               * @returns 当前步骤的处理结果。
                               */
                              () =>
                                setForm({
                                  id: page.id,
                                  name: page.name,
                                  width: page.width,
                                  height: page.height,
                                })
                            }
                          >
                            <Pencil size={14} />
                            重命名
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={
                              /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
                              () => duplicatePage(page)
                            }
                          >
                            <Copy size={14} />
                            复制页面
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={project.pages.length < 2}
                            onClick={
                              /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 当前步骤的处理结果。 */
                              () => setDeleteId(page.id)
                            }
                          >
                            <Trash2 size={14} />
                            {project.pages.length < 2 ? '至少保留一个页面' : '删除页面'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.article>
                ),
              )}
              <button className="project-new-page-card" onClick={createPage}>
                <Plus size={17} />
                <strong>新建页面</strong>
                <span>添加一个画布</span>
              </button>
            </div>
          </section>
        </div>
        <aside className="project-overview-sidebar">
          <section className="project-design-system">
            <header>
              <h2>设计系统</h2>
              <button
                onClick={
                  /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
                  () => onNavigate('tokens')
                }
                aria-label="查看项目设计系统"
              >
                <ArrowUpRight size={16} />
              </button>
            </header>
            <button
              className="project-theme-foundation"
              onClick={
                /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
                () => onNavigate('tokens')
              }
            >
              <span className="project-card-label">
                主题色彩 <small>{modeCount} 个模式</small>
              </span>
              <span className="project-token-palette">
                {[tokens.primary, tokens.background, tokens.surface, tokens.text].map(
                  /** 转换项目概览中的集合条目，供后续处理或展示。 @param color - 文字或视觉元素的颜色。 @param index - 空间查询索引或当前条目的位置。 @returns 当前条目转换后的结果。 */
                  (color, index) => (
                    <i key={index} style={{ background: color }} title={color} />
                  ),
                )}
              </span>
              <span className="project-font-preview">
                <b>Aa</b>
                <span>
                  <strong>{tokens.fontFamily.split(',')[0]}</strong>
                  <small>
                    {project.activeMode || '默认主题'} · {tokens.radius}px 圆角
                  </small>
                </span>
                <ArrowUpRight size={13} />
              </span>
            </button>
            <div className="project-component-directory">
              <span className="project-card-label">
                组件{' '}
                <button
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
                    () => onNavigate('components')
                  }
                >
                  查看全部 <ArrowRight size={12} />
                </button>
              </span>
              {project.components.length ? (
                project.components.slice(0, 3).map(
                  /**
                   * 转换项目概览中的集合条目，供后续处理或展示。
                   *
                   * @param component - 当前组件母版或组件规范。
                   * @returns 当前条目转换后的结果。
                   */
                  (component) => (
                    <button
                      key={component.id}
                      className="project-component-entry"
                      onClick={
                        /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => onNavigate('components')
                      }
                    >
                      <RinIcon kind="components" size={17} />
                      <span>{component.name}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  ),
                )
              ) : (
                <button
                  className="project-component-entry"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
                    () => onNavigate('components')
                  }
                >
                  <Plus size={15} />
                  创建第一个组件
                  <ArrowUpRight size={13} />
                </button>
              )}
            </div>
          </section>

          <button
            className="project-rin-note"
            onClick={
              /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
              () =>
                onAgent('请检查当前项目的视觉一致性，分析颜色、排版和组件使用，并提出改进建议。')
            }
          >
            <img src="/brand/rin/v4/rin-full-body-640.webp" alt="凛 Rin" decoding="async" />
            <span>
              <small>RIN’S DESIGN NOTE</small>
              <strong>
                下一步，
                <br />
                让细节更统一。
              </strong>
              <span>
                和凛一起检查设计 <ArrowRight size={13} />
              </span>
            </span>
          </button>

          <section className="project-workspace-panel">
            <header>
              {project.workspace?.kind === 'github' ? (
                <Github size={17} />
              ) : (
                <FolderGit2 size={17} />
              )}
              <h2>代码工作空间</h2>
              <Badge variant="outline">{project.workspace ? '已绑定' : '未绑定'}</Badge>
            </header>
            {project.workspace ? (
              <>
                <div className="project-workspace-location">
                  <FolderOpen size={16} />
                  <code>{project.workspace.repo ?? project.workspace.path}</code>
                </div>
                <dl>
                  <dt>类型</dt>
                  <dd>{project.workspace.kind === 'github' ? 'GitHub 仓库' : '本地目录'}</dd>
                  {project.workspace.branch && (
                    <>
                      <dt>分支</dt>
                      <dd>
                        <GitBranch size={12} />
                        {project.workspace.branch}
                      </dd>
                    </>
                  )}
                  <dt>自动同步</dt>
                  <dd>{project.workspace.autoSync ? '已开启' : '未开启'}</dd>
                  <dt>同步目录</dt>
                  <dd>forma-generated/</dd>
                </dl>
                <Button variant="outline" className="project-full-button" onClick={onBind}>
                  <Link2 size={14} />
                  更改工作空间
                </Button>
                <Button
                  variant="ghost"
                  className="project-full-button"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 无返回值；通过副作用完成当前操作。 */
                    () => onNavigate('sync')
                  }
                >
                  查看同步变更
                  <ArrowRight size={14} />
                </Button>
              </>
            ) : (
              <>
                <p>连接本地目录或 GitHub 仓库，让设计变更同步成为应用代码。</p>
                <Button variant="outline" className="project-full-button" onClick={onBind}>
                  <Link2 size={14} />
                  绑定工作空间
                </Button>
              </>
            )}
          </section>
          {onTheme && (
            <button className="project-appearance-link" onClick={onTheme}>
              <RinIcon kind="theme" size={16} />
              Rin 工作室外观
              <ArrowUpRight size={13} />
            </button>
          )}
        </aside>
      </div>
      <Dialog
        open={!!form}
        onOpenChange={
          /**
           * 响应 onOpenChange 交互，将用户操作应用到项目概览。
           *
           * @param open - 弹层或面板当前是否打开。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          (open) => {
            if (!open) setForm(undefined);
          }
        }
      >
        <DialogContent className="project-page-dialog">
          <DialogHeader>
            <DialogTitle>{form?.id ? '重命名页面' : '新建页面'}</DialogTitle>
            <DialogDescription>{project.name} · 新页面共享此项目的组件库和主题。</DialogDescription>
          </DialogHeader>
          {form && (
            <form
              className="project-page-form"
              onSubmit={
                /**
                 * 响应 onSubmit 交互，将用户操作应用到项目概览。
                 *
                 * @param event - 当前事件及其触发位置。
                 * @returns 无返回值；通过副作用完成当前操作。
                 */
                (event) => {
                  event.preventDefault();
                  savePage();
                }
              }
            >
              <label>
                页面名称
                <Input
                  value={form.name}
                  maxLength={200}
                  autoFocus
                  onChange={
                    /** 响应 onChange 交互，将用户操作应用到项目概览。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
                    (event) => setForm({ ...form, name: event.target.value })
                  }
                  required
                />
              </label>
              {!form.id && (
                <div>
                  <label>
                    宽度
                    <Input
                      type="number"
                      min={1}
                      max={10000}
                      value={form.width}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到项目概览。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
                        (event) =>
                          setForm({
                            ...form,
                            width: Math.min(10000, Math.max(1, Number(event.target.value) || 1)),
                          })
                      }
                    />
                  </label>
                  <label>
                    高度
                    <Input
                      type="number"
                      min={1}
                      max={10000}
                      value={form.height}
                      onChange={
                        /** 响应 onChange 交互，将用户操作应用到项目概览。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
                        (event) =>
                          setForm({
                            ...form,
                            height: Math.min(10000, Math.max(1, Number(event.target.value) || 1)),
                          })
                      }
                    />
                  </label>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 当前步骤的处理结果。 */
                    () => setForm(undefined)
                  }
                >
                  取消
                </Button>
                <Button type="submit" disabled={!form.name.trim()}>
                  {form.id ? <Check size={14} /> : <Plus size={14} />}
                  {form.id ? '保存名称' : '创建并打开'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteId}
        onOpenChange={
          /**
           * 响应 onOpenChange 交互，将用户操作应用到项目概览。
           *
           * @param open - 弹层或面板当前是否打开。
           * @returns 无返回值；通过副作用完成当前操作。
           */
          (open) => {
            if (!open) setDeleteId(undefined);
          }
        }
      >
        <DialogContent className="project-page-dialog">
          <DialogHeader>
            <DialogTitle>删除“{selectedForDelete?.name}”？</DialogTitle>
            <DialogDescription>
              此页面的图层、评论和指向此页面的原型连接将被移除。项目的其他页面、组件和主题会保留。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={
                /** 响应 onClick 交互，将用户操作应用到项目概览。 @returns 当前步骤的处理结果。 */
                () => setDeleteId(undefined)
              }
            >
              取消
            </Button>
            <Button variant="destructive" disabled={project.pages.length < 2} onClick={deletePage}>
              删除页面
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
