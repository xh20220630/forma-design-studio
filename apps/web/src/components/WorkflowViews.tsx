import { ReferenceImagePreview } from './ReferenceImagePreview';
import { ReconstructionProgress } from './ReconstructionProgress';
import { useStudioMotion } from '../lib/motion';
import { motion, AnimatePresence } from 'motion/react';
import { RinAvatar, RinIllustration, RinAssembly, RinIcon } from './brand/RinBrand';
import { RinTaskActivity } from './motion/RinMotion';
import { useEffect, useState, type ReactNode } from 'react';
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
} from 'lucide-react';
import type { DesignTemplate, Project, ProviderSettings, ThemeTokens } from '@forma/schema';
import { api, downloadJson } from '../lib/api';
import { Button } from '@forma/ui/button';
import { Input } from '@forma/ui/input';
import { Textarea } from '@forma/ui/textarea';
import { Badge } from '@forma/ui/badge';
import { Switch } from '@forma/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@forma/ui/tabs';
import Modal from './Modal';
import { ProviderConnections } from './ProviderConnections';
import './workflow.css';

/**
 * 向界面提交操作提示的回调约定。
 * @param message - 面向用户或调用方的说明消息。
 * @param error - 当前操作的失败信息，供界面反馈或重试判断。
 * @returns 无返回值；由回调提交操作或通知。
 */
type Notify = (message: string, error?: boolean) => void;
/** 保存操作返回的项目及同步提示。 */
type Mutated = {
  /** 当前设计项目或工作空间项目元信息。 */
  project?: Project;
};
/** 同步预览中的单个文件，让用户查看内容及冲突状态。 */
type SyncFile = {
  /** 文件路径或矢量路径内容，具体格式由所属对象约定。 */
  path: string;
  /** 文件、消息或编辑文档的正文。 */
  content: string;
  /** 对象当前所处状态，决定后续可执行操作。取值：added（新增）、modified（已修改）、unchanged（未变化）、conflict（存在本地冲突）。 */
  status: 'added' | 'modified' | 'unchanged' | 'conflict';
};
/**
 * 呈现工作流内容容器，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.children - 由调用方放入组件的子内容。
 * @returns 供 React 渲染的界面内容。
 */
