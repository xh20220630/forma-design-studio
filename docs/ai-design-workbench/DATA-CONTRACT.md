# AI Design Workbench 数据契约 v2

状态：实现前契约  
兼容输入：`ai-ui-designer` 数据契约 v1  
规范关键词：必须、不得、应当、可以

## 1. 目录布局

```text
forma.config.json
design/
  project.json
  DESIGN.md
  tokens.json
  components/
    index.json
    <component-id>/
      v<major>.md
  flows/
    index.json
    <flow-id>/
      BRIEF.md
      flow.json
      layout.json
      SUMMARY.md
      prompts/
        <page-id>.md
      images/
        <page-id>-v<revision>.<png|jpg|jpeg|webp>
  revisions/
    index.json

.forma/
  local-state.json
  cache/
  write.lock

.agents/
  skills/
    forma-ai-ui-designer/       # 仅选择项目级安装时存在
```

`design/` 中的文件可以提交 Git；`.forma/` 必须被忽略。`review.html` 不再是必需文件。`SUMMARY.md` 可以由 SDK 生成，但不能成为业务事实的唯一存储位置。

所有 JSON 使用 UTF-8、无注释。设计资产内部路径必须相对 `design/`，使用 `/`，不得包含绝对路径、URL、空段、`.` 或 `..`。

## 2. `forma.config.json`

```json
{
  "schemaVersion": 1,
  "designRoot": "./design",
  "workbench": {
    "openBrowser": true
  },
  "skills": {
    "forma-ai-ui-designer": {
      "requiredVersion": "^2.0.0"
    }
  }
}
```

- `designRoot` 相对配置文件所在目录解析；
- `requiredVersion` 表示项目兼容要求，不表示已经安装；
- 不得在该文件记录用户主目录或全局 Skill 的绝对路径。

## 3. `project.json`

```json
{
  "schema_version": 2,
  "revision": 7,
  "id": "acme-console",
  "name": "业务系统",
  "theme": {
    "id": "product-ui",
    "version": "1.1.0",
    "status": "approved",
    "confirmation": "用户选定方向 B",
    "design_path": "DESIGN.md",
    "tokens_path": "tokens.json",
    "anchor_image": "flows/order/images/list-v2.png"
  }
}
```

- `revision` 是整个设计根目录的乐观并发版本；
- `id` 创建后必须稳定；
- Skill 或工作台完成一次原子变更后递增 `revision`；
- theme 版本变化不自动修改历史页面的验收状态，但必须标记受影响页面。

## 4. Tokens

`tokens.json` 沿用七组语义 Token：

```json
{
  "schema_version": 2,
  "theme_version": "1.1.0",
  "tokens": {
    "color": {},
    "typography": {},
    "spacing": {},
    "radius": {},
    "shadow": {},
    "layout": {},
    "motion": {}
  }
}
```

Token key 必须是稳定的语义路径。页面图片不会绑定或解析 Token 值；工作台使用 Tokens 做展示、版本追踪和影响分析。

## 5. 组件索引

```json
{
  "schema_version": 2,
  "components": [
    {
      "id": "data-table",
      "version": "1.0.0",
      "name": "业务数据表格",
      "status": "approved",
      "scope": ["多条记录比较", "批量操作"],
      "excludes": ["图片优先浏览"],
      "tags": ["列表", "筛选"],
      "spec_path": "components/data-table/v1.md"
    }
  ]
}
```

组件是设计规范。首期契约不包含 React 组件、场景节点或可执行代码。页面必须引用确切版本，不得只引用 `latest`。

## 6. 流程索引

```json
{
  "schema_version": 2,
  "flows": [
    {
      "id": "order",
      "name": "订单处理",
      "scope": ["查看订单", "取消订单"],
      "path": "flows/order/flow.json",
      "layout_path": "flows/order/layout.json",
      "related_flows": ["refund"]
    }
  ]
}
```

`related_flows` 中的 ID 必须存在。流程索引只负责发现，不复制页面或 transition。

## 7. 流程文件

