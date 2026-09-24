# Rin Studio / 品牌动效

第二版以彩色 Rin 肖像为主体，将设计语言分成三个有顺序的空间层：左上 Tokens、左下可复用组件、右侧 UI 画布。背景纯白，材质使用黑色阳极金属、银色边缘、白色陶瓷与轻度烟灰玻璃，天蓝 `#38bdf8` 只用于语义 token、选中角标和发饰母题。

Rin 使用未经改写的原始 PNG，作为固定的 **2.5D 肖像平面**。周围面板和组件是真实 Blender 3D 几何；这不是人物骨骼绑定或 3D 人体模型。动效是设计语言的演示，不代表任何真实任务的执行进度。

## 现行资产

| 文件                                              | 用途                                                          |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `create_studio.py`                                | 第二版场景、材质、灯光和阶段关键帧的可复现源代码              |
| `rin-studio.blend`                                | 可直接打开的场景；人物原始 PNG 已打包，约 1.5 MB              |
| `apps/web/public/brand/rin/rin-studio-loop.webm`  | VP9 / 720 × 480 / 25 fps / 125 帧 / 5 秒 / 无音频，约 256 KiB |
| `apps/web/public/brand/rin/rin-studio-poster.png` | 第 96 帧，模块完成归位后的静态画面                            |
| `inspect_motion.py`                               | Python 标准库读取 WebM 元数据，核对时长、编码、画幅和帧数     |
| `preview.html`                                    | 独立组件验收页：两档图标、头像、四种状态、手动演示            |

资产路径相对仓库根目录。第一版 `create_scene.py` / `rin-assembly.blend` 和 `rin-assembly.webm` 保留用于兼容与历史对照；应用里的 `RinAssembly` 已使用第二版视频。

## 节奏

1. 0.2–1.25 秒：颜色、材质 token 依序归位。
2. 1.4–2.3 秒：可复用组件的浮层与基座对齐。
3. 2.5–3.6 秒：组件和内容卡片落入完整 UI 画布。
4. 3.6–4.2 秒：保持完成态，便于读取结果。
5. 4.2–5 秒：回到初始布局；首尾姿态一致。

人物和相机不循环摆动。场景通过局部的纵深与位移说明结构，不模拟任务进度条。

## 重现与验证

已使用 Windows 的 Blender 5.2.1 LTS / EEVEE。先确认 `apps/web/public/brand/rin/forma-rin-chibi-v1.png` 存在，然后从仓库根目录运行：

```powershell
& 'D:/app/blender/blender.exe' --background --factory-startup --python-exit-code 1 --python 'docs/brand/rin-motion/create_studio.py' -- --save-blend
python docs/brand/rin-motion/inspect_motion.py --studio
```

按本机安装位置修改执行文件路径。增加 `--poster-only` 只渲染静帧；`--save-blend` 可选。脚本只覆盖该版生成资产，不修改原始 Rin 位图，不生成逐帧临时目录。

实际验收包括：5 秒 / 125 帧 / 720×480 / VP9 / 单视频无音轨元数据检查、初始分层姿态和完成姿态视觉检查、浏览器图标与状态图检查、演示播放和停止按钮检查。浏览器演示停止后回到 poster。组件做过单独 TypeScript 检查，未为此运行全量 build/test。

启动项目开发服务器后访问 [品牌组件验收页](http://127.0.0.1:5173/docs/brand/rin-motion/preview.html)。

## React 契约

```tsx
import { RinAvatar, RinIllustration, RinIcon, RinAssembly, RinStudioScene } from './components/brand/RinBrand';

<RinAvatar size={32} ready={isActuallyReady} />
<RinIllustration state={isActuallyProcessing ? 'thinking' : 'empty'} size={112} />
<RinIcon kind="components" size={24} />
<RinIcon kind="components" variant="sculptural" size={32} />
<RinAssembly active={isActuallyProcessing} />
<RinStudioScene compact />
```

- 原有 `size` / `className` / `state` / `kind` / `active` API 保持兼容。
- `RinAvatar.ready` 只添加静态天蓝就绪角标；默认没有就绪暗示。悬停轻微放大，减少动态效果时关闭。
- 六种 `RinIcon` 保留各自功能语义，以方形发饰和右上角标作为共同母题。默认 `functional` 适合 20–24px；`sculptural` 建议 32px 及以上。
- `RinIllustration` 在可见、前台时进入；`thinking` 仅在真实执行时循环三个细小信号。成功和错误只有一次进入反馈。减少动态效果时直接展示静态状态。
- `RinAssembly` 只有 active、进入视口、页面前台、用户未减少动态效果时播放。inactive 或减少动态效果恢复静帧，视口外或后台暂停。
- `RinStudioScene` 默认静态，用户手动启动/停止，不自动声称有任务在运行。减少动态效果时显示静态演示和禁用的播放控件。
- `apps/web/src/lib/motion.ts` 导出 `motionTiming`、`motionEase` 和 `enterMotion(reduced)`，供界面复用统一的进入与反馈曲线。

## 官方参考

- [Blender command line arguments](https://docs.blender.org/manual/en/5.1/advanced/command_line/arguments.html)
- [Blender 5.0 Python API changes](https://developer.blender.org/docs/release_notes/5.0/python_api/)
- [Blender ImageFormatSettings](https://docs.blender.org/api/main/bpy.types.ImageFormatSettings.html)
- [Blender WebM VP9 preset](https://github.com/blender/blender/blob/main/scripts/presets/ffmpeg/WebM_%28VP9%2BOpus%29.py)
- [Motion useReducedMotion](https://motion.dev/docs/react-use-reduced-motion)
- [Motion accessibility](https://motion.dev/docs/react-accessibility)
