# Local Agent Bridge

`@forma/local-agent-bridge` 是独立的 Node.js 包，将本机 AI CLI 的标准输入输出接给应用客户端。它不依赖 Forma 的 API、React 或设计数据类型；目前内置 Codex、Claude Code 和 Kimi Code 适配器。需要 Node.js 22.18+。

## 在 Forma 中使用

打开“设置 → 模型连接 → 本地 Agent”，检测本机 CLI 后点击“添加连接”。先在终端完成对应 CLI 的登录。保存连接时可直接将它用于文本 / 视觉任务，也可以在“当前模型”中切换。

模型 ID `default` 表示沿用 CLI 的已配置模型；填写其他 ID 时会向 CLI 指定该模型。安装检测运行 `--version`；“获取模型”和 Codex 连接检测还会读取 `app-server` 的 `model/list`，不发送推理请求。目录不代替实际调用验证。编辑已保存的本地连接后点击“测试对话”，按当前文本模型选择发送一条真实测试消息；此操作使用 CLI 的模型额度，支持取消。模型失败时显示上游状态、排查步骤和真实目录，可直接切换；详见[已确认错误及排查](../../docs/troubleshooting/local-agent-models.md)。

本地连接支持对话、主题生成和图片输入；图片理解取决于所选模型。Codex 还支持内置生图，沿用 CLI 登录与额度，无需另选生图模型或配置 API Key。未配置就绪的独立生图连接时，Forma 自动复用当前文本 Codex；已有的可用生图配置优先使用。旧 Codex 连接自动获得生图能力。生成图片仍需人工确认后才能还原设计。

## Node 客户端

```ts
import { LocalAgentBridge } from '@forma/local-agent-bridge';

const bridge = new LocalAgentBridge();
const agents = await bridge.discover();
const catalog = await bridge.listModels('codex');
const controller = new AbortController();
const result = await bridge.run({
  agentId: 'codex',
  model: 'default',
  messages: [
    { role: 'system', content: 'Return a JSON object describing a UI theme.' },
    { role: 'user', content: 'Use soft green and a warm background.' },
  ],
  signal: controller.signal,
  onEvent: (event) => console.log(event),
});
console.log(result.text);
bridge.close();
```

Codex 内置生图使用同一接口，返回真实图片字节：

```ts
const image = await bridge.run({
  agentId: 'codex',
  task: 'image',
  model: 'default',
  messages: [{ role: 'user', content: '生成一个浅色任务管理应用的完整 UI 设计图。' }],
});
const bytes = Buffer.from(image.images![0].base64, 'base64');
```

`model` 选择调度任务的 Codex 模型，生图模型由内置工具选择。可通过图片内容块传入参考图，`transparentBackground` 控制背景要求。Claude / Kimi 暂不支持内置生图；CLI 版本或账号不支持时返回真实错误。

`discover()` 按 PATH 和常见用户安装目录查找 CLI，报告安装路径、版本及检测失败原因。内嵌宿主可以通过 `executables` 指定受信任的安装路径；HTTP 客户端不能指定可执行文件、额外参数或工作目录。默认最多同时运行两个请求。

Codex 文本请求可设置 `reasoningEffort: "low" | "medium" | "high" | "xhigh"`，仅覆盖本次请求。独立包省略时沿用 CLI 配置；Forma 网页连接默认 `medium`，视觉还原单独使用 600 秒上限。Codex 文本适配器关闭 shell、网页搜索与生图工具，仅接收模型回复。本地截止时间错误的 `upstreamCode` 是 `local_timeout`，不伪造上游 HTTP 状态。

每个请求使用新的子进程和临时工作目录。会话上下文由 `messages` 明确传递，不自动接续终端的历史会话。请求超时范围为 1–600 秒，默认 180 秒。取消、超时及协议失败会终止进程树；完成后删除临时目录。输入最多 25 MB，文本 CLI 输出最多 16 MB；生图输出流最多 96 MB，单图 Base64 最多 4000 万字符。图片采用 `data:image/...;base64,...` 内容块；Codex 接收临时图片文件，Claude 和 Kimi 接收内联图片。

## 独立 HTTP 客户端

```sh
node packages/local-agent-bridge/src/cli.ts list
node packages/local-agent-bridge/src/cli.ts serve --port 4312 --origin http://127.0.0.1:5173
```

包安装后也提供 `forma-agent-bridge` 命令。服务只绑定 `127.0.0.1`，启动时生成并显示访问 Token；也可由宿主通过 `FORMA_BRIDGE_TOKEN` 设置至少 16 字符的 Token。浏览器客户端必须匹配显式配置的来源，所有请求都需要 `Authorization: Bearer <token>`。Token 不应写入公共网站源码。

| 请求                                       | 用途                                                    |
| ------------------------------------------ | ------------------------------------------------------- |
| `GET /agents`                              | 检测本机支持的 CLI                                      |
| `GET /agents/:agentId/models`              | 查询模型目录，返回 `{models, source}`                   |
| `POST /runs`                               | 执行一次消息请求；返回 `{runId, agentId, text}`         |
| `POST /runs` + `Accept: text/event-stream` | 流式返回 `started`、`text`、`completed` 或 `error` 事件 |
| `DELETE /runs/:runId`                      | 取消当前运行的请求                                      |

`POST /runs` 接收 `{agentId, messages, model?, timeoutMs?, reasoningEffort?, task?:"text"|"image", transparentBackground?:boolean}`。生图仅支持 `agentId:"codex"`，最终结果包含 `images:[{base64,mimeType}]`，不要求文字回复。`completed` 事件包含完整最终回复；`text` 事件的粒度取决于 CLI：Kimi 提供增量消息，Codex 和 Claude 可以在一段消息结束后发送文本。客户端断开连接也会取消请求。宿主可以通过 `@forma/local-agent-bridge/server` 的 `createBridgeServer()` 内嵌同样的 HTTP 服务。

## 协议与执行边界

`listModels(agentId, signal?)` 返回 Codex 当前 CLI 的非隐藏模型，支持分页和 20 秒超时；Claude 与 Kimi 暂返回 `source: "default-only"`，不伪造账号模型目录。`LocalAgentRequestError` 保留 CLI 错误中的 `upstreamStatus` 与 `upstreamCode`，独立 HTTP 响应和 SSE 错误事件也返回这两个字段；桥接 HTTP 的 502 与上游的 400 分别表示不同层级。

- Codex：`exec --json`，提示词写入 stdin，读取 JSONL 的最终 Agent 消息，使用只读 sandbox。
- Codex 生图：`app-server --stdio`，通过 `thread/start` 和 `turn/start` 调用内置生图，提取 `imageGeneration` 图片结果；禁用 shell 和网页搜索，拒绝客户端工具调用。不会将文字中的文件路径当成图片读取。
- Claude Code：`--print --input-format stream-json --output-format stream-json`，通过 stdin 传递消息，禁用内置工具及外部 MCP。
- Kimi Code：`acp`，完成 `initialize`、`session/new`、`session/prompt` 握手，读取 `session/update`，拒绝工具权限请求；支持模型覆盖和图片能力检查。

临时目录用于隔离项目配置，不能替代操作系统级隔离。CLI 仍沿用本机账号、网络和用户配置；安装成功不代表账号或模型可调用。协议不兼容、登录失效、订阅限制和默认模型无权限时会返回真实失败，不产生假回复。

适配器参考：[Codex JSONL](https://developers.openai.com/blog/eval-skills)、[Claude Code 编程式调用](https://code.claude.com/docs/en/headless)、[Kimi ACP](https://moonshotai.github.io/kimi-code/en/reference/kimi-acp)。