```json
{
  "schema_version": 2,
  "id": "order",
  "name": "订单处理",
  "goal": "定位并处理待发货订单",
  "theme_version": "1.1.0",
  "brief_path": "flows/order/BRIEF.md",
  "entry_page": "list",
  "consistency_notes": ["表格沿用全局紧凑密度"],
  "pages": [
    {
      "id": "list",
      "name": "订单列表",
      "kind": "page",
      "platform": "desktop",
      "goal": "找到待处理订单",
      "image": "flows/order/images/list-v2.png",
      "image_revision": 2,
      "width": 1920,
      "height": 1080,
      "target_width": 1920,
      "target_height": 1080,
      "prompt_path": "flows/order/prompts/list.md",
      "reference_images": [],
      "component_usage": [
        {
          "id": "data-table",
          "version": "1.0.0",
          "adaptation": "突出履约状态"
        }
      ],
      "annotations": [
        {
          "id": "filter",
          "label": "仅查看待发货",
          "text": "点击状态筛选；无匹配项时显示空状态。",
          "x": 0.35,
          "y": 0.22,
          "label_x": 0.7,
          "label_y": 0.1,
          "target": null
        }
      ]
    }
  ],
  "transitions": [
    {
      "id": "list-to-cancel",
      "from": "order/list",
      "to": "order/cancel",
      "intent": "open",
      "trigger": "点击取消",
      "condition": "尚未发货且有操作权限",
      "effect": "打开取消原因弹层"
    }
  ]
}
```

### 页面规则

- `kind` 为 `page`、`modal`、`drawer` 或 `state`；
- 非 page 节点必须提供 `parent`，格式为 `flow-id/page-id`；
- `width`、`height` 必须等于图片实测像素；
- 图片只能使用 PNG、JPEG 或 WebP；首期不接受外链图片。

### Transition 规则

- `id` 在流程内唯一且稳定；
- `from` 和 `to` 必须引用真实页面；
- `intent` 可为 `open`、`navigate`、`close`、`cancel`、`success` 或 `back`，建议显式填写；
- 跨流程目标必须登记在 `related_flows`；
- modal、drawer 必须至少有一条关闭、取消或成功返回 transition；
- 工作台不得因画布排列自行创建 transition。

### Annotation 规则

- 坐标为图片左上角原点的 0–1 归一化值；
- 标注正文不写入图片；
- `target` 非空时必须指向真实页面；
- annotation 与设计评论是不同概念，首期不复用现有 Forma 评论类型。

## 8. `layout.json`

业务流程和视觉布局分离：

```json
{
  "schema_version": 1,
  "flow_id": "order",
  "nodes": {
    "list": { "x": 0, "y": 0 },
    "cancel": { "x": 2300, "y": 0 }
  },
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 0.35
  }
}
```

`nodes` 只保存人工调整过的位置。缺少节点位置时由 SDK 进行确定性自动布局。`viewport` 是可共享的默认视图；用户临时视口保存在 `.forma/local-state.json`。

## 9. 运行时投影

以下类型由 SDK 产生，不直接持久化：

```ts
interface WorkspaceDocument {
  project: ProjectMeta;
  designSystem: {
    tokens: TokenCollection;
    components: DesignComponentSpec[];
    impacts: DesignImpact[];
  };
  flows: WorkspaceFlow[];
  revision: number;
}

interface WorkspaceFlow {
  id: string;
  name: string;
  goal: string;
  sourcePath: string; // 流程索引声明的源文件
  brief?: { path: string; content: string }; // brief_path 对应的 Markdown
  nodes: FlowPageNode[];
  edges: FlowEdge[];
}

interface FlowPageNode {
  id: string;
  pageRef: string;
  kind: "page" | "modal" | "drawer" | "state";
  frame: { x: number; y: number; width: number; height: number };
  image: ImageNode;
  annotations: AnnotationNode[];
  componentUsage: ComponentReference[];
}

interface ImageNode {
  id: string;
  type: "image";
  assetPath: string;
  width: number;
  height: number;
  intrinsicWidth: number;
  intrinsicHeight: number;
  locked: true;
}
```

运行时 ID 由稳定业务 ID 派生，不使用数组下标或随机 UUID。

`impacts` 列出因 Tokens 主题版本或已批准组件最新版本变化而存在版本差异的页面。

