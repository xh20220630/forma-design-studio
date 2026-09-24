# Idea Foundry / 灵感成形

首页 6 秒单轮装配短片。以独立部件的运动、物理铰链和可辨识的界面组成建立时间顺序，完成后完全停稳。原版 Rin 不进入 Blender，也不重绘，前端继续叠加原透明图。

## 交付

| 文件                                                                | 用途                    | 规格                                                          |
| ------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------- |
| `apps/web/public/brand/rin/v5/motion/home-idea-foundry.webm`        | 正式片                  | 960 × 640，24 fps，144 帧，6 秒，VP9 alpha，无音轨，813,251 B |
| `apps/web/public/brand/rin/v5/motion/home-idea-foundry-poster.webp` | 默认态 / reduced-motion | 第 144 帧完成态，RGBA，28,502 B                               |
| `apps/web/public/brand/rin/v5/motion/home-idea-foundry-poster.png`  | 无损工程海报            | 960 × 640，476,974 B                                          |
| `docs/ui-motion-v5/home/home-idea-foundry.blend`                    | 可编辑源场景            | 全程序材质和几何，无外部纹理、无角色资产依赖                  |
| `docs/ui-motion-v5/home/create_home.py`                             | 重现脚本                | 支持关键帧预览、源场景、正式渲染                              |
| `docs/ui-motion-v5/home/home-storyboard.jpg`                        | 经主线验收的四帧分镜    | 散件、展开、装配、停稳；正式片在此基础上加强银灰与蓝色层次    |
| `docs/ui-motion-v5/home/home-rin-overlay-guide.png`                 | 原 IP 合成定位图        | 仅验证 DOM 叠加位置，不是视频内烘焙角色                       |

直接验收页：`http://127.0.0.1:5173/docs/ui-motion-v5/home/preview.html`。支持一轮播放、重放、暂停、关键帧定位、浅深背景以及原 Rin 显隐。

## 编排

| 时间        | 动作                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------- |
| 0–1.63 s    | 珍珠白底座旋转 27° 就位；散开的实体模块保持明确层次。                                              |
| 0.38–2.42 s | 主背板沿弧线进入，转向 81°；主界面的厚度与金属背板逐渐显现。                                       |
| 1.04–3.71 s | 铰链入位，右页围绕垂直铰链旋转 129° 打开。                                                         |
| 2.04–4.50 s | 图表盒、数字指标、三枚色片、金属拨环、按钮盘错峰落位。色片转角 75° / 95° / 115°；按钮盘转向 110°。 |
| 3.96–5.25 s | 冰蓝光轨巡过底座线路，节点逐次响应。                                                               |
| 5.29–6.00 s | 完全停稳，形成可用作海报的完整界面舞台。                                                           |

镜头固定为正交三分之四产品机位。实体部件都有厚度和倒角；白瓷、冷银、蓝色模块分材质。地面为透明羽化接触阴影，舞台上由 Eevee 实时投影提供物体间接触关系。不使用整个场景上下浮动或循环呼吸。

## 前端叠加与播放

在未经裁切的 **3:2 视频容器**内，原 Rin 使用：

```css
.rin-overlay {
  position: absolute;
  left: 61.41%;
  bottom: 25.72%;
  height: 43.24%;
  transform: translateX(-50%);
  pointer-events: none;
}
```

对应脚底 `x=61.41%, y=74.28%`，锚点为 bottom-center。来源可继续用原版 `apps/web/public/brand/rin/v4/rin-full-body.png` 或其已验证的同构 WebP。视频和 IP 必须共享同一个 3:2 内容坐标系；外层 hero 比例不同，应先 `object-fit: contain`，同时让叠图定位到同一个内层框。

- 默认显示完成态 WebP；不要预先下载完整视频。
- 用户播放后只演一轮，`loop=false`，末尾保留最后一帧；用户可重放。
- reduced-motion、工作台关闭动态或视频不支持时，显示完成态海报。
- 切至后台、离开视口后暂停。不要为这段非循环片设置持续 CSS 漂浮动画。
- 视频和原 Rin 分离，角色身份、颜色和轮廓由原素材保持。

## 实际验证

- `asset-verification.json`：直接解析 WebM EBML，确认 VP9、960 × 640、144 帧、6 秒、`AlphaMode=1`、无音轨；PNG 为真正 RGBA，alpha 范围 0–255。
- `scene-verification.json`：78 个对象，其中 73 个对象从初始到装配段存在真实世界矩阵变化；第 128 与 144 帧所有对象世界矩阵差值为 **0**。相机无动画，源场景无未打包外部资产，也无角色贴图。
- 全部 144 帧几何投影边界检查通过：归一化范围 `[0.0862, 0.0103]–[0.9008, 0.9807]`，没有飞行中的实体被画面边界裁掉。
- Chrome 实际播放一整轮：`duration=6, currentTime=6, ended=true, paused=true, readyState=4, error=null`。重放、关键帧跳转和暂停可用。
- 浏览器浅色、深蓝色底分别查看，alpha 边缘正确，无黑色矩形；1.96 秒实拍中间帧与四帧分镜一致，折页和独立模块处于真实不同姿态。
- 480 × 320、16 samples 四帧预览先验收；正式 960 × 640、32 samples 渲染约 73 秒。与 Atlas agent 串行使用 GPU。

## 重现

使用已有 Blender `D:/app/blender/blender.exe`，不需要安装依赖：

```powershell
& 'D:/app/blender/blender.exe' -b -t 8 -P 'docs/ui-motion-v5/home/create_home.py' -- --mode preview
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' 'docs/ui-motion-v5/home/contact_sheet.py'
& 'D:/app/blender/blender.exe' -b -t 8 -P 'docs/ui-motion-v5/home/create_home.py' -- --mode render --samples 32
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' 'docs/ui-motion-v5/home/verify_assets.py'
& 'D:/app/blender/blender.exe' -b -t 2 -P 'docs/ui-motion-v5/home/verify_scene.py'
```

预览逐帧 PNG 只写系统 Temp 的 `rin-home-v5-*` 子目录。`contact_sheet.py` 验证绝对路径位于系统 Temp 后清理其生成帧及目录。正式片由 Blender 直接输出 WebM，不产生工作区帧序列或日志。此任务未编辑前端文件，未运行 lint、typecheck、build 或 pnpm。
