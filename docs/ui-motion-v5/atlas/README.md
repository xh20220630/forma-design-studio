# Template Atlas / 模板展卷

六块双面模板画板从合拢的精装卡册展开，沿真实书脊轴打开为扇形，逐张翻面显出版式，再吸附排列成 3 × 2 展览墙。完成态放在真实金属支架和陶瓷展台上；没有角色、漂浮循环或粒子烟花。

## 交付资源

| 资源 | 规格 |
| --- | --- |
| `/brand/rin/v5/motion/atlas-unfold.webm` | 900 × 600、24fps、144帧、6秒、VP9、AlphaMode 1、无音轨；794,372 bytes |
| `/brand/rin/v5/motion/atlas-poster.webp` | 完成态第140帧，900 × 600 RGBA；54,932 bytes |
| `/brand/rin/v5/motion/atlas-poster.png` | 同帧完整 PNG 母版 |
| `atlas-scene.blend` | 可直接打开的完整 Blender 场景，12张纹理已打包 |
| `create_atlas.py` | 几何、材料、镜头、灯光、关键帧与渲染源脚本 |
| `create_textures.py` | 六种实际缩略版式与对应封面纹理的可复现脚本 |
| `textures/` | 12张 960 × 640 PNG 原始贴图 |
| `atlas-contact-sheet.jpg` | 卡册 / 展卷 / 连锁翻面 / 作品墙四阶段分镜 |
| `atlas-poster-alpha-qa.jpg` | PNG 在珍珠白与墨蓝背景上的实际 alpha 合成 |
| `atlas-webp-alpha-qa.jpg` | WebP 在墨蓝背景的实际 alpha 合成 |

分镜先提交主任务审核，按反馈修正了白卡过曝，再输出正式影片。印刷面使用 0.92 强度 Emission 保留文字和版式颜色；板体、倒角、铰链、展架、底座仍使用实际物理表面和灯光。

## 时序

| 帧 | 动作 |
| --- | --- |
| 1–14 | 合拢卡册静置，厚板芯与逐层装订脊可见 |
| 14–52 | 六个独立垂直书脊铰链交错展开，最大 ±73° |
| 52–96 | 每张画板延迟4帧依次翻转；转到187°后收回到180°，显露背面的设计版式 |
| 78–109 | 展架水平导轨和立柱展开承接 |
| 82–130 | 六块模板从扇形依次进入3×2位置，轻微越位后吸附回正 |
| 130–144 | 保持完成态，不自动回到起点 |

播放器应按次播放；完成后维持最后一帧或切回同完成态 poster。减少动态效果时只展示 poster。视频不应设置无缝循环，也不代表真实任务进度。

## 真实场景构成

- 60 个网格对象、21 个带关键帧对象。
- 6 块 2.32 × 1.57 × 0.105 单位的双面实体画板，0.042 单位四段倒角，独立浅色板芯。
- 12 个镀铂书脊销、12个冰蓝角标，以及真正立体的展架、底座与导轨。
- 6 个独立翻面轴与6个展开轴，翻面/合页/排阵三类变换各自独立。
- 六种内容：浅色数据看板、暖色生活商城、旅行、午夜创作、编辑杂志、设计系统；使用既有 v4 commerce / travel / midnight 图像与本地生成的真实版式纹理。
- 原 `apps/web/public/brand/rin` 角色与摄影素材未覆盖，没有生成或重画 Rin。

## 复现

在仓库根目录使用本机 Blender 5.2.1 LTS：

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' 'docs/ui-motion-v5/atlas/create_textures.py'
& 'D:/app/blender/blender.exe' --background --factory-startup --python-exit-code 1 --python 'docs/ui-motion-v5/atlas/create_atlas.py' -- --preview
& 'D:/app/blender/blender.exe' --background --factory-startup --python-exit-code 1 --python 'docs/ui-motion-v5/atlas/create_atlas.py'
```

`--preview` 只渲4张600×400分镜，不覆盖正式 `.blend`；`--poster-only` 只渲900×600完成态；`--save-only` 只存场景。正式渲染使用 EEVEE 40 samples，约76秒完成。直接编码 WebM，没有临时逐帧目录、无需清理临时帧序列。

`create_textures.py` 使用 Pillow 与 Windows 本地 Segoe UI 字体。需要重新生成 WebP poster 时，将 `atlas-poster.png` 用 Pillow 导出 `quality=92, method=6`，保留 RGBA。

## 验证

```powershell
& 'D:/app/blender/blender.exe' --background --factory-startup --python-exit-code 1 --python 'docs/ui-motion-v5/atlas/verify_scene.py'
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' 'docs/ui-motion-v5/atlas/verify_assets.py'
```

- `scene-verification.json`：逐帧读取真实 Blender 矩阵，6个叶片均从0°转到180°、六个终态位置不同、130–144帧保持；12张图像已打包。
- `asset-verification.json`：EBML容器实际读取 VP9、宽高、AlphaMode、时长、帧数与音轨；poster模式与alpha范围检查通过。
- 正式 poster 已检查珍珠白/墨蓝背景合成，无伪透明底。页面内播放、结束态与减少动态效果由主任务的统一播放器验证。

未修改前端源文件；未运行 lint/typecheck/build 或 pnpm。
