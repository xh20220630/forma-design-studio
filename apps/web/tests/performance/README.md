# 设计画布性能测试

在项目根目录运行，使用已安装依赖，不需要 pnpm：

```powershell
node apps/web/node_modules/vite/bin/vite.js build --config apps/web/tests/performance/vite.config.ts
node apps/web/node_modules/vite/bin/vite.js preview --config apps/web/tests/performance/vite.config.ts
```

打开 `http://127.0.0.1:5188/`，每次只运行一个测试组。基线测量期间不要同时运行构建、类型检查或其他压力任务。构建与 Vite 缓存均写入系统临时目录。

## 测试组

- **Engine suite**：100/1,000/5,000/10,000 节点；密集和分散矩形、文字、图片、阴影/模糊、路径、组件实例、重叠图层、编组，以及本地已有项目的首个页面。测量冷绘制、缓存平移、新区域平移、连续缩放、拖动、调整大小、命中、框选和叠加层；另测 Canvas2D 合成后端。
- **Editor suite**：直接挂载真实 `DesignEditor`，包括主题、Tooltip、左右侧栏、标尺、原生滚动和文字编辑。覆盖加载、空闲、平移、缩放、悬停、带/不带吸附的拖动、松手提交、缩放节点、撤销/重做、框选、全选、批量拖动和文字输入/提交。
- **Lifecycle suite**：长距离平移填满缓存、返回原点、20 次创建/释放，核对瓦片预算及释放后的资源计数。
- **Snapshot comparison**：相同 1,000 个节点、相同图片像素，分别使用 Blob URL 和内嵌 PNG data URL，重复三轮；记录深拷贝和整页 JSON 比较的调用，验证优化后交互不再执行这些操作。
- **Repeated DPR comparison**：冷绘制、缩放跨档、缓存平移、5,000 子节点编组拖动；DPR 输入 1/2 各三轮。DPR 2 是测试页覆盖 `devicePixelRatio` 后执行真实双倍 backing-store 绘制，不代表物理高分屏的完整显示链路。
- **Empty editor**：读取本地已有的空白页面，运行三轮真实编辑器交互；包括原有品牌插图和空画布引导布局，确认静态图片解码后再执行交互。
- **Interaction checks**：密集矩形、1,000/5,000 节点内嵌图片和 5,000 子节点编组，断言拖动提交、pointercancel、Escape、回到原点不产生历史记录、手势期间缩放保护及结束后的锚点缩放。
- **Show interactive editor**：挂载可手动操作的混合节点样本，方便视觉检查。不会保存用户项目。

## 计量口径

- `action` 只计测试动作同步调用耗时。引擎同步绘制包含在内；React 编辑器的异步渲染不包含在事件派发耗时中。
- `intervals` 是连续 `requestAnimationFrame` 回调时间戳之差，包含主线程拥堵，**不是 GPU 完成时间或屏幕实际呈现 FPS**。先测 idle 以确认浏览器的调度频率；输入频率跟随本机 rAF，不强制为 60 Hz。
- 输入循环结束后再等待三帧，并等待所有画布的 `data-pending-tiles` 归零（30 秒超时）。这些尾部帧不进入 interval 分位数；额外细化时间记入 `completionTailMs`，全部等待包含在 `elapsedMs`。单次异步操作的 interval 不能当作完整完成延迟，应同时检查尾延迟、draw 和 long-task 数据。优化前基线仅等待三帧，比较时必须说明此差异。
- p95 使用 nearest-rank，必须同时看 max：首次跨缩放档位的尖峰可能被 p95 隐藏。`steps: 1` 只有一个样本，不能视作稳定分位数。
- `timings` 为轻量函数计时：场景编译、瓦片绘制、GPU 提交、空间查询、项目深拷贝与拖动松手时的 JSON 比较。父子计时互相包含，不能直接相加。GPU 提交耗时不包含 GPU 最终完成耗时。
- `rendering` 来自真实渲染器计数器，单位为每次内容绘制的瓦片数、绘制条目数、上传数、可见节点数和缓存字节。绘制条目数会包含跨瓦片重复绘制。
- `longTasks`/`longFrames` 来自浏览器 PerformanceObserver；JS 堆来自 Chromium `performance.memory` 的近似值，不等同进程 RSS、GPU 显存或一次可靠的泄漏证明。
- `mixed` 的图片直接内嵌，`mixed-url` 通过短 Blob URL 引用相同像素。二者用于分离项目数据体积和绘图复杂度。
- 编辑器事件为测试页派发的合成事件，临时取消原生 pointer capture（合成 pointerId 无法获取真实捕获），实际事件处理、状态更新、几何计算、撤销、渲染都保留。测试包含结果断言，防止把未发生的操作记作快速通过。
- 测试页不调用保存项目接口。本地项目通过只读的 loopback fixture 路由加载；编辑后的项目仅存在于内存。完整应用的网络保存、Agent、外部图片网络延迟、输入法和其他浏览器不在本基线内。

每个完成阶段都会在测量窗口外写入系统临时目录 `forma-performance-latest.json`，便于页面异常时保留结果。页面也提供完整 JSON。不要把中断或失败的部分结果当作完整通过。

针对测试代码执行类型检查：

```powershell
node apps/web/node_modules/typescript/bin/tsc --noEmit -p apps/web/tests/performance/tsconfig.json
```

性能页不进入应用正式入口。不要同时运行旧版仅小范围平移的 benchmark 并据此推断整个编辑器流畅度。

本次各组基线 JSON 保存于 `docs/performance/2026-10-04-*.json`。生成可筛选的 HTML 总览和 CSV，并验证采样数、页面可见性及瓦片预算：

```powershell
node apps/web/tests/performance/export-results.mjs 2026-10-04
```

优化复测保存为 `2026-10-04-optimized-<suite>.json`。验证六组阶段一一匹配、采样完整、页面可见及缓存预算，并生成独立对照总览（保留原基线）：

```powershell
node apps/web/tests/performance/export-comparison.mjs 2026-10-04
```
