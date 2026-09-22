import { useStudioMotion } from "../lib/motion";
import { motion, AnimatePresence } from "motion/react";
import { RinAvatar, RinIllustration, RinAssembly, RinIcon } from "./brand/RinBrand";
import { RinTaskActivity } from "./motion/RinMotion";
import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  Download,
  FileCode2,
  FolderGit2,
  FolderOpen,
  GitBranch,
  Github,
  Image,
  Layers3,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Palette,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
} from "lucide-react";
import type {
  DesignTemplate,
  Project,
  ProviderSettings,
  ThemeTokens,
} from "../types";
import { api, downloadJson } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Modal from "./Modal";
import "./workflow.css";

type Notify = (message: string, error?: boolean) => void;
type Mutated = { project?: Project };
type SyncFile = {
  path: string;
  content: string;
  status: "added" | "modified" | "unchanged" | "conflict";
};
function WorkflowSurface({ children }: { children: ReactNode }) {
  const { reduced, expressive, transition } = useStudioMotion();
  return (
    <motion.section
      className="wf-view"
      initial={reduced ? false : { opacity: 0, y: expressive ? 12 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
    >
      {children}
    </motion.section>
  );
}
function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="wf-heading">
      <div>
        <h1>
          <RinIcon
            kind={
              title.includes("同步")
                ? "sync"
                : title.includes("Agent")
                  ? "agent"
                  : "tokens"
            }
            size={24}
            variant="sculptural"
          />
          {title}
        </h1>
        <p>{description}</p>
      </div>
      <div>{children}</div>
    </header>
  );
}
function PanelHeader({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="wf-panel-header">
      {icon}
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}

export function SettingsView({
  settings,
  onSettings,
  notify,
  projects,
  onExport,
}: {
  settings: ProviderSettings;
  onSettings: (settings: ProviderSettings) => void;
  notify: Notify;
  projects: Project[];
  onExport: () => void;
}) {
  const { reduced, expressive, transition } = useStudioMotion();
  const [section, setSection] = useState("connection");
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [key, setKey] = useState("");
  const [textModel, setTextModel] = useState(settings.textModel);
  const [imageModel, setImageModel] = useState(settings.imageModel);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    state: "success" | "error";
    message: string;
  }>();
  useEffect(() => {
    setBaseUrl(settings.baseUrl);
    setTextModel(settings.textModel);
    setImageModel(settings.imageModel);
  }, [settings]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFeedback(undefined);
    try {
      const response = await api<ProviderSettings>("/settings", {
        baseUrl,
        textModel,
        imageModel,
        ...(key.trim() ? { apiKey: key.trim() } : {}),
      });
      onSettings(response);
      setKey("");
      setFeedback({
        state: "success",
        message: "模型连接已保存，下一次生成将使用此配置。",
      });
      notify("模型配置已保存");
    } catch (error) {
      const message = (error as Error).message;
      setFeedback({ state: "error", message });
      notify(message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <WorkflowSurface>
      <Heading title="设置" description="让工具，按你的方式工作。">
        <Badge variant="outline" className="wf-provider-status">
          <i data-ready={settings.configured} />
          {settings.configured ? "模型已配置" : "模型未配置"}
        </Badge>
      </Heading>
      <div className="wf-settings-layout">
        <nav className="wf-settings-nav" aria-label="设置分类">
          <span>工作空间设置</span>
          {[
            {
              id: "connection",
              label: "模型连接",
              icon: <Sparkles size={16} />,
            },
            {
              id: "workspace",
              label: "工作空间",
              icon: <FolderOpen size={16} />,
            },
            {
              id: "privacy",
              label: "数据与隐私",
              icon: <ShieldCheck size={16} />,
            },
          ].map((item) => (
            <button
              key={item.id}
              disabled={busy}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <div className="settings-rin-note"><img src="/brand/rin/v4/rin-full-body-640.webp" alt="凛 Rin" loading="lazy" /><span>连接就绪，<br />灵感随时开始。</span></div>
        </nav>
        <div className="wf-settings-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              initial={reduced ? false : { opacity: 0, y: expressive ? 10 : 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -3 }}
              transition={transition}
            >
              {section === "connection" && (
                <form className="wf-panel" onSubmit={save}>
                  <PanelHeader
                    title="模型连接"
                    description="连接兼容 OpenAI API 的模型服务。"
                    icon={<RinAvatar size={28} />}
                  />
                  <div className="wf-settings-group">
                    <div className="wf-settings-group-label">
                      <h3>服务地址</h3>
                      <p>图片生成、主题与视觉还原共用此连接。</p>
                    </div>
                    <div className="wf-settings-fields">
                      <label>
                        API Base URL
                        <Input
                          type="url"
                          required
                          value={baseUrl}
                          onChange={(event) => setBaseUrl(event.target.value)}
                          placeholder="https://api.example.com/v1"
                        />
                      </label>
                      <label>
                        API Key
                        <Input
                          type="password"
                          autoComplete="new-password"
                          value={key}
                          onChange={(event) => setKey(event.target.value)}
                          placeholder={
                            settings.configured
                              ? "留空以保留已保存的密钥"
                              : "输入 API Key"
                          }
                        />
                        <small>
                          <LockKeyhole size={12} />
                          密钥保存在本地服务端
                        </small>
                      </label>
                    </div>
                  </div>
                  <div className="wf-settings-group">
                    <div className="wf-settings-group-label">
                      <h3>模型选择</h3>
                      <p>为不同的设计阶段指定模型。</p>
                    </div>
                    <div className="wf-settings-fields">
                      <label>
                        文本 / 视觉模型
                        <Input
                          required
                          value={textModel}
                          onChange={(event) => setTextModel(event.target.value)}
                          placeholder="支持图片输入的模型 ID"
                        />
                        <small>
                          用于主题生成与设计图还原，需支持视觉输入和 JSON 输出。
                        </small>
                      </label>
                      <label>
                        图片生成模型
                        <Input
                          required
                          value={imageModel}
                          onChange={(event) =>
                            setImageModel(event.target.value)
                          }
                          placeholder="图片模型 ID"
                        />
                        <small>用于第一阶段的 UI 设计图生成。</small>
                      </label>
                    </div>
                  </div>
                  {feedback && (
                    <div
                      className={"wf-operation-result is-" + feedback.state}
                      role={feedback.state === "error" ? "alert" : "status"}
                    >
                      <RinIllustration state={feedback.state} size={36} />
                      <p>{feedback.message}</p>
                    </div>
                  )}
                  <footer className="wf-panel-footer">
                    <span>更改只在保存后生效</span>
                    <Button type="submit" disabled={busy}>
                      {busy ? (
                        <LoaderCircle size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      保存配置
                    </Button>
                  </footer>
                </form>
              )}
              {section === "workspace" && (
                <section className="wf-panel">
                  <PanelHeader
                    title="工作空间数据"
                    description="所有项目、页面和工作空间连接的本地副本。"
                    icon={<FolderOpen size={19} />}
                  />
                  <div className="wf-stats">
                    <div>
                      <strong>{projects.length}</strong>
                      <span>项目</span>
                    </div>
                    <div>
                      <strong>
                        {projects.reduce(
                          (total, project) => total + project.pages.length,
                          0,
                        )}
                      </strong>
                      <span>设计页面</span>
                    </div>
                    <div>
                      <strong>
                        {projects.filter((project) => project.workspace).length}
                      </strong>
                      <span>已绑定工作空间</span>
                    </div>
                  </div>
                  <div className="wf-backup-body">
                    <Download size={22} />
                    <div>
                      <h3>导出工作空间备份</h3>
                      <p>将全部设计项目保存为 JSON 文件，方便迁移和备份。</p>
                    </div>
                  </div>
                  <footer className="wf-panel-footer">
                    <span>导出不会更改当前工作空间</span>
                    <Button variant="outline" onClick={onExport}>
                      <Download size={14} />
                      导出备份
                    </Button>
                  </footer>
                </section>
              )}
              {section === "privacy" && (
                <section className="wf-panel">
                  <PanelHeader
                    title="数据与隐私"
                    description="了解设计数据保存在哪里，以及模型如何使用上下文。"
                    icon={<ShieldCheck size={19} />}
                  />
                  <div className="wf-privacy-body">
                    <section>
                      <h3>本地优先</h3>
                      <p>
                        项目与设置保存在本机。绑定的应用代码保存在对应的项目目录中。
                      </p>
                    </section>
                    <section>
                      <h3>模型上下文</h3>
                      <p>
                        AI
                        请求会将当前设计上下文发送至配置的模型提供商，用于生成主题、设计图和可编辑页面。
                      </p>
                    </section>
                    <dl>
                      <dt>API 服务</dt>
                      <dd>127.0.0.1:4310</dd>
                      <dt>项目目录</dt>
                      <dd>.data/</dd>
                      <dt>工作模式</dt>
                      <dd>个人工作空间</dd>
                    </dl>
                  </div>
                </section>
              )}
            </motion.div>
          </AnimatePresence>{" "}
        </div>
      </div>
    </WorkflowSurface>
  );
}

export function AgentsView({
  settings,
  project,
  onSettings,
  onStart,
  notify,
}: {
  settings: ProviderSettings;
  project?: Project;
  onSettings: () => void;
  onStart: () => void;
  notify: Notify;
}) {
  const command = `curl http://127.0.0.1:4310/api/projects/${project?.id ?? "PROJECT_ID"}`;
  return (
    <WorkflowSurface>
      <Heading
        title="让凛，成为你的创作搭档。"
        description="设计生成与开发接入，都从这里开始。"
      >
        <Button onClick={onStart}>
          <RinIcon kind="agent" size={15} />
          新建设计任务
        </Button>
      </Heading>
      <div className="wf-integration-grid">
        <section className="wf-panel wf-rin-panel">
          <PanelHeader
            title="凛 Rin · 设计 Agent"
            description="图片生成与视觉还原"
            icon={<RinAvatar size={32} />}
          >
            <Badge variant="outline">
              {settings.configured ? "已配置" : "待配置"}
            </Badge>
          </PanelHeader>
          <div className="wf-rin-profile">
          <img src="/brand/rin/v4/rin-full-body-640.webp" alt="凛 Rin，原版设计伙伴" decoding="async" />
          <div className="wf-detail-list">
            <div>
              <span>项目上下文</span>
              <strong>{project?.name ?? "未选择项目"}</strong>
            </div>
            <div>
              <span>视觉模型</span>
              <strong>{settings.textModel || "尚未设置"}</strong>
            </div>
            <div>
              <span>图片模型</span>
              <strong>{settings.imageModel || "尚未设置"}</strong>
            </div>
            <div>
              <span>设计约束</span>
              <strong>
                {project
                  ? `${project.components.length} 个组件 · ${Object.keys(project.tokens).length} 个 Token`
                  : "选择项目后自动读取"}
              </strong>
            </div>
          </div>
          </div>
          <footer className="wf-panel-footer">
            <Button onClick={onStart}>与凛开始创作 <ArrowRight size={14} /></Button>
            <Button variant="outline" onClick={onSettings}>
              <Settings2 size={14} />
              模型设置
            </Button>
          </footer>
        </section>
        <section className="wf-panel">
          <PanelHeader
            title="开发 Agent 接入"
            description="REST API · 统一设计数据"
            icon={<Terminal size={20} />}
          />
          <div className="wf-agent-api">
            <div className="wf-agent-tags">
              <Badge variant="secondary">Codex</Badge>
              <Badge variant="secondary">Claude Code</Badge>
              <Badge variant="secondary">HTTP Agent</Badge>
            </div>
            <p>
              读取项目、Token、组件与页面，提交带版本号的设计修改，并调用代码同步接口。
            </p>
            <div className="wf-code-command">
              <code>{command}</code>
              <Button
                variant="ghost"
                size="icon"
                aria-label="复制 Agent API 命令"
                onClick={() =>
                  navigator.clipboard
                    .writeText(command)
                    .then(() => notify("API 命令已复制"))
                    .catch(() => notify("复制失败，请手动选择命令", true))
                }
              >
                <Copy size={14} />
              </Button>
            </div>
            <div className="wf-api-routes">
              <span>GET</span>
              <code>/api/projects/:id</code>
              <small>读取项目</small>
              <span>PUT</span>
              <code>/api/projects/:id</code>
              <small>更新设计</small>
              <span>POST</span>
              <code>/api/sync/preview</code>
              <small>预览代码</small>
            </div>
          </div>
          <footer className="wf-panel-footer">
            <span>完整接口与鉴权说明</span>
            <code>docs/API.md</code>
          </footer>
        </section>
      </div>
      <section className="wf-process" aria-label="设计任务流程">
        <h2>设计任务流程</h2>
        <ol>
          <li>
            <span>1</span>
            <div>
              <h3>生成设计图</h3>
              <p>描述需求，使用当前主题和组件。</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <h3>确认视觉方案</h3>
              <p>检查布局与样式，确认后继续。</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <h3>还原可编辑画布</h3>
              <p>生成页面，再到画布中调整细节。</p>
            </div>
          </li>
        </ol>
      </section>
    </WorkflowSurface>
  );
}

export function SyncView({
  project,
  onChange,
  onBind,
  flush,
  refresh,
  notify,
}: {
  project: Project;
  onChange: (project: Project) => void;
  onBind: () => void;
  flush: () => Promise<void>;
  refresh: (result?: Mutated) => Promise<void>;
  notify: Notify;
}) {
  const { reduced, expressive, transition } = useStudioMotion();
  const [preview, setPreview] = useState<{
    files: SyncFile[];
    revision: number;
    conflicts: unknown[] | number;
  } | null>(null);
  const [filePath, setFilePath] = useState("");
  const [busy, setBusy] = useState("");
  const [syncNotice, setSyncNotice] = useState<{
    state: "success" | "error";
    message: string;
  }>();
  useEffect(() => {
    setPreview(null);
    setSyncNotice(undefined);
    setFilePath("");
  }, [project.id, project.revision]);
  const file =
    preview?.files.find((item) => item.path === filePath) ?? preview?.files[0];
  const conflicts = preview?.files.some((item) => item.status === "conflict");
  const loadPreview = async () => {
    setBusy("preview");
    setSyncNotice(undefined);
    try {
      await flush();
      const response = await api<NonNullable<typeof preview>>("/sync/preview", {
        projectId: project.id,
      });
      setPreview(response);
      setFilePath(response.files[0]?.path ?? "");
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy("");
    }
  };
  return (
    <WorkflowSurface>
      <Heading
        title="设计与代码同步"
        description="检查设计变更，更新工作空间中的 React 页面与组件。"
      >
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await flush();
              const result = await api(`/projects/${project.id}/export`);
              downloadJson(`${project.name}-react-export.json`, result);
              notify("React 文件包已导出");
            } catch (error) {
              notify((error as Error).message, true);
            }
          }}
        >
          <Download size={15} />
          导出代码包
        </Button>
      </Heading>
      <ol className="wf-sync-steps" aria-label="同步流程">
        <li data-state={project.workspace ? "done" : "current"}>
          <span>{project.workspace ? <Check size={14} /> : "1"}</span>
          <div>
            <strong>绑定工作空间</strong>
            <small>{project.workspace ? "已连接" : "选择代码目录"}</small>
          </div>
        </li>
        <li
          data-state={
            preview ? "done" : project.workspace ? "current" : "pending"
          }
        >
          <span>{preview ? <Check size={14} /> : "2"}</span>
          <div>
            <strong>检查设计变更</strong>
            <small>
              {busy === "preview"
                ? "正在比较文件"
                : preview
                  ? "变更已就绪"
                  : "预览生成文件"}
            </small>
          </div>
        </li>
        <li
          data-state={
            project.lastSyncedRevision === project.revision
              ? "done"
              : preview
                ? "current"
                : "pending"
          }
        >
          <span>
            {project.lastSyncedRevision === project.revision ? (
              <Check size={14} />
            ) : (
              "3"
            )}
          </span>
          <div>
            <strong>同步应用代码</strong>
            <small>
              {busy === "apply"
                ? "正在写入代码"
                : project.lastSyncedRevision === project.revision
                  ? "当前设计已同步"
                  : "确认后写入"}
            </small>
          </div>
        </li>
      </ol>
      <section className="wf-workspace-bar">
        <span className="wf-workspace-icon">
          {project.workspace?.kind === "github" ? (
            <Github size={19} />
          ) : (
            <FolderGit2 size={19} />
          )}
        </span>
        <div>
          <strong>
            {project.workspace
              ? (project.workspace.repo ?? project.workspace.path)
              : "尚未连接工作空间"}
          </strong>
          <span>
            <GitBranch size={12} />
            {project.workspace?.branch || "本地项目"}
            <i />
            设计 v{project.revision}
            <i />
            {project.lastSyncedRevision
              ? "已同步 v" + project.lastSyncedRevision
              : "尚未同步"}
          </span>
        </div>
        <Button variant="outline" size="sm" disabled={!!busy} onClick={onBind}>
          <Link2 size={14} />
          {project.workspace ? "更改绑定" : "绑定目录"}
        </Button>
      </section>
      <div className="wf-sync-toggle">
        <div>
          <h3>自动同步</h3>
          <p>
            {project.lastSyncedRevision
              ? "保存设计后自动更新生成文件，遇到文件冲突时停止。"
              : "完成首次手动同步后可开启。"}
          </p>
        </div>
        <Switch
          checked={!!project.workspace?.autoSync}
          aria-label="自动同步设计变更"
          disabled={!project.workspace || !project.lastSyncedRevision}
          onCheckedChange={(checked) => {
            if (project.workspace)
              onChange({
                ...project,
                workspace: { ...project.workspace, autoSync: checked },
              });
          }}
        />
      </div>
      <section className="wf-panel wf-diff-panel">
        <PanelHeader
          title="文件变更"
          description={
            preview
              ? `${preview.files.filter((item) => item.status !== "unchanged").length} 个文件有变更`
              : "检查生成文件与工作空间中的差异"
          }
          icon={<FileCode2 size={19} />}
        >
          <Button
            variant="outline"
            disabled={!project.workspace || !!busy}
            onClick={loadPreview}
          >
            {busy === "preview" ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            检查变更
          </Button>
        </PanelHeader>
        {busy ? (
          <motion.div
            className="wf-sync-processing"
            role="status"
            initial={reduced ? false : { opacity: 0, y: expressive ? 10 : 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
          >
            <RinAssembly active={!!busy} />
            <div>
              <strong>
                {busy === "apply" ? "正在同步设计与代码" : "正在检查文件变更"}
              </strong>
              <p>
                {busy === "apply"
                  ? "写入生成文件，完成后刷新项目同步状态。"
                  : "比较当前设计和工作空间中的生成文件。"}
              </p>
              <RinTaskActivity running={!!busy} label="处理完成后会自动显示结果" />
            </div>
          </motion.div>
        ) : !preview ? (
          <div className="wf-empty">
            <RinIllustration state="empty" size={80} />
            <h3>{project.workspace ? "尚未检查变更" : "需要先绑定工作空间"}</h3>
            <p>
              {project.workspace
                ? "点击检查变更，查看将要写入的页面、组件和主题文件。"
                : "选择项目目录后即可预览并同步代码。"}
            </p>
          </div>
        ) : (
          <>
            <div className="wf-diff-layout">
              <nav className="wf-diff-files">
                {preview.files.map((item) => (
                  <button
                    className={file?.path === item.path ? "active" : ""}
                    onClick={() => setFilePath(item.path)}
                    key={item.path}
                  >
                    <FileCode2 size={14} />
                    <span>{item.path.replace("forma-generated/", "")}</span>
                    <b className={`wf-file-${item.status}`}>
                      {
                        (
                          {
                            added: "A",
                            modified: "M",
                            conflict: "!",
                            unchanged: "–",
                          } as const
                        )[item.status]
                      }
                    </b>
                  </button>
                ))}
              </nav>
              <div className="wf-diff-code">
                <div>
                  <code>{file?.path}</code>
                  <Badge
                    variant={
                      file?.status === "conflict" ? "destructive" : "secondary"
                    }
                  >
                    {
                      (
                        {
                          added: "新增",
                          modified: "修改",
                          unchanged: "无变化",
                          conflict: "冲突",
                        } as const
                      )[file?.status ?? "unchanged"]
                    }
                  </Badge>
                </div>
                <pre>
                  <code>{file?.content}</code>
                </pre>
              </div>
            </div>
            {conflicts && (
              <div className="wf-error">
                本地生成文件已被修改。请先处理冲突，同步不会覆盖这些内容。
              </div>
            )}
            <footer className="wf-panel-footer">
              <span>
                <ShieldCheck size={14} />
                仅写入 forma-generated/ 目录
              </span>
              <Button
                disabled={
                  !!busy ||
                  !!conflicts ||
                  preview.files.every((item) => item.status === "unchanged")
                }
                onClick={async () => {
                  setBusy("apply");
                  setSyncNotice(undefined);
                  try {
                    await flush();
                    const response = await api<Mutated>("/sync/apply", {
                      projectId: project.id,
                      revision: preview.revision,
                    });
                    await refresh(response);
                    setPreview(null);
                    setSyncNotice({
                      state: "success",
                      message: "当前设计已同步到工作空间。",
                    });
                    notify("设计已同步到工作空间");
                  } catch (error) {
                    setSyncNotice({
                      state: "error",
                      message: (error as Error).message,
                    });
                    notify((error as Error).message, true);
                  } finally {
                    setBusy("");
                  }
                }}
              >
                {busy === "apply" ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : (
                  <Workflow size={15} />
                )}
                同步代码
              </Button>
            </footer>
          </>
        )}
      </section>
      <AnimatePresence>
        {syncNotice && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: expressive ? 10 : 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className={"wf-operation-result is-" + syncNotice.state}
            role={syncNotice.state === "error" ? "alert" : "status"}
          >
            <RinIllustration state={syncNotice.state} size={36} />
            <p>{syncNotice.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="wf-sync-integration">
        <Code2 size={16} />
        <p>
          应用中引入 <code>FormaPage</code> 与 <code>tokens.css</code>，通过{" "}
          <code>onAction</code>{" "}
          接入业务逻辑。生成目录外的业务代码由应用自行维护。
        </p>
      </div>
    </WorkflowSurface>
  );
}

export function AgentDialog({
  project,
  settings,
  mode: initialMode,
  flush,
  refresh,
  onTemplate,
  onClose,
  onSettings,
  onOpenCanvas,
  notify,
}: {
  project?: Project;
  settings: ProviderSettings;
  mode: "design" | "theme";
  flush: () => Promise<void>;
  refresh: (result?: Mutated) => Promise<void>;
  onTemplate: (template: DesignTemplate) => void;
  onClose: () => void;
  onSettings: () => void;
  onOpenCanvas: () => void;
  notify: Notify;
}) {
  const [mode, setMode] = useState(initialMode);
  const [prompt, setPrompt] = useState(project?.generation?.prompt ?? "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState(project?.generation?.imageUrl ?? "");
  const [approved, setApproved] = useState(!!project?.generation?.approved);
  const [complete, setComplete] = useState(false);
  const [theme, setTheme] = useState<{
    name: string;
    description: string;
    tokens: ThemeTokens;
  } | null>(null);
  const stage = complete ? 3 : approved ? 2 : imageUrl ? 1 : 0;
  const run = async (action: string) => {
    setBusy(action);
    setError("");
    try {
      await flush();
      if (action === "theme") {
        const response = await api<{
          name: string;
          description: string;
          tokens: ThemeTokens;
        }>("/generate/theme", { prompt });
        setTheme(response);
      } else if (action === "image") {
        const response = await api<{ imageUrl: string } & Mutated>(
          "/generate/image",
          { projectId: project?.id, prompt },
        );
        setImageUrl(response.imageUrl);
        setApproved(false);
        setComplete(false);
        await refresh(response);
      } else if (action === "approve") {
        const response = await api<Mutated>("/generate/approve", {
          projectId: project?.id,
        });
        setApproved(true);
        await refresh(response);
      } else {
        const response = await api<Mutated>("/generate/design", {
          projectId: project?.id,
        });
        await refresh(response);
        setComplete(true);
        notify("设计图已还原为可编辑页面");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };
  return (
    <Modal
      wide
      title="AI 设计任务"
      subtitle={
        project
          ? `${project.name} · 继承项目主题、变量与组件`
          : "用自然语言创建项目主题"
      }
      onClose={onClose}
    >
      <div className="wf-agent-dialog">
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as "design" | "theme")}
        >
          <TabsList>
            <TabsTrigger value="design" disabled={!project || !!busy}>
              <Layers3 size={14} />
              设计页面
            </TabsTrigger>
            <TabsTrigger value="theme" disabled={!!busy}>
              <Palette size={14} />
              生成主题
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {!settings.configured && (
          <div className="wf-provider-prompt">
            <Sparkles size={19} />
            <div>
              <strong>配置模型以开始生成</strong>
              <p>连接图片生成模型与支持视觉输入的文本模型。</p>
            </div>
            <Button variant="outline" onClick={onSettings}>
              模型设置
            </Button>
          </div>
        )}
        {mode === "design" && (
          <div className="wf-generation-steps">
            {["生成设计图", "确认方案", "还原画布"].map((label, index) => (
              <div
                className={
                  stage > index ? "done" : stage === index ? "active" : ""
                }
                key={label}
              >
                <span>
                  {stage > index ? <Check size={13} /> : `0${index + 1}`}
                </span>
                <strong>{label}</strong>
                {index < 2 && <ArrowRight size={13} />}
              </div>
            ))}
          </div>
        )}
        <label className="wf-prompt-label">
          {mode === "theme" ? "主题描述" : "设计需求"}
          <Textarea
            value={prompt}
            disabled={!!busy}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={
              mode === "theme"
                ? "描述品牌色、字体、圆角与整体风格。例如：专业 B2B 工作台，蓝色主色，浅灰背景，紧凑布局。"
                : "描述页面用途、布局和内容。例如：SaaS 数据分析仪表盘，包含指标卡、收入趋势图和最近交易表格。"
            }
            rows={4}
          />
        </label>
        <div className="wf-prompt-suggestions">
          {(mode === "theme"
            ? ["极简中性", "深色科技", "清晰商务"]
            : ["数据仪表盘", "电商产品页", "项目管理看板"]
          ).map((suggestion) => (
            <Button
              variant="outline"
              size="sm"
              disabled={!!busy}
              key={suggestion}
              onClick={() =>
                setPrompt(
                  mode === "theme"
                    ? `创建${suggestion}风格的完整 UI 主题，包含配色、排版、圆角和间距。`
                    : `设计一个${suggestion}，使用当前项目配色与组件，信息层次清晰，保留常用操作。`,
                )
              }
            >
              <Plus size={12} />
              {suggestion}
            </Button>
          ))}
        </div>
        {mode === "design" && project && (
          <div className="wf-generation-context">
            <span>
              <i style={{ background: project.tokens.primary }} />
              项目主题
            </span>
            <span>
              <DiamondIcon />
              {project.components.length} 个组件
            </span>
            <span>
              <LockKeyhole size={12} />
              设计上下文已附带
            </span>
          </div>
        )}
        {mode === "design" && imageUrl && (
          <div className="wf-generated-image">
            <header>
              <span>
                <Image size={14} />
                设计图预览
              </span>
              <Badge variant="secondary">
                {complete ? "已还原" : approved ? "已确认" : "待确认"}
              </Badge>
            </header>
            <img src={imageUrl} alt="AI 生成的 UI 设计提案" />
            {!approved && <p>检查视觉方案后确认，再还原为可编辑节点。</p>}
          </div>
        )}
        {mode === "theme" && theme && (
          <div
            className="wf-generated-theme"
            style={{
              background: theme.tokens.background,
              color: theme.tokens.text,
              fontFamily: theme.tokens.fontFamily,
            }}
          >
            <h3>{theme.name}</h3>
            <p>{theme.description}</p>
            <div>
              {[
                theme.tokens.primary,
                theme.tokens.surface,
                theme.tokens.text,
                theme.tokens.muted,
                theme.tokens.border,
              ].map((color, index) => (
                <span key={index}>
                  <i style={{ background: color }} />
                  <code>{color}</code>
                </span>
              ))}
            </div>
            <span
              style={{
                background: theme.tokens.primary,
                borderRadius: theme.tokens.radius,
              }}
              className="wf-theme-sample"
            >
              主要按钮
            </span>
          </div>
        )}
        {error && (
          <div className="wf-error" role="alert">
            {error}
          </div>
        )}
        {busy && (
          <div className="wf-generation-progress" role="status">
            <RinIllustration state="thinking" size={42} />
            <div>
              <strong>
                {busy === "image"
                  ? "正在生成设计图…"
                  : busy === "design"
                    ? "正在还原页面节点…"
                    : busy === "theme"
                      ? "正在生成主题…"
                      : "正在保存确认…"}
              </strong>
              <small>模型请求进行中，完成后将在此显示结果。</small>
            </div>
          </div>
        )}
      </div>
      <div className="modal-footer wf-agent-footer">
        <span>
          {mode === "design"
            ? "图片确认后才能生成画布"
            : "生成结果可保存为自定义模板"}
        </span>
        <div>
          {mode === "theme" ? (
            <>
              {theme && (
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => {
                    onTemplate({
                      id: crypto.randomUUID(),
                      name: theme.name,
                      description: theme.description,
                      tokens: theme.tokens,
                      category: "自定义",
                      author: "我的工作空间",
                      cover: "dashboard",
                    });
                    onClose();
                  }}
                >
                  保存模板
                </Button>
              )}
              <Button
                disabled={!settings.configured || !prompt.trim() || !!busy}
                onClick={() => run("theme")}
              >
                <Sparkles size={15} />
                {theme ? "重新生成" : "生成主题"}
              </Button>
            </>
          ) : complete ? (
            <Button onClick={onOpenCanvas}>
              打开画布
              <ArrowRight size={15} />
            </Button>
          ) : (
            <>
              {imageUrl && (
                <Button
                  variant="outline"
                  disabled={!!busy || !prompt.trim()}
                  onClick={() => run("image")}
                >
                  重新生成
                </Button>
              )}
              <Button
                disabled={
                  !settings.configured || !prompt.trim() || !!busy || !project
                }
                onClick={() =>
                  run(!imageUrl ? "image" : !approved ? "approve" : "design")
                }
              >
                {busy ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : !imageUrl ? (
                  <Sparkles size={15} />
                ) : !approved ? (
                  <Check size={15} />
                ) : (
                  <Layers3 size={15} />
                )}
                {!imageUrl
                  ? "生成设计图"
                  : !approved
                    ? "确认方案"
                    : "还原可编辑画布"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
function DiamondIcon() {
  return <Layers3 size={12} />;
}
