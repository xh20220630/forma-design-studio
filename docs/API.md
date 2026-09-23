# Forma Local API

启动：`pnpm install` 后执行 `pnpm dev`。页面默认 `http://127.0.0.1:5173`，API 默认 `http://127.0.0.1:4310`。Node.js 22.18+、pnpm 10.20.0，GitHub 克隆需要 Git。`pnpm dev:api` 只启动 API；存在 `apps/web/dist/` 时 API 也会提供构建后的前端。开发页面通过 Vite 的 `/api` 代理访问服务。

所有写请求使用 `Content-Type: application/json`。错误响应为 `{ "error": "可读的错误信息" }`，常见状态码：400 输入错误，404 未找到，409 版本或同步冲突，502 模型服务失败。若设置了 `FORMA_AGENT_TOKEN`，外部 agent 需要 `Authorization: Bearer <token>`。

## 项目

| 方法 | 路径 | 请求 / 响应 |
| --- | --- | --- |
| GET | `/api/health` | `{ok,service,providerConfigured}` |
| GET | `/api/state` | `{projects: Project[]}` |
| GET | `/api/projects/:id` | `Project` |
| PUT | `/api/projects/:id` | 请求完整 Project，返回保存后的 Project |
| DELETE | `/api/projects/:id` | 删除设计数据，返回 `{ok:true}`；保留工作空间与图片资源 |
| GET | `/api/projects/:id/export` | 下载 `{projectId,revision,files:[{path,content}]}` |

项目结构见 `packages/schema/src/design.ts`。创建时 `revision: 0`；每次成功更新，使用返回对象中的新 revision 继续编辑。服务端对已有项目要求请求 revision 与当前相同，不同返回 409；读取最新项目、合并设计后再提交。普通 PUT 不能更改服务端管理的 generation 审批信息或绑定路径，只能切换已绑定 workspace 的 `autoSync`。

节点 `src` 支持 HTTP(S)、PNG/JPEG/WebP/SVG base64 data URL，或精确的 `/api/assets/<文件名>.png|jpeg|jpg|webp|svg` 本地图片地址；不接受目录跳转、编码路径或查询参数。SVG 只接受基本形状、分组、渐变和裁剪定义；拒绝脚本、事件、外部资源、内联样式与不支持的标签。导出与同步会将项目本地图片嵌入设计 JSON；图片缺失或不安全时返回错误，而不是输出依赖 Forma API 的失效地址。

场景类型包括 `frame/text/rectangle/button/image/component/group/ellipse/line/polygon/star/path/section`。可选字段支持旋转、翻转、描边、渐变、效果、文字样式、点路径、自动布局、尺寸约束、组件覆盖与原型。`path` 仅允许 SVG path 的坐标指令，不接受 XML；完整契约见 `DesignNode`。`prototype` 的动作是 `navigate/overlay/back/url`，触发方式为 `click/hover`；外部 URL 仅支持 HTTP(S)。

项目同时支持 `themeModes`、`activeMode`、`variableCollections`、`activeVariableModes`、`comments` 与 `snapshots`。节点的 `variableBindings` 使用 `{ "fill": { "collectionId": "colors", "variableId": "accent" } }` 结构，属性类型必须与变量类型匹配。颜色变量可绑定 `fill/color/stroke`，字符串可绑定 `text/name`，布尔变量可绑定 `visible/locked`，数值可绑定尺寸、位置和常见数值样式；引用不存在的变量会拒绝保存。实例 `overrides` 使用子节点 ID 映射 `{text?,fill?,visible?}`。旧项目未填写任何新字段时继续有效。

如果自动同步遇到冲突，保存仍成功，响应额外包含 `syncWarning`，而 `lastSyncedRevision` 保持上次同步成功的版本。项目更新和自动生成都会保留稳定 ID 的作用：消费代码通过 `pageId`、`componentId` 和 `nodeId` 集成。

## 模型设置与生成

