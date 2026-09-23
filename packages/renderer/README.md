# @forma/renderer · 场景渲染器

设计画布的 Canvas 2D 引擎，以及缩略图、原型与导出 React 使用的 DOM/SVG 渲染器，依赖 `@forma/schema`。两种后端共享主题、变量解析与设计数据。

TSX 由消费应用的 Vite 编译，React 由消费方提供。无需单独构建。

`@forma/renderer`：DOM/SVG 渲染函数和组件；`@forma/renderer/canvas`：`CanvasRenderer` 与命中/框选句柄；`@forma/renderer/source`：仅限 Node 的 `getStandaloneRendererSource()`，返回含类型的独立 TSX 源码，不依赖工作区包。

Canvas 引擎将场景与编辑覆盖层分开，使用视口尺寸位图、空间索引、按需帧调度、路径/文字缓存和 64 MiB LRU 位图缓存。React 负责文档和控件；连续交互在编辑器内预览，手势结束才发布文档。Canvas 节点没有对应 DOM，文本编辑时临时创建输入框。

实现位于 `src/canvas/`：`scene.ts` 编译层级、变换、组件实例；`geometry.ts` 管理空间索引和坐标；`painter.ts` 负责绘制及缓存；`engine.ts` 管理帧调度、命中和覆盖层。能力边界见 [画布能力清单](../../docs/CANVAS-CAPABILITIES.md)。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
