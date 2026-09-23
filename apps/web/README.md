# @forma/web · Web 工作台

React/Vite 应用，负责页面导航、编辑器交互、项目缓存和 Agent 界面。业务代码位于 `src/`，上线素材位于 `public/`。

`pnpm --filter @forma/web dev` 启动开发服务；`pnpm --filter @forma/web build` 输出到本包 `dist/`。API 代理地址读取根 `.env` 的 `FORMA_PORT`。

依赖 `@forma/schema`、`@forma/renderer`、`@forma/editor-core`、`@forma/ui`。只在本应用中使用 `@/` 源码别名。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