| 方法 | 路径 | 请求 | 响应 |
| --- | --- | --- | --- |
| GET | `/api/settings` | — | `{configured,baseUrl,textModel,imageModel}` |
| POST | `/api/settings` | `{apiKey?,baseUrl,textModel,imageModel}` | 同 GET；空 apiKey 保留当前密钥 |
| POST | `/api/generate/theme` | `{prompt}` | `{name,description,tokens}` |
| POST | `/api/generate/image` | `{projectId,prompt}` | `{imageUrl,project}` |
| POST | `/api/generate/approve` | `{projectId}` | `{approved:true,project}` |
| POST | `/api/generate/design` | `{projectId,prompt?}` | `{pages,components,project,syncWarning?}` |

`image → approve → design` 是强制顺序。每次重新生成图片都会重置批准状态。修改 tokens、主题/变量模式、变量集合、主组件或页面规格会令设计上下文指纹失效，必须重新生成图片后再批准。还原接口的可选 `prompt` 必须与生成图片时的需求相同，或直接省略；不能跳过图片确认来改变设计需求。还原调用必须使用支持视觉输入的文本模型。主题生成只返回主题，调用方确认后将 tokens 应用到项目并 PUT 保存。

从 UI 或 Agent 发起生成前，应先保存本地编辑。图像生成和视觉还原会真实调用配置模型并可能产生模型服务费用；自动化重试由调用方决定。未配置密钥时直接返回说明，不生成占位结果。

## 工作空间与同步

| 方法 | 路径 | 请求 | 响应 |
| --- | --- | --- | --- |
| POST | `/api/workspace/bind` | `{projectId,kind:"local",path:"绝对目录"}` | `{workspace,project}` |
| POST | `/api/workspace/bind` | `{projectId,kind:"github",repo:"https://github.com/owner/repo",branch?}` | 克隆完成后返回 `{workspace,project}` |
| POST | `/api/sync/preview` | `{projectId}` | `{files:[{path,content,status}],revision,conflicts:string[]}` |
| POST | `/api/sync/apply` | `{projectId,revision?}` | `{files,revision,project}`；文件冲突或指定的预览版本过时返回 409 |

状态为 `added`、`modified`、`unchanged`、`conflict`。预览只读取文件，不修改工作空间。建议应用时传入预览返回的 `revision`；省略时明确使用当前最新设计。同步时会重新检查冲突并再次核对写入前的文件哈希；不会依据过时的文件预览直接覆盖。一个工作空间生成目录只能属于一个项目。

首次手动同步完成后，保存完整 Project 并设置 `workspace.autoSync: true` 可启用后续自动更新。GitHub 绑定只管理本地克隆的生成目录，没有自动推送。项目与本地业务应用的接入方法见 [架构说明](./ARCHITECTURE.md)。

## Agent 接入示例

```js
const base = 'http://127.0.0.1:4310/api';
const headers = {
  'Content-Type': 'application/json',
  ...(process.env.FORMA_AGENT_TOKEN
    ? { Authorization: `Bearer ${process.env.FORMA_AGENT_TOKEN}` }
    : {}),
};

const { projects } = await fetch(`${base}/state`, { headers }).then(r => r.json());
const project = projects[0];
project.tokens.primary = '#6d5ce8';
const response = await fetch(`${base}/projects/${project.id}`, {
  method: 'PUT', headers, body: JSON.stringify(project),
});
if (!response.ok) throw new Error((await response.json()).error);
const saved = await response.json();

const preview = await fetch(`${base}/sync/preview`, {
  method: 'POST', headers, body: JSON.stringify({ projectId: saved.id }),
}).then(r => r.json());
console.log(preview);
```

当前是 REST 集成，没有预置 Agent SDK 或 MCP server。任意能够发 HTTP 请求并遵循 Project schema 的 agent 都可以读写设计、生成主题或调用完整图片审批流程；具体模型推理和开发工具由 agent 自己提供。

## 内置 Agent 对话

