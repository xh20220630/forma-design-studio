# Forma 工作台数据契约

所有 JSON 使用 UTF-8、无注释。路径相对设计根目录并使用 `/`，不得包含绝对路径、外链、`.` 或 `..`。ID 使用小写字母、数字和连字符。

```text
design/
  project.json
  DESIGN.md
  tokens.json
  components/index.json
  components/<id>/v<major>.md
  flows/index.json
  flows/<flow-id>/BRIEF.md
  flows/<flow-id>/flow.json
  flows/<flow-id>/layout.json
  flows/<flow-id>/SUMMARY.md
  flows/<flow-id>/prompts/<page-id>.md
  flows/<flow-id>/images/<page-id>-v<revision>.png
```

## 项目与主题

```json
{
  "schema_version": 2,
  "revision": 1,
  "id": "business-system",
  "name": "业务系统",
  "theme": {
    "id": "product-ui",
    "version": "1.0.0",
    "status": "approved",
    "confirmation": "用户选定方向 B",
    "design_path": "DESIGN.md",
    "tokens_path": "tokens.json",
    "anchor_image": "flows/order/images/list-v1.png"
  }
}
```

`tokens.json` 按 color、typography、spacing、radius、shadow、layout、motion 七组保存语义 Tokens。

## 组件索引

```json
{
  "schema_version": 2,
  "components": [{
    "id": "data-table",
    "version": "1.0.0",
    "name": "业务数据表格",
    "status": "approved",
    "scope": ["多条记录比较"],
    "excludes": ["图片优先浏览"],
    "tags": ["列表"],
    "spec_path": "components/data-table/v1.md"
  }]
}
```

页面只能引用已存在的确切版本。

## 流程与页面

流程索引条目包含 `id`、`name`、`scope`、`path`、`layout_path` 和 `related_flows`。流程文件包含：

```json
{
  "schema_version": 2,
  "id": "order",
  "name": "订单处理",
  "goal": "定位并处理待发货订单",
  "theme_version": "1.0.0",
  "brief_path": "flows/order/BRIEF.md",
  "entry_page": "list",
  "consistency_notes": [],
  "pages": [{
    "id": "list",
    "name": "订单列表",
    "kind": "page",
    "platform": "desktop",
    "goal": "找到待处理订单",
    "image": "flows/order/images/list-v1.png",
    "image_revision": 1,
    "width": 1920,
    "height": 1080,
    "target_width": 1920,
    "target_height": 1080,
    "prompt_path": "flows/order/prompts/list.md",
    "reference_images": [],
    "component_usage": [],
    "annotations": []
  }],
  "transitions": []
}
```

`kind` 为 page、modal、drawer、state。非 page 节点需要 `parent`；modal/drawer 至少有一条关闭、取消或成功返回 transition。页面不包含评审状态；不要生成 `review` 字段。旧资产中的该字段由 SDK 忽略。

Transition 使用稳定 ID，并包含 from、to、trigger、condition、effect；建议用 intent 明确标记 open、navigate、close、cancel、success 或 back。跨流程引用必须登记 related_flows。modal/drawer 的退出 transition 必须使用 close、cancel、success、back intent，或在 trigger/effect 中明确写出对应退出语义。Annotation 坐标使用 0–1 归一化值，正文不得烧录进图片。

`layout.json` 只保存页面位置和默认视口，不保存业务关系。工作台缺少位置时会自动布局。
