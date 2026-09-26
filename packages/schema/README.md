# @forma/schema · 设计数据契约

纯类型契约，包含项目、页面、节点、组件、变量与 Agent 通信模型。应用导航状态不属于此包。

源码包，由消费方处理 TypeScript；`pnpm --filter @forma/schema typecheck` 检查类型。

`@forma/schema`：设计类型；`@forma/schema/agent`：Agent 契约；`@forma/schema/source`：仅限 Node 的类型源码读取入口，供独立导出使用。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

## 目录与依赖

采用按业务域划分的数据契约结构，顶层 `design.ts`、`agent.ts`、`workbench.ts` 保留为公共类型导出入口。

- `src/contracts/design/`：主题、节点、协作、变量、项目、模型供应商和图像还原契约。
- `src/contracts/agent.ts`：Agent 请求、响应和会话契约。
- `src/contracts/workbench/`：工作区项目、设计系统、流程、文档、变更、诊断和事件契约。
- `src/node/design-source.ts`：Node 专用的设计类型源码读取与拼接。
- `tests/integration/`：验证内嵌契约能独立编译，且完整保留公共设计类型。

契约层只包含类型，通过 `import type` 引用依赖，不放入业务服务或运行时 I/O。新增设计契约模块时，同步维护 `node/design-source.ts` 的源码清单，避免独立导出遗漏类型。