对话使用配置的文本模型生成结构化操作计划，由服务端验证并执行。会话与消息保存在 `.data/agent-sessions.json`，重启后保留；每个会话的并发回复会被拒绝，执行中断后的历史会标记失败。全局会话用于创建项目，创建后绑定返回的项目继续工作；项目内会话固定绑定单个项目，不能访问、切换或修改其他项目。

| 方法 | 路径 | 请求 / 响应 |
| --- | --- | --- |
| GET | `/api/agent/sessions` | `{sessions: AgentSessionSummary[]}`，仅全局会话 |
| GET | `/api/agent/sessions?projectId=<id>` | 仅该项目的项目内会话 |
| POST | `/api/agent/sessions` | `{projectId?,title?}` → HTTP 201，`AgentSession` |
| GET | `/api/agent/sessions/:id` | `AgentSession`，包含完整消息及操作结果 |
| POST | `/api/agent/sessions/:id/messages` | `{content?,sessionRevision?,projectRevision?,action?}` → `AgentTurnResponse` |

类型契约在 `packages/schema/src/agent.ts`。`sessionRevision` 防止基于旧对话继续提交；`projectRevision` 可要求项目仍处于前端已保存的版本。响应包含 `session`、`message`，以及实际结果的 `project`、`syncPreview`。执行出错时返回对应 HTTP 状态及 `error`，已经开始的对话仍包含已保存的 `session/message`。部分操作成功、后续失败时，成功结果保留并明确列出；不会回滚已经完成的设计修改。并发设计冲突时，响应的 `project` 为服务端最新状态，不能用过时的推理快照覆盖当前设计。

模型允许请求以下有限操作：

- `create_project`：仅全局会话可用，系统分配独立项目 ID，创建空白页面。
- `update_tokens`：修改已绑定项目的主题 Token，保留未指定值和节点绑定，同时更新当前主题模式。
- `create_variables`：创建自定义变量集合、模式，以及颜色、数字、字符串和布尔变量，使用现有项目 schema 校验。
- `create_component`：添加新的可复用组件，验证尺寸、图层、token/变量/组件引用，拒绝覆盖已有组件 ID。
- `generate_image`：调用真实图片模型，生成后等待用户确认。
- `reconstruct_design`：仅还原当前已经确认的图片，保留原有审批与版本检查。
- `preview_sync`：生成代码预览，不直接写入工作空间。

确认控件通过以下 `action` 提交，直接执行对应步骤，不让模型代替用户确认：

```json
{"action":{"type":"approve_image","projectId":"...","revision":7,"imageUrl":"/api/assets/....png"}}
```

```json
{"action":{"type":"reconstruct_design","projectId":"...","revision":8,"imageUrl":"/api/assets/....png"}}
```

```json
{"action":{"type":"apply_sync","projectId":"...","revision":9,"previewId":"..."}}
```

图片确认与还原需要当前项目版本和图片地址一致。同步应用需要该会话产生的、尚未使用的 `previewId`，并再次核对版本、绑定工作空间、生成文件内容及实际磁盘文件基线；文件变更或重复使用预览会返回 409。模型计划中的 `approve_image` 和 `apply_sync` 一律拒绝。已由用户开启且完成过首次手动同步的 `workspace.autoSync` 仍适用于聊天中的主题、变量、组件和还原修改；发生冲突时设计照常保存，操作结果返回 `syncWarning`，不会覆盖本地修改。未完成首次手动同步时不自动创建生成目录。

聊天当前不执行任意终端命令、安装依赖、推送 Git、部署应用或连接未知仓库。开发代码交付复用现有 React 导出与工作空间同步。自然语言理解和设计质量取决于配置模型；缺少模型密钥或模型返回非法计划时显示真实错误，不生成模拟成功回复。

## 验证

`pnpm test` 执行 Node 原生测试。测试使用临时目录和本地模拟模型 HTTP 服务，不产生真实模型调用费用，验证持久化、版本冲突、批准门槛、图片传给视觉模型、自动同步、外部修改保护、路径与循环检查。真实模型效果、网络和付费账号需要使用实际配置验证。
