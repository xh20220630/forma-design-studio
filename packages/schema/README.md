# @forma/schema · 设计数据契约

纯类型契约，包含项目、页面、节点、组件、变量与 Agent 通信模型。应用导航状态不属于此包。

源码包，由消费方处理 TypeScript；`pnpm --filter @forma/schema typecheck` 检查类型。

`@forma/schema`：设计类型；`@forma/schema/agent`：Agent 契约；`@forma/schema/source`：仅限 Node 的类型源码读取入口，供独立导出使用。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
