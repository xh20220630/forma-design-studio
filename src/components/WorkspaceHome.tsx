import { useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDownAZ,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  Ellipsis,
  FileUp,
  FolderGit2,
  Grid2X2,
  List,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  Star,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useStudioMotion } from "../lib/motion";
import type { DesignTemplate, Project } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { RinAvatar, RinIcon, RinIllustration } from "./brand/RinBrand";
import ProjectPreview from "./ProjectPreview";
import { RinParallax } from "./motion/RinMotion";
import { StudioSequence } from "./motion/StudioSequence";
import "./project-overview.css";

interface Props {
  projects: Project[];
  templates: DesignTemplate[];
  online: boolean;
  ready: boolean;
  saveState: string;
  query: string;
  onQuery: (value: string) => void;
  tab: string;
  onTab: (value: string) => void;
  onCreate: (template?: DesignTemplate) => void;
  onOpen: (project: Project) => void;
  onAgent: (prompt?: string) => void;
  onTemplates: () => void;
  onTheme?: () => void;
  onBind: (project: Project) => void;
  onRename: (project: Project) => void;
  onDuplicate: (project: Project) => void;
  onDelete: (project: Project) => void;
  onExport: (project: Project) => void;
  onImport: (file: File) => Promise<void>;
}

export default function WorkspaceHome(props: Props) {
  const { projects, templates, query, onQuery, tab, onTab } = props;
  const { reduced, transition } = useStudioMotion();
  const [listMode, setListMode] = useState(false);
  const [sort, setSort] = useState("updated");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("forma-favorites") || "[]");
    } catch {
      return [];
    }
  });
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const items = [...projects]
    .filter(
      (project) =>
        `${project.name} ${project.description}`.toLowerCase().includes(query.toLowerCase()) &&
        (tab !== "favorites" || favorites.includes(project.id)) &&
        (tab !== "connected" || project.workspace),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "zh")
        : Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((value) => value !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("forma-favorites", JSON.stringify(next));
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      await props.onImport(file);
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <motion.div
      className="files-page project-home"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition}
    >
      <header className="files-page-header">
        <div>
          <span className="pearl-eyebrow">YOUR CREATIVE SPACE</span>
          <h1>每一个想法，都值得成形。</h1>
          <p>和凛一起，开始今天的创作。</p>
        </div>
        <div className="files-header-actions">
          <button className="workspace-template-link" onClick={props.onTemplates}>寻找一点灵感 <ArrowRight size={15} /></button>
        </div>
      </header>

      <section className="workspace-hero workspace-hero--cinematic">
        <div className="workspace-hero-copy">
          <span className="workspace-hero-rule" />
          <h2>下一份好设计，从这里开始</h2>
          <p>从一个想法，到可以触摸的作品。<br />画布已就绪，凛陪你一起完成。</p>
          <div className="workspace-hero-actions">
          <div className="workspace-create-group">
            <Button onClick={() => props.onCreate()}><Plus size={15} />新建项目</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" aria-label="选择项目模板"><ChevronDown size={14} /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>从模板创建</DropdownMenuLabel>
                {templates.map((template) => (
                  <DropdownMenuItem key={template.id} onClick={() => props.onCreate(template)}>
                    <RinIcon kind="canvas" size={16} />{template.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={props.onTemplates}><ArrowRight />浏览全部模板</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button variant="outline" onClick={() => props.onAgent()}><MessageSquare size={17} />与凛对话</Button>
          </div>
          <span className="workspace-hero-caption">RIN × FORMA · IDEAS TAKE SHAPE</span>
        </div>
        <StudioSequence variant="foundry" showRin className="workspace-foundry" />
      </section>

      <div className="workspace-projects-heading"><h2>你的项目</h2><span>{projects.length} 个设计项目</span></div>
      <input ref={inputRef} className="sr-only" type="file" accept=".json,.forma.json" aria-label="导入 Forma 项目" onChange={upload} />

      <div className="file-section-bar">
        <Tabs value={tab} onValueChange={onTab}>
          <TabsList className="file-tabs">
            <TabsTrigger value="recent">全部项目 <span>{projects.length}</span></TabsTrigger>
            <TabsTrigger value="favorites">已收藏</TabsTrigger>
            <TabsTrigger value="connected">已连接</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="file-controls">
          <div className="file-search">
            <Search size={15} />
            <Input aria-label="搜索项目" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索项目" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="sort-button" size="icon-sm" aria-label="项目排序"><SlidersHorizontal size={15} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>排序方式</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSort("updated")}><Clock3 />最近修改{sort === "updated" && <Check className="ml-auto" />}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("name")}><ArrowDownAZ />项目名称{sort === "name" && <Check className="ml-auto" />}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="file-view-toggle" role="group" aria-label="项目显示方式">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={!listMode ? "secondary" : "ghost"} size="icon-sm" aria-label="网格视图" aria-pressed={!listMode} onClick={() => setListMode(false)}><Grid2X2 /></Button>
              </TooltipTrigger>
              <TooltipContent>网格视图</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={listMode ? "secondary" : "ghost"} size="icon-sm" aria-label="列表视图" aria-pressed={listMode} onClick={() => setListMode(true)}><List /></Button>
              </TooltipTrigger>
              <TooltipContent>列表视图</TooltipContent>
            </Tooltip>
          </div>
          <Button variant="outline" className="workspace-import" onClick={() => inputRef.current?.click()} disabled={importing}><FileUp size={15} />{importing ? "正在导入" : "导入"}</Button>
        </div>
      </div>

      <div className={listMode ? "file-list" : "file-grid"}>
        <AnimatePresence mode="popLayout">
          {items.map((project) => (
            <motion.article key={project.id} className="design-file" layout={!reduced} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
              <div
                className="design-file-preview"
                role="button"
                tabIndex={0}
                onClick={() => props.onOpen(project)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    props.onOpen(project);
                  }
                }}
                aria-label={`打开 ${project.name}`}
              >
                <div inert className="project-preview-noninteractive"><ProjectPreview project={project} /></div>
                <span className="design-file-open">打开项目 <ArrowRight size={14} /></span>
              </div>
              <div className="design-file-content">
                <div className="design-file-body">
                  <div className="design-file-name">
                    <button onClick={() => props.onOpen(project)}>{project.name}</button>
                    <span>{project.description || project.category || "未添加项目描述"}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" className="file-more" aria-label={`${project.name} 项目操作`}><Ellipsis /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>{project.name}</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => props.onOpen(project)}><RinIcon kind="canvas" size={16} />打开项目</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleFavorite(project.id)}><Star />{favorites.includes(project.id) ? "取消收藏" : "添加到收藏"}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => props.onRename(project)}><Settings2 />项目设置</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => props.onDuplicate(project)}><Copy />创建副本</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => props.onBind(project)}><FolderGit2 />连接工作空间</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => props.onExport(project)}><Download />导出项目</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => props.onDelete(project)}><Trash2 />删除项目</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="design-file-details">
                  <span>{project.pages.length} 个页面</span>
                  <span className="project-card-updated">{relativeDate(project.updatedAt)}更新</span>
                  {project.workspace && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="project-card-connection" aria-label={`${project.name} 已连接工作空间`} onClick={() => props.onBind(project)}><FolderGit2 size={14} /></button>
                      </TooltipTrigger>
                      <TooltipContent>{project.workspace.repo ?? project.workspace.path ?? "工作空间已连接"}</TooltipContent>
                    </Tooltip>
                  )}
                  <button className="project-card-favorite" aria-label={favorites.includes(project.id) ? `取消收藏 ${project.name}` : `收藏 ${project.name}`} aria-pressed={favorites.includes(project.id)} onClick={() => toggleFavorite(project.id)}>
                    <Star size={14} fill={favorites.includes(project.id) ? "currentColor" : "none"} className={favorites.includes(project.id) ? "is-favorite" : ""} />
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>

      {!items.length && (
        <div className="file-empty">
          <RinIllustration state="empty" size={116} />
          <h3>{query ? "没有找到相关项目" : tab === "favorites" ? "还没有收藏的项目" : tab === "connected" ? "还没有连接工作空间" : "创建你的第一个项目"}</h3>
          <p>{query ? "试试其他关键词，或清除搜索条件。" : tab === "favorites" ? "收藏常用项目，下次从这里快速打开。" : tab === "connected" ? "在项目菜单中连接本地目录或 GitHub 仓库。" : "从空白画布开始，也可以选择一个模板。"}</p>
          <Button variant="outline" onClick={() => {
            if (!projects.length) props.onCreate();
            else { onTab("recent"); onQuery(""); }
          }}>{!projects.length ? "新建项目" : "查看所有项目"}</Button>
        </div>
      )}

      <footer className="files-footer">
        <span><span className={`connection-dot ${props.online ? "online" : ""}`} />{!props.ready ? "正在连接…" : props.saveState === "error" ? "部分更改未保存" : props.saveState === "saved" && props.online ? "所有更改已保存" : "本地工作空间"}</span>
        <div className="workspace-footer-actions">
          <button onClick={props.onTemplates}>浏览模板 <ArrowRight size={12} /></button>
          {props.onTheme && <button onClick={props.onTheme}><RinIcon kind="theme" size={14} />Rin 工作室外观</button>}
        </div>
      </footer>
    </motion.div>
  );
}

function relativeDate(value: string) {
  const seconds = Math.max(0, (Date.now() - Date.parse(value)) / 1000);
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} 天前`;
  return new Date(value).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}
