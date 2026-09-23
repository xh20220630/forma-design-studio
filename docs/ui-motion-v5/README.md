# Forma / Motion Studies v5

[打开三场景动效展台](http://127.0.0.1:5173/docs/ui-motion-v5/) · [新版工作台](http://127.0.0.1:5173/)

本次重做两支 Blender 三维编排和一套实时三维交互，分别落在项目首页、模板库与主题工作室。每个场景都有明确的动作阶段和稳定结束姿态。旧动效预览地址也已切换为这个展台。

## 场景与落点

| 场景 | 制作方式 | 编排 | 页面行为 |
| --- | --- | --- | --- |
| 灵感成形 / Idea Foundry | Blender，960×640，24fps，6秒素材，透明 VP9 | 独立模块弧线入场与自转 → 铰链展开 → 指标与图表分层落位 → 光轨巡过节点 | 首页可见时自然播放一轮，1.25倍速约4.8秒；结束定格 |
| 模板展卷 / Template Atlas | Blender，900×600，24fps，6秒素材，透明 VP9 | 六块厚画板围绕书脊展卷 → 连锁翻面 → 脱离书脊 → 磁吸重排成3×2作品墙 | 模板页进入及分类变化时自然展开，完成后停留 |
| 色彩织机 / Chromatic Loom | React、Motion、CSS 3D，约2.9秒 | 10枚双面瓣片开合翻转 → 5块材质样本交叉换位 → 穿梭梁完成嵌合 | 进入视野及真实主题、强调色变化时播放一次，结束保持 |

两支影片的主要变化来自各物体独立的位置、旋转和装配顺序。镜头保持稳定，避免把整个画面上下移动当作动画。

凛继续使用 `apps/web/public/brand/rin/v4/rin-full-body-640.webp` 原版透明切图。角色作为独立前端图层叠在首页舞台上，使用与视频相同的960×640坐标系，缩放后脚底仍落在原锚点。没有重新绘制、变形或给角色套替代模型。

## 交付文件

- [首页分镜](home/home-storyboard.jpg)、[Blender源场景](home/home-idea-foundry.blend)、[场景脚本与验证记录](home/README.md)。
- [模板分镜](atlas/atlas-contact-sheet.jpg)、[Blender源场景](atlas/atlas-scene.blend)、[场景脚本与验证记录](atlas/README.md)。
- [色彩织机组件说明](chromatic/README.md)。
- 前端播放组件：`apps/web/src/components/motion/StudioSequence.tsx`，样式 `studio-sequence.css`。
- 主题交互组件：`apps/web/src/components/motion/ChromaticLoom.tsx`，样式 `chromatic-loom.css`。
- 页面整合样式：`apps/web/src/studio-motion-v5.css`。
- 视频与海报：`apps/web/public/brand/rin/v5/motion/`。原v4文件保留作为历史素材，正式页面已使用新版。

## 播放与交互

影片在可见范围内才加载。滚动离开或切到后台会暂停，返回时继续尚未完成的播放；完成后不会因可见性变化重新启动。暂停保留当前帧，完成后保留最后一帧。页面中不提供进度条、分镜、重播或重置等播放控件，动画直接融入原有视觉区域。

工作台关闭动态效果、系统要求减少动态效果或展台开启静态模式时，影片显示完成态海报，交互雕塑立即定位到完成态。色彩织机离屏或后台也立即停止，返回不续播。

装饰动画不表示业务任务进度。项目、模型连接和代码同步数据不受改动影响。

## 验收

Blender 透明通道、帧范围、稳定结束姿态和素材打包的制作验证保留在各场景目录。前端验收关注自然播放、完成后静止、离屏与后台暂停、减少动态和加载失败海报回退，以及桌面和窄屏布局。
