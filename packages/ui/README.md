# @forma/ui · 基础 UI

shadcn/Radix 基础组件、主题 CSS 和类名工具。两个工作台共用 Studio 主题、品牌标识和画布视觉基础；业务页面与品牌动效保留在 Web 应用。

React 和 ReactDOM 是 peer dependencies，由消费应用提供。Tailwind 样式显式扫描本包 `src/`；应用还需启用自己的 Tailwind 内容扫描。

按组件引用，例如 `@forma/ui/button`、`@forma/ui/dialog`；样式入口为 `@forma/ui/styles.css`，工具入口为 `@forma/ui/utils`。组件内部使用相对路径，不能依赖应用别名。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

`@forma/ui/studio-theme` 提供主题 Provider、预设与设置存储；`@forma/ui/studio-tokens.css` 提供默认语义变量。`@forma/ui/brand`、`@forma/ui/canvas-rulers` 和 `@forma/ui/canvas.css` 由完整工作台与最小工作台共同引用，保证画布与界面主题同源。

## 目录与依赖

基础控件保留 shadcn/Radix 的 `src/components/*.tsx` 文件布局，与 `components.json` 和按组件导入方式保持一致。

- `components/composites/`：品牌标识、画布标尺等组合组件；使用独立的包导出映射。
- `theme/types.ts`、`presets.ts`：主题契约、预设和默认值。
- `theme/settings.ts`、`storage.ts`：设置校验、版本化存储解析和本机读取。
- `theme/tokens.ts`：不依赖 React 的语义变量计算。
- `theme/StudioThemeProvider.tsx`：React 状态、跨窗口同步和 DOM 主题生命周期。
- `theme/StudioTheme.tsx`：兼容原有主题公共入口。
- `lib/utils.ts`：通用类名合并工具；`tests/unit/` 验证纯主题逻辑。

CSS 公共入口和 Tailwind 对 `src/` 的扫描范围保持不变；组件与主题模块不依赖应用内部代码。
