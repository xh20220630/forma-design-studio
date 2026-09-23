# @forma/api · 本地 API

Express + TypeScript ESM 服务，负责 JSON 持久化、模型调用、Agent 会话、工作空间绑定和代码同步。

`pnpm --filter @forma/api dev` 使用 Node watch；`pnpm --filter @forma/api start` 直接运行 `src/index.ts`。使用 Node.js 22.18+ 的原生类型擦除，无需运行时转译依赖。根 `.env`、`.data/` 与 `apps/web/dist/` 使用固定路径，不依赖进程工作目录。

源码使用 `@forma/typescript-config/node.json` 开启严格类型检查与 NodeNext 模块解析，复用 `@forma/schema` 的项目和 Agent 契约。HTTP 请求与模型 JSON 在边界校验后进入业务操作；错误捕获使用 `unknown`。

通过 `@forma/renderer/source` 取得独立 React 导出源码；不得读取 Web 应用的内部源码。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
