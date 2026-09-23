import type { View } from "../types";
import { useStudioMotion } from "../lib/motion";
import { useState } from "react";
import { motion } from "motion/react";
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
} from "lucide-react";
import type { DesignNode, DesignPage, Project } from "@forma/schema";
import { Button } from "@forma/ui/button";
import { Input } from "@forma/ui/input";
import { Badge } from "@forma/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@forma/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@forma/ui/dropdown-menu";
import ProjectPreview from "./ProjectPreview";
import ProjectMark from "./ProjectMark";
import { RinAvatar, RinIcon, RinIllustration } from "./brand/RinBrand";
import { getProjectTokens } from "@forma/renderer";
import "./project-overview.css";

interface Props {
  project: Project;
  onOpenPage: (pageId?: string) => void;
  onNavigate: (view: View) => void;
  onChange: (project: Project) => void;
  onAgent: (prompt?: string) => void;
  onBind: () => void;
  onTheme?: () => void;
}
interface PageForm {
  id?: string;
  name: string;
  width: number;
  height: number;
}

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
  const [form, setForm] = useState<PageForm>();
  const [deleteId, setDeleteId] = useState<string>();
  const tokens = getProjectTokens(project);
  const modeCount = Object.keys(project.themeModes ?? {}).length || 1;
  const selectedForDelete = project.pages.find((page) => page.id === deleteId);
  const saveChanges = (changes: Partial<Project>) =>
    onChange({
      ...project,
      ...changes,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
      status: "in-progress",
    });
  const createPage = () =>
    setForm({
      name: `页面 ${project.pages.length + 1}`,
      width: 1440,
      height: 1000,
    });
  const savePage = () => {
    if (!form?.name.trim()) return;
    if (form.id) {
      saveChanges({
        pages: project.pages.map((page) =>
          page.id === form.id ? { ...page, name: form.name.trim() } : page,
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
  const duplicatePage = (page: DesignPage) => {
    const id = `page-${crypto.randomUUID()}`;
    const nodeIds = new Map(
      page.nodes.map((node) => [node.id, `node-${crypto.randomUUID()}`]),
    );
    const copy: DesignPage = {
      ...structuredClone(page),
      id,
      name: `${page.name} 副本`,
      prototypeStart: false,
      nodes: page.nodes.map((node) => ({
        ...structuredClone(node),
        id: nodeIds.get(node.id)!,
        parentId: node.parentId ? nodeIds.get(node.parentId) : undefined,
        prototype:
          node.prototype?.target === page.id &&
          ["navigate", "overlay"].includes(node.prototype.action)
            ? { ...node.prototype, target: id }
            : node.prototype,
      })),
    };
    const index = project.pages.findIndex((item) => item.id === page.id);
    const pages = [...project.pages];
    pages.splice(index + 1, 0, copy);
    saveChanges({ pages });
  };
  const deletePage = () => {
    if (!deleteId || project.pages.length < 2) return;
    const clearLink = (node: DesignNode): DesignNode =>
      node.prototype?.target === deleteId &&
      ["navigate", "overlay"].includes(node.prototype.action)
        ? { ...node, prototype: undefined }
        : node;
    const pages = project.pages
      .filter((page) => page.id !== deleteId)
      .map((page, index) => ({
        ...page,
        nodes: page.nodes.map(clearLink),
        ...(selectedForDelete?.prototypeStart && index === 0
          ? { prototypeStart: true }
          : {}),
      }));
    saveChanges({
      pages,
      components: project.components.map((component) => ({
        ...component,
        nodes: component.nodes.map(clearLink),
      })),
      comments: project.comments?.filter(
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
                {project.status === "synced"
                  ? "已同步"
                  : project.status === "draft"
                    ? "草稿"
                    : "设计中"}
              </Badge>
            </div>
            <p>{project.description || `${project.pages.length} 个页面 · 版本 ${project.revision}`}</p>
          </div>
        </div>
        <div className="project-overview-actions">
          <Button variant="outline" className="project-rin-button" aria-label="与凛 Rin 讨论当前项目" onClick={() => onAgent("请分析当前项目的页面、组件和主题，给出下一步设计建议。") }>
            <RinAvatar size={24} />
            与凛对话
          </Button>
          <Button onClick={() => onOpenPage()}>
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
                <h2>
                  设计页面
                </h2>
              </div>
              <Button variant="outline" size="sm" onClick={createPage}>
                <Plus size={14} />
                新建页面
              </Button>
            </div>
            <div
              className={`project-pages-grid ${project.pages.length === 1 ? "single-page" : ""}`}
            >
              {project.pages.map((page, index) => (
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
                    onClick={() => onOpenPage(page.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenPage(page.id);
                      }
                    }}
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
                      <button onClick={() => onOpenPage(page.id)}>
                        {page.name}
                      </button>
                      <small>
                        {page.width} × {page.height} · {page.nodes.length}{" "}
                        个图层
                      </small>
                    </div>
                    {(page.prototypeStart ||
                      (index === 0 &&
                        !project.pages.some(
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
                        <DropdownMenuItem onClick={() => onOpenPage(page.id)}>
                          <RinIcon kind="canvas" size={14} />
                          打开页面
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
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
                        <DropdownMenuItem onClick={() => duplicatePage(page)}>
                          <Copy size={14} />
                          复制页面
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={project.pages.length < 2}
                          onClick={() => setDeleteId(page.id)}
                        >
                          <Trash2 size={14} />
                          {project.pages.length < 2
                            ? "至少保留一个页面"
                            : "删除页面"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.article>
              ))}
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
                onClick={() => onNavigate("tokens")}
                aria-label="查看项目设计系统"
              >
                <ArrowUpRight size={16} />
              </button>
            </header>
            <button
              className="project-theme-foundation"
              onClick={() => onNavigate("tokens")}
            >
              <span className="project-card-label">
                主题色彩 <small>{modeCount} 个模式</small>
              </span>
              <span className="project-token-palette">
                {[
                  tokens.primary,
                  tokens.background,
                  tokens.surface,
                  tokens.text,
                ].map((color, index) => (
                  <i key={index} style={{ background: color }} title={color} />
                ))}
              </span>
              <span className="project-font-preview">
                <b>Aa</b>
                <span>
                  <strong>{tokens.fontFamily.split(",")[0]}</strong>
                  <small>
                    {project.activeMode || "默认主题"} · {tokens.radius}px 圆角
                  </small>
                </span>
                <ArrowUpRight size={13} />
              </span>
            </button>
            <div className="project-component-directory">
              <span className="project-card-label">
                组件{" "}
                <button onClick={() => onNavigate("components")}>
                  查看全部 <ArrowRight size={12} />
                </button>
              </span>
              {project.components.length ? (
                project.components.slice(0, 3).map((component) => (
                  <button
                    key={component.id}
                    className="project-component-entry"
                    onClick={() => onNavigate("components")}
                  >
                    <RinIcon kind="components" size={17} />
                    <span>{component.name}</span>
                    <ArrowUpRight size={13} />
                  </button>
                ))
              ) : (
                <button
                  className="project-component-entry"
                  onClick={() => onNavigate("components")}
                >
                  <Plus size={15} />
                  创建第一个组件
                  <ArrowUpRight size={13} />
                </button>
              )}
            </div>
          </section>

          <button className="project-rin-note" onClick={() => onAgent("请检查当前项目的视觉一致性，分析颜色、排版和组件使用，并提出改进建议。") }>
            <img src="/brand/rin/v4/rin-full-body-640.webp" alt="凛 Rin" decoding="async" />
            <span><small>RIN’S DESIGN NOTE</small><strong>下一步，<br />让细节更统一。</strong><span>和凛一起检查设计 <ArrowRight size={13} /></span></span>
          </button>

          <section className="project-workspace-panel">
            <header>
              {project.workspace?.kind === "github" ? (
                <Github size={17} />
              ) : (
                <FolderGit2 size={17} />
              )}
              <h2>代码工作空间</h2>
              <Badge variant="outline">
                {project.workspace ? "已绑定" : "未绑定"}
              </Badge>
            </header>
            {project.workspace ? (
              <>
                <div className="project-workspace-location">
                  <FolderOpen size={16} />
                  <code>
                    {project.workspace.repo ?? project.workspace.path}
                  </code>
                </div>
                <dl>
                  <dt>类型</dt>
                  <dd>
                    {project.workspace.kind === "github"
                      ? "GitHub 仓库"
                      : "本地目录"}
                  </dd>
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
                  <dd>{project.workspace.autoSync ? "已开启" : "未开启"}</dd>
                  <dt>同步目录</dt>
                  <dd>forma-generated/</dd>
                </dl>
                <Button
                  variant="outline"
                  className="project-full-button"
                  onClick={onBind}
                >
                  <Link2 size={14} />
                  更改工作空间
                </Button>
                <Button
                  variant="ghost"
                  className="project-full-button"
                  onClick={() => onNavigate("sync")}
                >
                  查看同步变更
                  <ArrowRight size={14} />
                </Button>
              </>
            ) : (
              <>
                <p>连接本地目录或 GitHub 仓库，让设计变更同步成为应用代码。</p>
                <Button
                  variant="outline"
                  className="project-full-button"
                  onClick={onBind}
                >
                  <Link2 size={14} />
                  绑定工作空间
                </Button>
              </>
            )}
          </section>
          {onTheme && (
            <button className="project-appearance-link" onClick={onTheme}>
              <RinIcon kind="theme" size={16} />Rin 工作室外观<ArrowUpRight size={13} />
            </button>
          )}
        </aside>
      </div>
      <Dialog
        open={!!form}
        onOpenChange={(open) => {
          if (!open) setForm(undefined);
        }}
      >
        <DialogContent className="project-page-dialog">
          <DialogHeader>
            <DialogTitle>{form?.id ? "重命名页面" : "新建页面"}</DialogTitle>
            <DialogDescription>
              {project.name} · 新页面共享此项目的组件库和主题。
            </DialogDescription>
          </DialogHeader>
          {form && (
            <form
              className="project-page-form"
              onSubmit={(event) => {
                event.preventDefault();
                savePage();
              }}
            >
              <label>
                页面名称
                <Input
                  value={form.name}
                  maxLength={200}
                  autoFocus
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
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
                      onChange={(event) =>
                        setForm({
                          ...form,
                          width: Math.min(
                            10000,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
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
                      onChange={(event) =>
                        setForm({
                          ...form,
                          height: Math.min(
                            10000,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
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
                  onClick={() => setForm(undefined)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={!form.name.trim()}>
                  {form.id ? <Check size={14} /> : <Plus size={14} />}
                  {form.id ? "保存名称" : "创建并打开"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(undefined);
        }}
      >
        <DialogContent className="project-page-dialog">
          <DialogHeader>
            <DialogTitle>删除“{selectedForDelete?.name}”？</DialogTitle>
            <DialogDescription>
              此页面的图层、评论和指向此页面的原型连接将被移除。项目的其他页面、组件和主题会保留。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(undefined)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={project.pages.length < 2}
              onClick={deletePage}
            >
              删除页面
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
