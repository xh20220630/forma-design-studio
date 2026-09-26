# @forma/ai-design-workbench-ui · AI 设计工作台

React/Vite 应用，展示 SDK 提供的工作空间文档、流程画布与设计系统，并提交带修订号的文档和标注变更。由 `@forma/ai-design-workbench` CLI 托管。

## 源码布局

```text
src/
  main.tsx                  React 挂载与全局主题 Provider
  app/
    App.tsx                 数据刷新、事件订阅、选区、视口与功能装配
    styles/                 工作台全局样式
  features/
    flow-canvas/
      components/           流程边与页面节点
      lib/                  世界坐标到屏幕坐标的连线几何
    design-system/
      components/           Token 与组件版本浏览
      lib/                  Token 展示条目转换
    inspector/components/   页面、转场、流程详情与简报入口
    documents/
      components/           文档、标注编辑器与 Markdown 预览
      hooks/                独立编辑快照、并发保存与离开保护
      model/                文档目标和编辑器契约
  shared/
    api/                    工作空间 HTTP 客户端与素材 URL
    types/                  相机、选区和视图类型
```

跨功能状态由 `app/` 持有，功能通过 props 和回调协作。文档与标注编辑器按需加载，共用编辑会话 hook；编辑草稿与服务端事件更新分离，保存继续携带原始修订号。

`pnpm --filter @forma/ai-design-workbench-ui dev` 启动开发服务，`/api`、`/assets` 代理到本地 SDK 服务。`pnpm --filter @forma/ai-design-workbench-ui build` 生成 `dist/`，脚本和样式继续使用 `static/` 子目录，避免与设计素材的 `/assets/` 冲突。

CLI 的打包脚本会复制此应用的 `dist/` 到发行目录；日常使用根命令 `pnpm design ...` 完成前端与 CLI 的顺序构建。浏览器代码仅使用共享包的浏览器入口和 HTTP API。

通用边界见 [应用目录](../README.md) 和 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
