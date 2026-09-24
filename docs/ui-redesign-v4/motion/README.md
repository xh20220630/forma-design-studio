# Rin / Pearl Studio 动效交付

> 当前首页已升级为三场景动效方案：[Motion Studies v5](../../ui-motion-v5/README.md)。本文保留v4旧场景的制作记录，预览入口展示新版。

原版银短发、蓝眼、黑衣 Rin 直接使用已验收的透明 PNG 贴图。角色没有改画、改色、换姿态或建立替代模型。人物与相机均无动画；仅左右亚克力画框与冰蓝角标进行轻微循环运动。动效是品牌场景，不表示真实任务进度。

## 可集成资产

| 路径                                                        | 规格 / 用途                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/web/public/brand/rin/v4/motion/rin-pearl-loop.webm`   | 720×480，VP9，20 fps，80 帧，4 秒，无音频，包含 Alpha，373,993 bytes |
| `apps/web/public/brand/rin/v4/motion/rin-pearl-poster.webp` | 720×480，透明，42,402 bytes；前端默认静帧                            |
| `apps/web/public/brand/rin/v4/motion/rin-pearl-poster.png`  | 同尺寸 RGBA，348,685 bytes；工程静帧                                 |
| `docs/ui-redesign-v4/motion/rin-pearl.blend`                | Blender 5.2.1 LTS 源场景；原角色纹理已打包                           |
| `docs/ui-redesign-v4/motion/create_pearl.py`                | 可重现的场景、灯光、透明材质、循环关键帧与渲染脚本                   |
| `apps/web/src/components/motion/RinMotion.tsx`              | 播放控制、卡片视差、选中反馈和真实任务状态组件                       |
| `apps/web/src/components/motion/rin-motion.css`             | 限定作用域的动效样式                                                 |
| `apps/web/src/lib/rin-motion.ts`                            | 资产地址、节奏、进入动效参数                                         |

资产路径相对仓库根目录。原贴图来源为 `apps/web/public/brand/rin/v4/rin-full-body.png`，由切图流程从 `apps/web/public/brand/rin/forma-rin-chibi-v1.png` 提取原轮廓透明度。

## 构图与使用范围

- 为首页设计稿 `docs/ui-redesign-v4/designs/01-projects.png` 的右侧主视觉制作，约占 hero 右侧 55–59%。左侧标题与操作保持真实 DOM。
- 场景为透明背景，可叠加珍珠白或浅冰蓝摄影棚环境；前端必须 `object-fit: contain`，保留原角色全身。
- 环境画框转动约 0.7°，纵向位移 0.025 场景单位；人物保持站姿，脚下有轻接触阴影。
- 大幅动效只用于首页或明确的品牌演示场景，内页复用轻量图标、选择和真实任务反馈。
- 卡片视差默认最大 2°，最高限制为 3°。不包裹编辑器画布、可拖拽图层、文字输入区域；鼠标按键按下时视差立即归零。
- 工作台原有 `rin-studio-loop.webm`、`rin-assembly.webm` 不被本组件引用。首页当前只使用新场景。

## React API

所有组件位于现有 `StudioThemeProvider` 内。

```tsx
import {
  RinMotionScene,
  RinParallax,
  RinSelectionIndicator,
  RinTaskActivity,
} from "./components/motion/RinMotion";
import { rinEnterMotion } from "./lib/rin-motion";

// 默认静帧；用户主动播放。
<RinMotionScene className="workspace-hero-scene" />

// active 是实际任务或明确的演示播放状态；受控模式不显示手动播放按钮。
<RinMotionScene active={isActuallyRunning} />

<RinParallax amount={2} className="project-card-shell">
  <ProjectCard />
</RinParallax>

// 宿主设 position: relative; isolation: isolate; border-radius: inherit。
{selected && <RinSelectionIndicator layoutId="project-filter" />}

<RinTaskActivity running={busy} label={busy ? "凛正在设计" : "等待任务"} />

