# AI Design Workbench 实施计划

状态：已完成（2026-09-23）  
原则：每个阶段形成可独立运行的纵向切片，不改造现有 Forma 产品

## 1. 目标交付结构

```text
packages/
  forma-ai-ui-designer/
  design-workspace-sdk/
  workbench-cli/

apps/
  ai-design-workbench/
```

画布几何与交互目前封装在独立工作台应用内，没有为了形式上分包而创建一个无稳定外部调用者的 `flow-canvas` 包。SDK 和运行时契约保持独立。

现有 `apps/web`、`apps/api` 和既有 packages 保持可独立运行。新包可以复用 `packages/ui` 与 `packages/editor-core`，但不得穿透引用应用源码。

## 2. 阶段 0：契约与仓库骨架

状态：已完成

### 工作

- 新建上述 workspace 包和应用目录；
- 在 `@forma/schema` 增加独立的 workbench contract 出口；
- 将本文档的数据结构落实为 TypeScript 类型；
- 定义 v1 输入 fixture 和 v2 标准 fixture；
- 明确 package 依赖方向，禁止新工作台依赖 `apps/web` 或 `apps/api`。

### 完成条件

- 所有新包可以独立 typecheck；
- v1/v2 fixture 可被类型化读取；
- 现有 Forma 构建入口不引用新应用。

## 3. 阶段 1：Skill Plugin 与安装管理

状态：已完成

### 工作

- 建立 `packages/forma-ai-ui-designer`；
- 将现有 Skill 迁移为 `forma-ai-ui-designer`；
- 修改交付规则：工作台为默认交付，`review.html` 为可选导出；
- 增加 Plugin manifest、UI metadata 和版本；
- 在 CLI 中实现 Skill 检测、兼容比较和安装计划；
- 支持 `--skill=project|global|skip` 与 `--yes`；
- 项目级安装到 `.agents/skills/`，全局位置通过 `CODEX_HOME` 解析；
- 使用临时目录、校验和与原子替换；
- 拒绝覆盖没有管理标记的目录。

### 交互规则

| 检测结果       | 行为                           |
| -------------- | ------------------------------ |
| 项目级兼容版本 | 直接复用，不询问               |
| 全局兼容版本   | 直接复用，不询问               |
| 只有旧版本     | 询问项目级安装或升级全局版本   |
| 只有更高版本   | 复用并提示，不自动降级         |
| 未安装         | 询问项目级（推荐）、全局或跳过 |
| 非托管同名目录 | 停止覆盖并给出处理建议         |

### 完成条件

- `init` 在三种 scope 下产生确定结果；
- 重复执行不会重复复制或损坏 Skill；
- 项目配置不记录个人绝对路径；
- 安装后的 Skill 能被发现并读取 references。

## 4. 阶段 2：Design Workspace SDK

状态：已完成

### 工作

- 实现 `openDesignWorkspace()`；
- 实现 project、tokens、components、flows 和图片读取；
- 实现路径、ID、组件版本、transition、annotation 和图片尺寸校验；
- 实现 v1 到运行时文档的兼容适配；
- 实现确定性流程自动布局；
- 把每个页面映射为 Frame Node + Image Node；
- 实现 `WorkspaceChangeSet`、revision、锁文件和原子写入；
- 实现稳定 revision 的文件监听。

### Interface 验证场景

- 单流程、多流程、跨流程 transition；
- page、modal、drawer、state；
- 缺图、尺寸不符、路径穿越、重复 ID；
- 组件版本缺失、Token 版本不一致；
- 两个调用方基于同一 revision 写入；
- Agent 写文件期间 watcher 不读取半成品。

### 完成条件

- CLI 与工作台只调用 SDK Interface，不自行读取业务 JSON；
- 同一资产输入始终产生相同运行时节点和默认坐标；
- 写入冲突返回可展示的结构化结果；
- v1 资产可以无修改打开。

## 5. 阶段 3：最小工作台纵向切片

状态：已完成

### 工作

- 新建独立 `apps/ai-design-workbench`；
- 实现顶栏、左侧流程栏、中央画布和右侧检查器；
- 复用视口算法实现拖动、缩放与适应画布；
- 渲染 Frame Node 和原始 Image Node；
- 根据 transition 渲染正交带箭头连线；
- 实现页面选择、连线选择和流程切换；
- 实现原图查看器；
- 实现 annotation 序号、引导线和默认隐藏气泡；
- 实现全局标注开关与跨流程跳转；
- 展示 Tokens、组件规范引用。

### 完成条件

- 打开 v1 设计目录即可看到与原 review 流程信息等价的画布；
- 图片保持原始比例，不裁切；
- 连接线完全来自 transition；
- 标注不写入图片且默认不展开；
- 页面、连线和组件引用都能在检查器定位来源文件。

## 6. 阶段 4：布局写回与实时更新

状态：已完成

### 工作

- 工作台通过 ChangeSet 写回节点位置和默认视口；
- 旧资产中的 review 元数据忽略；
- Tokens 或组件版本变化时计算受影响页面；
- watcher 检测 Agent 完成的新 revision 并刷新画布；
- 冲突时保留用户当前画布状态并展示差异；
- Skill 完成口径改为 SDK 校验成功和工作台可浏览。

### 完成条件

- `Skill 生成 → 工作台查看 → 用户反馈 → Skill 继续修改` 形成闭环；
- 布局调整不修改 transition；
- 旧页面版本和 Prompt 仍可追溯；
- 任何冲突都不静默覆盖。

## 7. 阶段 5：CLI 发行

状态：已完成

### 命令

```bash
npx @forma/ai-design-workbench init
npx @forma/ai-design-workbench open ./design
npx @forma/ai-design-workbench validate ./design
npx @forma/ai-design-workbench skill status
npx @forma/ai-design-workbench skill install --scope project
```

### 工作

- 将构建后的 Web 资源打包进 CLI；
- 单进程提供静态资源与本地接口；
- 自动选择可用端口并绑定 `127.0.0.1`；
- 浏览器和接口保持同源；
- 增加跨平台路径、Windows 和无浏览器环境处理；
- 提供 `--no-open`、`--port` 和结构化 JSON 输出。

### 完成条件

- 消费项目无需克隆本仓库即可通过 npx 使用；
- 不要求独立启动 API 或 Vite；
- 端口被占用时能安全选择其他端口；
- 初始化不会覆盖已有设计资产。

## 8. 阶段 6：兼容导出与未来扩展

状态：离线 `export-html` 已完成；云端市场、远程资产、CRDT、图片结构化还原等明确保持在本地最小产品边界之外。

以下内容不进入最小版本：

- `export-html` 离线设计导出；
- 云端模板市场；
- 远程设计资产源；
- 多人协作和 CRDT；
- 图片内容的结构化还原；
- 完整评论会话；
- 跨项目组件库。

当云端模板市场出现时，其下载结果必须遵循同一个 design contract。只有同时存在本地与远程两个真实来源时，才引入资源来源 port 和对应 Adapter。

## 9. 推荐实施切片

为了尽快得到真实反馈，建议按以下可演示切片推进：

1. **只读打开**：CLI 打开一个现有 v1 设计目录，显示单流程图片节点。
2. **完整流程**：增加连线、标注、检查器和多流程跳转。
3. **系统规范**：增加 Tokens、组件规范和版本影响提示。
4. **安全写回**：增加 layout、revision 和冲突处理。
5. **Skill 安装**：完成项目级/全局安装和新版完成口径。
6. **正式发行**：打包单进程 npx 体验和兼容导入。

第一切片就必须从真实 `flow.json` 和真实图片运行，避免先搭建无法验证契约的空 UI 壳。
