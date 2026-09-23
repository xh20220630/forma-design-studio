# @forma/ui · 基础 UI

shadcn/Radix 基础组件、主题 CSS 和类名工具。两个工作台共用 Studio 主题、品牌标识和画布视觉基础；业务页面与品牌动效保留在 Web 应用。

React 和 ReactDOM 是 peer dependencies，由消费应用提供。Tailwind 样式显式扫描本包 `src/`；应用还需启用自己的 Tailwind 内容扫描。

按组件引用，例如 `@forma/ui/button`、`@forma/ui/dialog`；样式入口为 `@forma/ui/styles.css`，工具入口为 `@forma/ui/utils`。组件内部使用相对路径，不能依赖应用别名。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

`@forma/ui/studio-theme` 提供主题 Provider、预设与设置存储；`@forma/ui/studio-tokens.css` 提供默认语义变量。`@forma/ui/brand`、`@forma/ui/canvas-rulers` 和 `@forma/ui/canvas.css` 由完整工作台与最小工作台共同引用，保证画布与界面主题同源。