## 10. Skill 要求与本机状态

项目要求写入 `forma.config.json`。实际安装范围写入 `.forma/local-state.json`：

```json
{
  "schemaVersion": 1,
  "skills": {
    "forma-ai-ui-designer": {
      "scope": "global",
      "version": "2.0.1",
      "path": "/home/user/.codex/skills/forma-ai-ui-designer",
      "checksum": "sha256:..."
    }
  }
}
```

安装目录包含由 CLI 管理的标记：

```json
{
  "id": "forma-ai-ui-designer",
  "version": "2.0.1",
  "installedBy": "@forma/ai-design-workbench",
  "checksum": "sha256:..."
}
```

CLI 只能覆盖或删除带有匹配管理标记的目录。

## 11. `WorkspaceChangeSet`

```ts
interface WorkspaceChangeSet {
  baseRevision: number;
  operations: Array<
    | { type: "set-component-spec"; componentId: string; version: string; content: string; expectedContent: string }
    | { type: "set-flow-brief"; flowId: string; content: string; expectedContent: string }
    | { type: "update-annotation"; flowId: string; pageId: string; annotation: AnnotationNode; expectedAnnotation: AnnotationNode }
    | { type: "set-node-position"; flowId: string; pageId: string; x: number; y: number }
    | { type: "set-default-viewport"; flowId: string; x: number; y: number; zoom: number }
  >;
}
```

工作台通过 ChangeSet 保存布局、组件规范、流程 BRIEF 和设计注释，UI 不直接写文件。图片、Prompt 和 Tokens 仍由 Skill 维护。

- 组件引用与组件库中的“查看规范”打开 Markdown 阅读/编辑窗口，支持 GFM 表格、列表、任务列表与代码块，以及编辑/预览分栏；`set-component-spec` 根据组件 ID 和版本定位索引中的 `spec_path`，原样保存 UTF-8 正文，不自动升级组件语义版本。
- 当前流程的“流程设计依据”卡片和画布顶部“流程文档”入口展示 `brief_path` 对应的文档；`set-flow-brief` 写回该路径。不为缺少 `brief_path` 的 v1 流程猜测设计依据。
- 点击画布标注或检查器中的设计注释可修改标题、正文、锚点/标记位置、跳转页面；`update-annotation` 将字段映射回流程索引声明的源文件中的 `pages[].annotations[]`，保留其他原始字段。坐标仍为 0–1，非空跳转目标必须存在。
- 一次保存将内容文件与 revision 记录一起提交，最后写入 `project.json`，通过现有 revision 事件通知其他工作台窗口。修改不会自动重新生成页面图片。
- 编辑器固定编辑开始时的 `baseRevision`，同时提交 `expectedContent` 或 `expectedAnnotation`。版本或原内容发生变化时拒绝覆盖并保留草稿；取消编辑后可读取新内容。保存失败同样保留草稿。直接编辑文件的外部工具仍须递增 `project.json.revision` 才能触发实时通知。
- 文档路径只能来自现有组件/流程引用，且只编辑设计目录内的 `.md`；不提供任意文件写入接口。

## 12. Revision 记录

SDK 每次成功写入后在 `revisions/index.json` 追加一条记录：

```json
{
  "schema_version": 1,
  "revisions": [{
    "revision": 8,
    "created_at": "2026-09-23T08:00:00.000Z",
    "source": "ai-design-workbench",
    "operations": ["set-node-position"],
    "files": ["flows/order/flow.json", "project.json"]
  }]
}
```

冲突响应使用这些记录返回 `baseRevision`、`currentRevision` 和期间变更文件。

## 13. v1 兼容

SDK 必须支持读取现有 v1 目录：

- 缺少 `revision` 时视为 0；
- 缺少 `layout.json` 时自动布局；
- `approved`、`accepted-with-notes`、`needs-revision` 原样保留；
- 旧文件中的 `review` 字段忽略，不映射到运行时文档，不再接受 `set-review` 操作；
- `review.html` 被忽略；
- `SUMMARY.md` 作为派生说明读取，不覆盖 BRIEF 或 flow JSON；
- 第一次写入时升级为 v2，并生成独立 revision 记录。