function WorkflowSurface({
  children,
}: {
  /** 由调用方放入组件的子内容。 */
  children: ReactNode;
}) {
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
/**
 * 呈现区域标题，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.title - 界面显示的标题。
 * @param props.description - 用于解释内容或用途的说明文字。
 * @param props.children - 由调用方放入组件的子内容。
 * @returns 供 React 渲染的界面内容。
 */
function Heading({
  title,
  description,
  children,
}: {
  /** 界面显示的标题。 */
  title: string;
  /** 用于解释内容或用途的说明文字。 */
  description: string;
  /** 由调用方放入组件的子内容。 */
  children?: ReactNode;
}) {
  return (
    <header className="wf-heading">
      <div>
        <h1>
          <RinIcon
            kind={title.includes('同步') ? 'sync' : title.includes('Agent') ? 'agent' : 'tokens'}
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
/**
 * 呈现面板标题区，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.title - 界面显示的标题。
 * @param props.description - 用于解释内容或用途的说明文字。
 * @param props.icon - 当前控件使用的图标。
 * @param props.children - 由调用方放入组件的子内容。
 * @returns 供 React 渲染的界面内容。
 */
function PanelHeader({
  title,
  description,
  icon,
  children,
}: {
  /** 界面显示的标题。 */
  title: string;
  /** 用于解释内容或用途的说明文字。 */
  description?: string;
  /** 当前控件使用的图标。 */
  icon?: ReactNode;
  /** 由调用方放入组件的子内容。 */
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

/**
 * 呈现项目设置，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.settings - 当前生效的设置。
 * @param props.onSettings - 在设置时通知调用方，由外层决定如何更新业务状态。
 * @param props.notify - 向外层界面发送操作提示的回调。
 * @param props.projects - 当前保存或展示的项目集合。
 * @param props.onExport - 在导出时通知调用方，由外层决定如何更新业务状态。
 * @returns 供 React 渲染的界面内容。
 */
export function SettingsView({
  settings,
  onSettings,
  notify,
  projects,
  onExport,
}: {
  /** 当前生效的设置。 */
  settings: ProviderSettings;
  /**
   * 在设置时通知调用方，由外层决定如何更新业务状态。
   * @param settings - 当前生效的设置。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSettings: (settings: ProviderSettings) => void;
  /** 向外层界面发送操作提示的回调。 */
  notify: Notify;
  /** 当前保存或展示的项目集合。 */
  projects: Project[];
  /**
   * 在导出时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onExport: () => void;
}) {
  const { reduced, expressive, transition } = useStudioMotion();
  /** 界面状态：当前设置分区或设计分区。通过状态更新驱动界面刷新。 */
  const [section, setSection] = useState('connection');
  return (
    <WorkflowSurface>
      <Heading title="设置" description="让工具，按你的方式工作。">
        <Badge variant="outline" className="wf-provider-status">
          <i data-ready={settings.configured} />
          {`文本${settings.configured ? '已配置' : '未配置'} · 生图${settings.imageConfigured ? '已配置' : '未配置'}`}
        </Badge>
      </Heading>
      <div className="wf-settings-layout">
        <nav className="wf-settings-nav" aria-label="设置分类">
          <span>工作空间设置</span>
          {[
            {
              id: 'connection',
              label: '模型连接',
              icon: <Sparkles size={16} />,
            },
            {
              id: 'workspace',
              label: '工作空间',
              icon: <FolderOpen size={16} />,
            },
            {
              id: 'privacy',
              label: '数据与隐私',
              icon: <ShieldCheck size={16} />,
            },
          ].map(
            /**
             * 转换项目设置中的集合条目，供后续处理或展示。
             *
             * @param item - 当前遍历的条目。
             * @returns 当前条目转换后的结果。
             */
            (item) => (
              <button
                key={item.id}
                aria-current={section === item.id ? 'page' : undefined}
                onClick={
                  /** 响应 onClick 交互，将用户操作应用到项目设置。 @returns 当前步骤的处理结果。 */
                  () => setSection(item.id)
                }
              >
                {item.icon}
                {item.label}
              </button>
            ),
          )}
          <div className="settings-rin-note">
            <img src="/brand/rin/v4/rin-full-body-640.webp" alt="凛 Rin" loading="lazy" />
            <span>
              连接就绪，
              <br />
              灵感随时开始。
            </span>
          </div>
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
              {section === 'connection' && (
                <ProviderConnections settings={settings} onSettings={onSettings} notify={notify} />
              )}
              {section === 'workspace' && (
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
                          /** 累积项目设置中的条目结果，供后续计算使用。 @param total - 当前统计的总量。 @param project - 当前设计项目或工作空间项目元信息。 @returns 纳入当前条目后的累计结果。 */
                          (total, project) => total + project.pages.length,
                          0,
                        )}
                      </strong>
                      <span>设计页面</span>
                    </div>
                    <div>
                      <strong>
                        {
                          projects.filter(
                            /** 检查项目的workspace，供集合筛选或定位使用。 @param project - 当前设计项目或工作空间项目元信息。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                            (project) => project.workspace,
                          ).length
                        }
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
              {section === 'privacy' && (
                <section className="wf-panel">
                  <PanelHeader
                    title="数据与隐私"
                    description="了解设计数据保存在哪里，以及模型如何使用上下文。"
                    icon={<ShieldCheck size={19} />}
                  />
                  <div className="wf-privacy-body">
                    <section>
                      <h3>本地优先</h3>
                      <p>项目与设置保存在本机。绑定的应用代码保存在对应的项目目录中。</p>
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
          </AnimatePresence>{' '}
        </div>
      </div>
    </WorkflowSurface>
  );
}

/**
 * 呈现助手配置视图，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.settings - 当前生效的设置。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.onSettings - 在设置时通知调用方，由外层决定如何更新业务状态。
 * @param props.onStart - 在开始时通知调用方，由外层决定如何更新业务状态。
 * @param props.notify - 向外层界面发送操作提示的回调。
 * @returns 供 React 渲染的界面内容。
 */
export function AgentsView({
  settings,
  project,
  onSettings,
  onStart,
  notify,
}: {
  /** 当前生效的设置。 */
  settings: ProviderSettings;
  /** 当前设计项目或工作空间项目元信息。 */
  project?: Project;
  /**
   * 在设置时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSettings: () => void;
  /**
   * 在开始时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onStart: () => void;
  /** 向外层界面发送操作提示的回调。 */
  notify: Notify;
}) {
  const command = `curl http://127.0.0.1:4310/api/projects/${project?.id ?? 'PROJECT_ID'}`;
  return (
    <WorkflowSurface>
      <Heading title="让凛，成为你的创作搭档。" description="设计生成与开发接入，都从这里开始。">
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
            <Badge variant="outline">{settings.configured ? '已配置' : '待配置'}</Badge>
          </PanelHeader>
          <div className="wf-rin-profile">
            <img
              src="/brand/rin/v4/rin-full-body-640.webp"
              alt="凛 Rin，原版设计伙伴"
              decoding="async"
            />
            <div className="wf-detail-list">
              <div>
                <span>项目上下文</span>
                <strong>{project?.name ?? '未选择项目'}</strong>
              </div>
              <div>
                <span>视觉模型</span>
                <strong>{settings.textModel || '尚未设置'}</strong>
              </div>
              <div>
                <span>图片模型</span>
                <strong>{settings.imageModel || '尚未设置'}</strong>
              </div>
              <div>
                <span>设计约束</span>
                <strong>
                  {project
                    ? `${project.components.length} 个组件 · ${Object.keys(project.tokens).length} 个 Token`
                    : '选择项目后自动读取'}
                </strong>
              </div>
            </div>
          </div>
          <footer className="wf-panel-footer">
            <Button onClick={onStart}>
              与凛开始创作 <ArrowRight size={14} />
            </Button>
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
            <p>读取项目、Token、组件与页面，提交带版本号的设计修改，并调用代码同步接口。</p>
            <div className="wf-code-command">
              <code>{command}</code>
              <Button
                variant="ghost"
                size="icon"
                aria-label="复制 Agent API 命令"
                onClick={
                  /**
                   * 响应 onClick 交互，将用户操作应用到助手配置视图。
                   * @returns 完成当前异步操作的 Promise，不携带业务数据。
                   */
                  () =>
                    navigator.clipboard
                      .writeText(command)
                      .then(
                        /** 在助手配置视图的异步步骤结束后处理结果。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => notify('API 命令已复制'),
                      )
                      .catch(
                        /** 处理助手配置视图中的异步失败，按当前流程决定回退或继续抛出。 @returns 无返回值；通过副作用完成当前操作。 */
                        () => notify('复制失败，请手动选择命令', true),
                      )
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

/**
 * 呈现代码同步视图，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.onChange - 在值变化时通知调用方，由外层决定如何更新业务状态。
 * @param props.onBind - 在绑定时通知调用方，由外层决定如何更新业务状态。
 * @param props.flush - 等待尚未完成的保存落地，避免后续操作使用旧版本。
 * @param props.refresh - 重新读取最新数据的入口。
 * @param props.notify - 向外层界面发送操作提示的回调。
 * @returns 供 React 渲染的界面内容。
 */
export function SyncView({
  project,
  onChange,
  onBind,
  flush,
  refresh,
  notify,
}: {
  /** 当前设计项目或工作空间项目元信息。 */
  project: Project;
  /**
   * 在值变化时通知调用方，由外层决定如何更新业务状态。
   * @param project - 当前设计项目或工作空间项目元信息。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onChange: (project: Project) => void;
  /**
   * 在绑定时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onBind: () => void;
  /**
   * 等待尚未完成的保存落地，避免后续操作使用旧版本。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  flush: () => Promise<void>;
  /**
   * 重新读取最新数据的入口。
   * @param result - 上一步操作得到的结果。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  refresh: (result?: Mutated) => Promise<void>;
  /** 向外层界面发送操作提示的回调。 */
  notify: Notify;
}) {
  const { reduced, expressive, transition } = useStudioMotion();
  /** 界面状态：当前预览数据或原型预览状态。通过状态更新驱动界面刷新。 */
  const [preview, setPreview] = useState<{
    /** 当前操作涉及的文件或文件摘要集合。 */
    files: SyncFile[];
    /** 当前修订号，每次持久化修改后递增，用于拒绝过期提交。 */
    revision: number;
    /** 阻止直接写入的本地冲突列表。 */
    conflicts: unknown[] | number;
  } | null>(null);
  /** 界面状态：预览中选定的文件路径。通过状态更新驱动界面刷新。 */
  const [filePath, setFilePath] = useState('');
  /** 界面状态：是否有操作进行中，用于阻止重复提交。通过状态更新驱动界面刷新。 */
  const [busy, setBusy] = useState('');
  /** 界面状态：最近一次同步操作的提示。通过状态更新驱动界面刷新。 */
  const [syncNotice, setSyncNotice] = useState<{
    /** 当前操作所依赖的完整状态。取值：success（成功后退出）、error（阻断错误）。 */
    state: 'success' | 'error';
    /** 面向用户或调用方的说明消息。 */
    message: string;
  }>();
  useEffect(
    /**
     * 在代码同步视图的依赖变化后同步外部资源或界面状态。
     * @returns 无返回值；通过副作用完成当前操作。
     */
    () => {
      setPreview(null);
      setSyncNotice(undefined);
      setFilePath('');
    },
    [project.id, project.revision],
  );
  const file =
    preview?.files.find(
      /** 检查条目的路径等于filePath，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
      (item) => item.path === filePath,
    ) ?? preview?.files[0];
  const conflicts = preview?.files.some(
    /** 检查条目的状态等于“conflict”，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
    (item) => item.status === 'conflict',
  );
  /**
   * 读取代码同步预览，使用户能够在写入前查看变更与冲突。
   * @returns 预览加载操作的结果。
   */
  const loadPreview = async () => {
    setBusy('preview');
    setSyncNotice(undefined);
    try {
      await flush();
      const response = await api<NonNullable<typeof preview>>('/sync/preview', {
        projectId: project.id,
      });
      setPreview(response);
      setFilePath(response.files[0]?.path ?? '');
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy('');
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
          onClick={
            /**
             * 响应 onClick 交互，将用户操作应用到代码同步视图。
             * @returns 完成当前异步操作的 Promise，不携带业务数据。
             */
            async () => {
              try {
                await flush();
                const result = await api(`/projects/${project.id}/export`);
                downloadJson(`${project.name}-react-export.json`, result);
                notify('React 文件包已导出');
              } catch (error) {
                notify((error as Error).message, true);
              }
            }
          }
        >
          <Download size={15} />
          导出代码包
        </Button>
      </Heading>
      <ol className="wf-sync-steps" aria-label="同步流程">
        <li data-state={project.workspace ? 'done' : 'current'}>
          <span>{project.workspace ? <Check size={14} /> : '1'}</span>
          <div>
            <strong>绑定工作空间</strong>
            <small>{project.workspace ? '已连接' : '选择代码目录'}</small>
          </div>
        </li>
        <li data-state={preview ? 'done' : project.workspace ? 'current' : 'pending'}>
          <span>{preview ? <Check size={14} /> : '2'}</span>
          <div>
            <strong>检查设计变更</strong>
            <small>
              {busy === 'preview' ? '正在比较文件' : preview ? '变更已就绪' : '预览生成文件'}
            </small>
          </div>
        </li>
        <li
          data-state={
            project.lastSyncedRevision === project.revision
              ? 'done'
              : preview
                ? 'current'
                : 'pending'
          }
        >
          <span>{project.lastSyncedRevision === project.revision ? <Check size={14} /> : '3'}</span>
          <div>
            <strong>同步应用代码</strong>
            <small>
              {busy === 'apply'
                ? '正在写入代码'
                : project.lastSyncedRevision === project.revision
                  ? '当前设计已同步'
                  : '确认后写入'}
            </small>
          </div>
        </li>
      </ol>
      <section className="wf-workspace-bar">
        <span className="wf-workspace-icon">
          {project.workspace?.kind === 'github' ? <Github size={19} /> : <FolderGit2 size={19} />}
        </span>
        <div>
          <strong>
            {project.workspace
              ? (project.workspace.repo ?? project.workspace.path)
              : '尚未连接工作空间'}
          </strong>
          <span>
            <GitBranch size={12} />
            {project.workspace?.branch || '本地项目'}
            <i />
            设计 v{project.revision}
            <i />
            {project.lastSyncedRevision ? '已同步 v' + project.lastSyncedRevision : '尚未同步'}
          </span>
        </div>
        <Button variant="outline" size="sm" disabled={!!busy} onClick={onBind}>
          <Link2 size={14} />
          {project.workspace ? '更改绑定' : '绑定目录'}
        </Button>
      </section>
      <div className="wf-sync-toggle">
        <div>
          <h3>自动同步</h3>
          <p>
            {project.lastSyncedRevision
              ? '保存设计后自动更新生成文件，遇到文件冲突时停止。'
              : '完成首次手动同步后可开启。'}
          </p>
        </div>
        <Switch
          checked={!!project.workspace?.autoSync}
          aria-label="自动同步设计变更"
          disabled={!project.workspace || !project.lastSyncedRevision}
          onCheckedChange={
            /**
             * 响应 onCheckedChange 交互，将用户操作应用到代码同步视图。
             *
             * @param checked - 复选控件当前是否选中。
             * @returns 无返回值；通过副作用完成当前操作。
             */
            (checked) => {
              if (project.workspace)
                onChange({
                  ...project,
                  workspace: { ...project.workspace, autoSync: checked },
                });
            }
          }
        />
      </div>
      <section className="wf-panel wf-diff-panel">
        <PanelHeader
          title="文件变更"
          description={
            preview
              ? `${
                  preview.files.filter(
                    /** 检查条目的状态不等于“unchanged”，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                    (item) => item.status !== 'unchanged',
                  ).length
                } 个文件有变更`
              : '检查生成文件与工作空间中的差异'
          }
          icon={<FileCode2 size={19} />}
        >
          <Button variant="outline" disabled={!project.workspace || !!busy} onClick={loadPreview}>
            {busy === 'preview' ? (
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
              <strong>{busy === 'apply' ? '正在同步设计与代码' : '正在检查文件变更'}</strong>
              <p>
                {busy === 'apply'
                  ? '写入生成文件，完成后刷新项目同步状态。'
                  : '比较当前设计和工作空间中的生成文件。'}
              </p>
              <RinTaskActivity running={!!busy} label="处理完成后会自动显示结果" />
            </div>
          </motion.div>
        ) : !preview ? (
          <div className="wf-empty">
            <RinIllustration state="empty" size={80} />
            <h3>{project.workspace ? '尚未检查变更' : '需要先绑定工作空间'}</h3>
            <p>
              {project.workspace
                ? '点击检查变更，查看将要写入的页面、组件和主题文件。'
                : '选择项目目录后即可预览并同步代码。'}
            </p>
          </div>
        ) : (
          <>
            <div className="wf-diff-layout">
              <nav className="wf-diff-files">
                {preview.files.map(
                  /**
                   * 转换代码同步视图中的集合条目，供后续处理或展示。
                   *
                   * @param item - 当前遍历的条目。
                   * @returns 当前条目转换后的结果。
                   */
                  (item) => (
                    <button
                      className={file?.path === item.path ? 'active' : ''}
                      onClick={
                        /** 响应 onClick 交互，将用户操作应用到代码同步视图。 @returns 当前步骤的处理结果。 */
                        () => setFilePath(item.path)
                      }
                      key={item.path}
                    >
                      <FileCode2 size={14} />
                      <span>{item.path.replace('forma-generated/', '')}</span>
                      <b className={`wf-file-${item.status}`}>
                        {
                          (
                            {
                              added: 'A',
                              modified: 'M',
                              conflict: '!',
                              unchanged: '–',
                            } as const
                          )[item.status]
                        }
                      </b>
                    </button>
                  ),
                )}
              </nav>
              <div className="wf-diff-code">
                <div>
                  <code>{file?.path}</code>
                  <Badge variant={file?.status === 'conflict' ? 'destructive' : 'secondary'}>
                    {
                      (
                        {
                          added: '新增',
                          modified: '修改',
                          unchanged: '无变化',
                          conflict: '冲突',
                        } as const
                      )[file?.status ?? 'unchanged']
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
                  preview.files.every(
                    /** 检查条目的状态等于“unchanged”，供集合筛选或定位使用。 @param item - 当前遍历的条目。 @returns 用于判断条件的值；真值表示该条目符合条件。 */
                    (item) => item.status === 'unchanged',
                  )
                }
                onClick={
                  /**
                   * 响应 onClick 交互，将用户操作应用到代码同步视图。
                   * @returns 完成当前异步操作的 Promise，不携带业务数据。
                   */
                  async () => {
                    setBusy('apply');
                    setSyncNotice(undefined);
                    try {
                      await flush();
                      const response = await api<Mutated>('/sync/apply', {
                        projectId: project.id,
                        revision: preview.revision,
                      });
                      await refresh(response);
                      setPreview(null);
                      setSyncNotice({
                        state: 'success',
                        message: '当前设计已同步到工作空间。',
                      });
                      notify('设计已同步到工作空间');
                    } catch (error) {
                      setSyncNotice({
                        state: 'error',
                        message: (error as Error).message,
                      });
                      notify((error as Error).message, true);
                    } finally {
                      setBusy('');
                    }
                  }
                }
              >
                {busy === 'apply' ? (
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
            className={'wf-operation-result is-' + syncNotice.state}
            role={syncNotice.state === 'error' ? 'alert' : 'status'}
          >
            <RinIllustration state={syncNotice.state} size={36} />
            <p>{syncNotice.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="wf-sync-integration">
        <Code2 size={16} />
        <p>
          应用中引入 <code>FormaPage</code> 与 <code>tokens.css</code>，通过 <code>onAction</code>{' '}
          接入业务逻辑。生成目录外的业务代码由应用自行维护。
        </p>
      </div>
    </WorkflowSurface>
  );
}

/**
 * 呈现模型操作对话框，将展示与交互入口放在同一个组件中维护。
 *
 * @param props - 按字段解构的输入，字段用途见对应类型定义。
 * @param props.project - 当前设计项目或工作空间项目元信息。
 * @param props.settings - 当前生效的设置。
 * @param props.mode - 当前使用的模式或操作方式。
 * @param props.flush - 等待尚未完成的保存落地，避免后续操作使用旧版本。
 * @param props.refresh - 重新读取最新数据的入口。
 * @param props.onTemplate - 在使用模板时通知调用方，由外层决定如何更新业务状态。
 * @param props.onClose - 在关闭时通知调用方，由外层决定如何更新业务状态。
 * @param props.onSettings - 在设置时通知调用方，由外层决定如何更新业务状态。
 * @param props.onOpenCanvas - 在打开画布时通知调用方，由外层决定如何更新业务状态。
 * @param props.notify - 向外层界面发送操作提示的回调。
 * @returns 供 React 渲染的界面内容。
 */
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
  /** 当前设计项目或工作空间项目元信息。 */
  project?: Project;
  /** 当前生效的设置。 */
  settings: ProviderSettings;
  /** 当前使用的模式或操作方式。取值：design（设计）、theme（主题）。 */
  mode: 'design' | 'theme';
  /**
   * 等待尚未完成的保存落地，避免后续操作使用旧版本。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  flush: () => Promise<void>;
  /**
   * 重新读取最新数据的入口。
   * @param result - 上一步操作得到的结果。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  refresh: (result?: Mutated) => Promise<void>;
  /**
   * 在使用模板时通知调用方，由外层决定如何更新业务状态。
   * @param template - 用于创建项目的模板定义。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onTemplate: (template: DesignTemplate) => void;
  /**
   * 在关闭时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onClose: () => void;
  /**
   * 在设置时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onSettings: () => void;
  /**
   * 在打开画布时通知调用方，由外层决定如何更新业务状态。
   * @returns 无返回值；通过副作用完成当前操作。
   */
  onOpenCanvas: () => void;
  /** 向外层界面发送操作提示的回调。 */
  notify: Notify;
}) {
  /** 界面状态：当前使用的模式或操作方式。通过状态更新驱动界面刷新。 */
  const [mode, setMode] = useState(initialMode);
  /** 界面状态：发送给模型的生成要求。通过状态更新驱动界面刷新。 */
  const [prompt, setPrompt] = useState(project?.generation?.prompt ?? '');
  /** 界面状态：是否有操作进行中，用于阻止重复提交。通过状态更新驱动界面刷新。 */
  const [busy, setBusy] = useState('');
  /** 界面状态：当前操作的失败信息，供界面反馈或重试判断。通过状态更新驱动界面刷新。 */
  const [error, setError] = useState('');
  /** 界面状态：同步或图片预览弹层是否打开。通过状态更新驱动界面刷新。 */
  const [previewOpen, setPreviewOpen] = useState(false);
  /** 界面状态：生成图片的访问地址。通过状态更新驱动界面刷新。 */
  const [imageUrl, setImageUrl] = useState(project?.generation?.imageUrl ?? '');
  /** 界面状态：当前参考图是否已经过用户确认；设计上下文变化后会撤销。通过状态更新驱动界面刷新。 */
  const [approved, setApproved] = useState(!!project?.generation?.approved);
  /** 界面状态：当前任务是否已经完成。通过状态更新驱动界面刷新。 */
  const [complete, setComplete] = useState(false);
  /** 界面状态：项目主题及其规范路径和确认信息。通过状态更新驱动界面刷新。 */
  const [theme, setTheme] = useState<{
    /** 面向用户展示的名称。 */
    name: string;
    /** 用于解释内容或用途的说明文字。 */
    description: string;
    /** 设计主题或语义 Token 集合。 */
    tokens: ThemeTokens;
  } | null>(null);
  const stage = complete ? 3 : approved ? 2 : imageUrl ? 1 : 0;
  /**
   * 执行当前用户发起的操作，并同步执行进度和结果。
   *
   * @param action - 当前要执行的操作或操作结果分类。
   * @returns 完成当前异步操作的 Promise，不携带业务数据。
   */
  const run = async (action: string) => {
    setBusy(action);
    setError('');
    try {
      await flush();
      if (action === 'theme') {
        const response = await api<{
          /** 面向用户展示的名称。 */
          name: string;
          /** 用于解释内容或用途的说明文字。 */
          description: string;
          /** 设计主题或语义 Token 集合。 */
          tokens: ThemeTokens;
        }>('/generate/theme', { prompt });
        setTheme(response);
      } else if (action === 'image') {
        const response = await api<
          {
            /** 生成图片的访问地址。 */
            imageUrl: string;
          } & Mutated
        >('/generate/image', { projectId: project?.id, prompt });
        setImageUrl(response.imageUrl);
        setApproved(false);
        setComplete(false);
        await refresh(response);
      } else if (action === 'approve') {
        const response = await api<Mutated>('/generate/approve', {
          projectId: project?.id,
        });
        setApproved(true);
        await refresh(response);
      } else {
        const response = await api<Mutated>('/generate/design', {
          projectId: project?.id,
        });
        await refresh(response);
        setComplete(true);
        notify('设计图已还原为可编辑页面');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  };
  return (
    <Modal
      wide
      title="AI 设计任务"
      subtitle={project ? `${project.name} · 继承项目主题、变量与组件` : '用自然语言创建项目主题'}
      onClose={onClose}
    >
      <div className="wf-agent-dialog">
        <Tabs
          value={mode}
          onValueChange={
            /** 响应 onValueChange 交互，将用户操作应用到模型操作对话框。 @param value - 当前字段、模式或控件的取值。 @returns 当前步骤的处理结果。 */
            (value) => setMode(value as 'design' | 'theme')
          }
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
        {(!settings.configured || (mode === 'design' && !settings.imageConfigured)) && (
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
        {mode === 'design' && (
          <div className="wf-generation-steps">
            {['生成设计图', '确认方案', '还原画布'].map(
              /**
               * 转换模型操作对话框中的集合条目，供后续处理或展示。
               *
               * @param label - 面向用户显示的简短标签。
               * @param index - 空间查询索引或当前条目的位置。
               * @returns 当前条目转换后的结果。
               */
              (label, index) => (
                <div
                  className={stage > index ? 'done' : stage === index ? 'active' : ''}
                  key={label}
                >
                  <span>{stage > index ? <Check size={13} /> : `0${index + 1}`}</span>
                  <strong>{label}</strong>
                  {index < 2 && <ArrowRight size={13} />}
                </div>
              ),
            )}
          </div>
        )}
        <label className="wf-prompt-label">
          {mode === 'theme' ? '主题描述' : '设计需求'}
          <Textarea
            value={prompt}
            disabled={!!busy}
            onChange={
              /** 响应 onChange 交互，将用户操作应用到模型操作对话框。 @param event - 当前事件及其触发位置。 @returns 当前步骤的处理结果。 */
              (event) => setPrompt(event.target.value)
            }
            placeholder={
              mode === 'theme'
                ? '描述品牌色、字体、圆角与整体风格。例如：专业 B2B 工作台，蓝色主色，浅灰背景，紧凑布局。'
                : '描述页面用途、布局和内容。例如：SaaS 数据分析仪表盘，包含指标卡、收入趋势图和最近交易表格。'
            }
            rows={4}
          />
        </label>
        <div className="wf-prompt-suggestions">
          {(mode === 'theme'
            ? ['极简中性', '深色科技', '清晰商务']
            : ['数据仪表盘', '电商产品页', '项目管理看板']
          ).map(
            /**
             * 转换模型操作对话框中的集合条目，供后续处理或展示。
             *
             * @param suggestion - 提供给用户的快捷需求或建议文字。
             * @returns 当前条目转换后的结果。
             */
            (suggestion) => (
              <Button
                variant="outline"
                size="sm"
                disabled={!!busy}
                key={suggestion}
                onClick={
                  /**
                   * 响应 onClick 交互，将用户操作应用到模型操作对话框。
                   * @returns 当前步骤的处理结果。
                   */
                  () =>
                    setPrompt(
                      mode === 'theme'
                        ? `创建${suggestion}风格的完整 UI 主题，包含配色、排版、圆角和间距。`
                        : `设计一个${suggestion}，使用当前项目配色与组件，信息层次清晰，保留常用操作。`,
                    )
                }
              >
                <Plus size={12} />
                {suggestion}
              </Button>
            ),
          )}
        </div>
        {mode === 'design' && project && (
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
        {mode === 'design' && imageUrl && (
          <div className="wf-generated-image">
            <header>
              <span>
                <Image size={14} />
                设计图预览
              </span>
              <Badge variant="secondary">
                {complete ? '已还原' : approved ? '已确认' : '待确认'}
              </Badge>
            </header>
            <button
              type="button"
              className="wf-reference-open"
              onClick={
                /** 响应 onClick 交互，将用户操作应用到模型操作对话框。 @returns 当前步骤的处理结果。 */
                () => setPreviewOpen(true)
              }
              aria-label="查看完整设计图"
            >
              <img src={imageUrl} alt="AI 生成的 UI 设计提案" />
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={
                /** 响应 onClick 交互，将用户操作应用到模型操作对话框。 @returns 当前步骤的处理结果。 */
                () => setPreviewOpen(true)
              }
            >
              查看完整设计图
            </Button>
            <ReferenceImagePreview
              image={previewOpen ? { url: imageUrl, title: 'UI 参考图' } : undefined}
              onClose={
                /** 响应 onClose 交互，将用户操作应用到模型操作对话框。 @returns 当前步骤的处理结果。 */
                () => setPreviewOpen(false)
              }
            />
            {!approved && <p>检查视觉方案后确认，再还原为可编辑节点。</p>}
          </div>
        )}
        {mode === 'design' && project && imageUrl && (
          <ReconstructionProgress
            projectId={project.id}
            sourceImageUrl={imageUrl}
            active={busy === 'design'}
          />
        )}
        {mode === 'theme' && theme && (
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
              ].map(
                /** 转换模型操作对话框中的集合条目，供后续处理或展示。 @param color - 文字或视觉元素的颜色。 @param index - 空间查询索引或当前条目的位置。 @returns 当前条目转换后的结果。 */
                (color, index) => (
                  <span key={index}>
                    <i style={{ background: color }} />
                    <code>{color}</code>
                  </span>
                ),
              )}
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
                {busy === 'image'
                  ? '正在生成设计图…'
                  : busy === 'design'
                    ? '正在分析参考图并重建素材…'
                    : busy === 'theme'
                      ? '正在生成主题…'
                      : '正在保存确认…'}
              </strong>
              <small>模型请求进行中，完成后将在此显示结果。</small>
            </div>
          </div>
        )}
      </div>
      <div className="modal-footer wf-agent-footer">
        <span>{mode === 'design' ? '图片确认后才能生成画布' : '生成结果可保存为自定义模板'}</span>
        <div>
          {mode === 'theme' ? (
            <>
              {theme && (
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={
                    /**
                     * 响应 onClick 交互，将用户操作应用到模型操作对话框。
                     * @returns 无返回值；通过副作用完成当前操作。
                     */
                    () => {
                      onTemplate({
                        id: crypto.randomUUID(),
                        name: theme.name,
                        description: theme.description,
                        tokens: theme.tokens,
                        category: '自定义',
                        author: '我的工作空间',
                        cover: 'dashboard',
                      });
                      onClose();
                    }
                  }
                >
                  保存模板
                </Button>
              )}
              <Button
                disabled={!settings.configured || !prompt.trim() || !!busy}
                onClick={
                  /** 响应 onClick 交互，将用户操作应用到模型操作对话框。 @returns 完成当前异步操作的 Promise，不携带业务数据。 */
                  () => run('theme')
                }
              >
                <Sparkles size={15} />
                {theme ? '重新生成' : '生成主题'}
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
                  disabled={!!busy || !prompt.trim() || !settings.imageConfigured}
                  onClick={
                    /** 响应 onClick 交互，将用户操作应用到模型操作对话框。 @returns 完成当前异步操作的 Promise，不携带业务数据。 */
                    () => run('image')
                  }
                >
                  重新生成
                </Button>
              )}
              <Button
                disabled={
                  (!imageUrl
                    ? !settings.imageConfigured
                    : approved
                      ? !settings.configured
                      : false) ||
                  !prompt.trim() ||
                  !!busy ||
                  !project
                }
                onClick={
                  /** 响应 onClick 交互，将用户操作应用到模型操作对话框。 @returns 完成当前异步操作的 Promise，不携带业务数据。 */
                  () => run(!imageUrl ? 'image' : !approved ? 'approve' : 'design')
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
                {!imageUrl ? '生成设计图' : !approved ? '确认方案' : '还原可编辑画布'}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
/**
 * 呈现菱形图标，将展示与交互入口放在同一个组件中维护。
 * @returns 供 React 渲染的界面内容。
 */
function DiamondIcon() {
  return <Layers3 size={12} />;
}
