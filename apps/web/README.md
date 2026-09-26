# @forma/web · Web 工作台

React/Vite 应用，负责页面导航、编辑器交互、项目缓存和 Agent 界面。业务代码位于 `src/`，上线素材位于 `public/`。

`pnpm --filter @forma/web dev` 启动开发服务；`pnpm --filter @forma/web build` 输出到本包 `dist/`。API 代理地址读取根 `.env` 的 `FORMA_PORT`。

依赖 `@forma/schema`、`@forma/renderer`、`@forma/editor-core`、`@forma/ui`。只在本应用中使用 `@/` 源码别名。

## 源码布局

```text
src/
  main.tsx
  app/
    App.tsx                 应用装配与跨功能状态
    router/                 Hash 路由与导航定义
    providers/              全局 Motion、Tooltip 配置
    styles/                 全局样式与工作台外观
  features/
    projects/               项目列表、概览、创建、重命名和启动数据
    editor/                 画布、属性面板、图层、原型与视口 hook
    agent/                  Agent 聊天
    reconstruction/         参考图和还原进度
    providers/              模型供应商连接
    workflow/               助手配置、设置、绑定与同步
    library/                模板、组件和设计变量
    appearance/             主题工作室
  entities/project/
    model/                  项目与模板种子数据
    ui/                     项目标记、预览和预览样式
  shared/
    api/                    HTTP 客户端
    lib/                    动效偏好与资源约定
    theme/                  共享 UI 包的主题入口
    types/                  导航类型
    ui/                     弹窗、品牌和展示动效
```

功能组件、hooks、模型和样式在各自功能内维护；底层 `entities/`、`shared/` 不依赖功能或应用入口。公共控件继续由 `@forma/ui` 提供。项目预览拥有独立样式，不依赖素材库页面实现。

`public/` 的品牌 URL 保持 `/brand/...`。`tooling/docs-preview.ts` 为开发服务提供 `/docs/` 预览，文档组件引用使用 `@/shared/...`。`components.json` 的生成路径与新目录一致。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
