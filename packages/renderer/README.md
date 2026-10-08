# @forma/renderer · 场景渲染器

设计画布的保留场景与分块 2D 引擎，以及缩略图、原型与导出 React 使用的 DOM/SVG 渲染器，依赖 `@forma/schema`。两种后端共享主题、变量解析与设计数据。

TSX 由消费应用的 Vite 编译，React 由消费方提供。无需单独构建。

`@forma/renderer`：DOM/SVG 渲染函数和组件；`@forma/renderer/canvas`：`CanvasRenderer` 与命中/框选句柄；`@forma/renderer/source`：仅限 Node 的 `getStandaloneRendererSource()`，返回含类型的独立 TSX 源码，不依赖工作区包。

主画布采用保留场景、增量空间索引、256 像素分块和按需帧调度。Canvas 2D 栅格化文字、路径与效果，WebGL2 复用纹理并合成可见块；GPU 初始化失败、纹理上传失败或上下文丢失时回退到 Canvas 2D 合成。平移命中缓存时不重新绘制节点或上传纹理；编辑只失效新旧边界涉及的块。分块缓存按 CPU 位图加 GPU 纹理估算限制为 128 MiB，节点位图另有 64 MiB LRU 预算。

React 只提交文档、相机和覆盖层状态，场景编译发生在 layout effect 后的引擎内部；相机独立订阅，平移缩放不更新整个编辑器。拖动通过 `beginTranslation/translate/endTranslation` 复用有序的静止层与移动层，手势结束才提交文档；不适合分层的裁剪和混合模式保持普通场景更新。Canvas 节点没有对应 DOM，文本编辑时临时创建输入框。

栅格任务按约 6 ms 的软预算渐进完成，缩放时复用已有低分辨率块。`data-pending-tiles` 归零表示当前可见块绘制结束；同步绘制耗时不等于整幅画面完成时间。GPU 错误检查在上传 fence 完成后进行，避免每帧同步等待。

实现位于 `src/canvas/`：`scene.ts` 保留层级、变换与组件实例；`geometry.ts` 管理可增删的空间索引；`painter.ts` 栅格化节点；`tiles.ts` 管理分块、损伤范围和预算；`compositor.ts` 提供 WebGL2/Canvas 2D 后端；`overlay.ts` 绘制编辑辅助；`engine.ts` 协调帧调度、命中和资源生命周期。实现与验证方式见 [2D 渲染架构](../../docs/RENDERING-ARCHITECTURE.md)，功能边界见 [画布能力清单](../../docs/CANVAS-CAPABILITIES.md)。

仓库约定见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

## 目录与依赖

`src/index.ts`、`src/canvas.ts`、`src/source.ts` 分别承载 DOM 渲染、Canvas 渲染和 Node 源码导出，包级导入路径保持兼容。

- `shared/`：主题、变量和组件实例的共享取值。
- `dom/`：样式、SVG 图形内容和递归节点渲染。
- `canvas/`：场景编译、空间索引、路径缓存、绘制引擎及 React 接口。
- `node/`：独立 TSX 源码组装，只能在 Node 环境使用。
- `tests/unit/`：几何和场景编译测试。
- `tests/integration/`：独立源码的编译与导出契约测试。

两种渲染后端共享数据解析，不互相依赖。相互递归的 `NodeContent` 与 `NodeView` 放在同一模块，避免循环导入。调整 DOM 模块时，同步维护 `node/standalone-source.ts` 的源码清单；导出结果只依赖 React，并内嵌设计类型。