<motion.section {...rinEnterMotion(reducedMotion)} />
```

`RinMotionScene` 接受 `active?: boolean`、`controls?: boolean`、`className?: string`、`label?: string`。省略 active 为手动模式，controls 默认开启；传入 active 为受控模式。`RinTaskActivity` 不生成百分比或伪造进度，其 running 必须连接真实业务状态。

## 性能与静态退化

- 初始只请求约 42 KB 的 WebP；视频 `preload="none"`，直到用户请求播放且视口可见才设置 src。
- 视口交集低于 10%、页面进入后台、active 为 false 或用户停止时暂停。重新可见时，仅保留原播放意图的场景恢复。
- 系统 `prefers-reduced-motion` 或工作台 `settings.motion === "off"` 均通过现有 `useStudioMotion` 统一关闭视频、视差和循环信号，保持静态海报。
- 暂停或不可播放时显示海报，视频播放时隐藏海报，避免透明画框叠影。
- 播放失败保留静帧并可重试；卸载清理可见性监听、IntersectionObserver、requestAnimationFrame 和视频播放。
- 单场景视频没有音轨，且始终 muted / playsInline。

## 已完成验证

1. 先以 360×240 / 16 samples 进行低清构图检查，再以 720×480 / 32 samples 正式渲染。
2. `verify_assets.py` 解析 WebM EBML：VP9、720×480、4.000 秒、80 帧、AlphaMode=1，只有一条视频轨且没有音轨。检查 PNG RGBA 全范围透明度并导出 WebP。
3. `verify_scene.py` 检查首帧和虚拟循环终点（第 81 帧）所有对象的世界矩阵，最大差值为 0。角色和相机没有动画；打包的角色 PNG SHA-256 与原透明素材完全一致。
4. Chrome 实际验收：默认静帧且视频未加载；点击后输出实际 `720×480 / 4.00s` 并播放；在浅冰蓝和深墨背景下确认透明合成正常，没有黑色视频矩形；手动停止与海报退化检查。
5. 源码审查：减少动态效果、页面后台、离屏暂停、重试清理、任务 running 语义、拖动期间视差归零、受控/手动模式区分均已检查。
6. 首页在 1000×800 与 768×800 下角色全身完整、文案与主视觉没有重叠。480×800 下发现宿主 hero 的 scene 向右越界，导致播放按钮被裁切，已把具体边界数据反馈主线，未越权修改宿主页面。
7. 两个新增 TS/TSX 文件通过单文件语法转译检查；该检查不替代主线统一 TypeScript 验证。

机器可读记录：`asset-verification.json`、`scene-verification.json`。

独立验收页：[Rin 动效验收](http://127.0.0.1:5173/docs/ui-redesign-v4/motion/preview.html)。该页的“测试任务态”仅为本地组件测试，不调用模型或修改项目。未在本子任务运行全局 lint/typecheck/build 或 pnpm。

## 重现

在仓库根目录运行；输出只写入本版目录，不覆盖原 IP。

```powershell
& 'D:/app/blender/blender.exe' --background --factory-startup --python-exit-code 1 --python 'docs/ui-redesign-v4/motion/create_pearl.py' -- --preview
& 'D:/app/blender/blender.exe' --background --factory-startup --python-exit-code 1 --python 'docs/ui-redesign-v4/motion/create_pearl.py' -- --save-blend
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' 'docs/ui-redesign-v4/motion/verify_assets.py'
& 'D:/app/blender/blender.exe' --background --factory-startup --python-exit-code 1 --python 'docs/ui-redesign-v4/motion/verify_scene.py'
```

可加 `--poster-only` 只渲染 PNG。验证脚本使用当前环境已提供的 Pillow；无需安装新的程序。

## 实现参考

亚克力使用 Blender `BLENDED` 透明材质以避免低样本的哈希透明噪声，符合 [Blender Material API](https://docs.blender.org/api/4.2/bpy.types.Material.html) 描述的透明模式。系统减弱动态效果遵循 [Motion useReducedMotion](https://motion.dev/docs/react-use-reduced-motion)。
