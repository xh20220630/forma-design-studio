# Forma / Rin — 黑白与天蓝

用户确认方向：白色工作空间、黑色主按钮、细灰边线；IP 保留原本彩色，天蓝色作为少量点缀。参考图：`workspace-approved-v2.png`。

## 视觉规范

- 底色 #ffffff / #fafafa；文字 #171717 / #737373；边线 #e5e5e5。
- 交互点缀 #38bdf8，浅底 #f0f9ff，可读的蓝色文字 #0369a1。主操作仍用黑色。
- Geist / Geist Mono 字体本地打包，不依赖在线字体加载。
- 角色保持银发、蓝瞳、肤色、黑白服装与蓝色发夹；不使用灰阶滤镜。
- 项目是最高层级；页面、组件、Tokens、Agent 与代码同步属于项目。预览展示真实设计数据并保留各项目自身主题。
- 头像用于入口与身份，状态插画用于空内容、处理中、成功与异常，不用大横幅占据工作区域。
- 图标使用角色方形发饰与画布边角的视觉母题，6 个语义图标保留清楚的功能含义。

## 动效

Motion for React 全局 180 ms；页面切换轻微 3px 位移和透明度，局部操作通常 160–180ms。尊重系统 reduced-motion；视频仅在可见、激活且允许动效时播放。Canvas 图层本身不引入 Motion transform，避免干扰坐标和导出。

Blender 源场景与复现说明见 `../rin-motion/`。角色使用 2.5D 卡片，周围模块是真实 Blender 3D 场景，不是人物骨骼动画。

## 图片素材与生成记录

所有图片由内置 imagegen 生成。身份参考：`apps/web/public/brand/rin/forma-rin-chibi-v1.png`。生产素材放在 `apps/web/public/brand/rin/`，原始生成结果保留。背景为白色，不宣称透明。旧的 `workspace-concept-v1.png` 是被用户否决的蓝色横幅方向，仅留作过程记录；实际实施采用 approved-v2 与彩色 IP 的最新修订。

### 头像：rin-avatar-v1.png

Use case: identity-preserve. Asset type: actual software app icon and chat avatar, a clean square portrait.
Input image is the exact original cool chibi anime girl identity. Create a tight head-and-upper-shoulders portrait of this SAME Rin character. Preserve silver asymmetrical bob, long fringe, black-and-blue squared hair clip, icy half-lidded blue eyes, tiny straight unsmiling mouth, cool reserved expression and black high neck. Chibi proportions, immaculate crisp 2D anime cel-shaded linework.
Composition for a usable 64px app avatar: entire hairstyle and hairclip must fit inside a centered circle occupying 85% of the square image; head face large and readable, shoulders at bottom. Eye contact with viewer. White to extremely pale icy blue plain background (#f5f7fb), no texture, no decorative frame, no ring, no text. Readable bold silhouette, simplify clothing microdetails. NOT a realistic adult fashion portrait, NOT a smiling cartoon. No floating icons, no watermark, no letters, no tablet in this portrait. Just a superb recognizable Rin head icon.

### empty: rin-empty-v1.png

Create one production-ready software empty/state illustration, square canvas, white #ffffff background. Use the input as the exact identity reference: Rin, a cool Q-version chibi anime girl, silver asymmetrical bob with swept fringe, icy half-lidded blue eyes, small straight unsmiling mouth, black squared hairclip with SKY BLUE accent, black and ivory asymmetric high-collar coat, dark trousers and boots. Keep her FULL COLOR: natural pale skin, blue eyes, sky-blue clip/tablet accents, silver hair, charcoal clothes. Never grayscale or desaturate the entire illustration. Precise refined 2D anime cel shading and crisp lines, about 2 heads tall. Do not redesign her. Minimal graphic props in white, black, pale gray, tiny sky blue #38bdf8 only. No gradients in background, no glow, no text/letters/words/watermark, no checkerboard. One compact centered composition with 18 percent generous white margin, reads well at 120px. White background, subtle tiny contact shadow only. State: EMPTY PROJECT / READY TO START. Rin sitting composed on the edge of one low white rectangular blank canvas card, legs dangling, one hand holding her small sky-blue glass tablet and looking toward viewer with cool confidence. The card is an abstract empty frame with black thin edge and four small sky blue corner marks. Only the character and this single simple prop.

### thinking: rin-thinking-v1.png

Create one production-ready software empty/state illustration, square canvas, white #ffffff background. Use the input as the exact identity reference: Rin, a cool Q-version chibi anime girl, silver asymmetrical bob with swept fringe, icy half-lidded blue eyes, small straight unsmiling mouth, black squared hairclip with SKY BLUE accent, black and ivory asymmetric high-collar coat, dark trousers and boots. Keep her FULL COLOR: natural pale skin, blue eyes, sky-blue clip/tablet accents, silver hair, charcoal clothes. Never grayscale or desaturate the entire illustration. Precise refined 2D anime cel shading and crisp lines, about 2 heads tall. Do not redesign her. Minimal graphic props in white, black, pale gray, tiny sky blue #38bdf8 only. No gradients in background, no glow, no text/letters/words/watermark, no checkerboard. One compact centered composition with 18 percent generous white margin, reads well at 120px. White background, subtle tiny contact shadow only. State: THINKING / ARRANGING A DESIGN. Rin standing, hand thoughtfully at her chin, other hand supporting her small sky-blue glass tablet. Three small pale gray square design modules float in a tidy short ascending sequence to her right, the middle module has one sky blue corner. Her eyes glance toward the modules, intelligent reserved expression. Minimal composition.

### success: rin-success-v1.png

Create one production-ready software empty/state illustration, square canvas, white #ffffff background. Use the input as the exact identity reference: Rin, a cool Q-version chibi anime girl, silver asymmetrical bob with swept fringe, icy half-lidded blue eyes, small straight unsmiling mouth, black squared hairclip with SKY BLUE accent, black and ivory asymmetric high-collar coat, dark trousers and boots. Keep her FULL COLOR: natural pale skin, blue eyes, sky-blue clip/tablet accents, silver hair, charcoal clothes. Never grayscale or desaturate the entire illustration. Precise refined 2D anime cel shading and crisp lines, about 2 heads tall. Do not redesign her. Minimal graphic props in white, black, pale gray, tiny sky blue #38bdf8 only. No gradients in background, no glow, no text/letters/words/watermark, no checkerboard. One compact centered composition with 18 percent generous white margin, reads well at 120px. White background, subtle tiny contact shadow only. State: DESIGN FINISHED / SYNC SUCCESS. Rin standing with slight satisfied head tilt, cool unsmiling confident expression, holding her small sky-blue tablet tucked at her side and raising a small black outlined square card with a sky-blue check mark. Very small check mark is a graphical symbol, no words. No confetti, no celebration pose, no smile. Minimal composition.

### error: rin-error-v1.png

Create one production-ready software empty/state illustration, square canvas, white #ffffff background. Use the input as the exact identity reference: Rin, a cool Q-version chibi anime girl, silver asymmetrical bob with swept fringe, icy half-lidded blue eyes, small straight unsmiling mouth, black squared hairclip with SKY BLUE accent, black and ivory asymmetric high-collar coat, dark trousers and boots. Keep her FULL COLOR: natural pale skin, blue eyes, sky-blue clip/tablet accents, silver hair, charcoal clothes. Never grayscale or desaturate the entire illustration. Precise refined 2D anime cel shading and crisp lines, about 2 heads tall. Do not redesign her. Minimal graphic props in white, black, pale gray, tiny sky blue #38bdf8 only. No gradients in background, no glow, no text/letters/words/watermark, no checkerboard. One compact centered composition with 18 percent generous white margin, reads well at 120px. White background, subtle tiny contact shadow only. State: NEEDS ATTENTION / ACTION FAILED. Rin crouches beside one small interrupted connection made of two separated abstract square design blocks, calmly inspecting with one hand at chin, tablet under other arm. One tiny sky-blue outlined warning triangle on the upper-right block. Reserved mildly concerned eyes, not distressed. No tears, no smile, no red. Minimal composition.

## 实施验证

- 项目、概览、组件、Tokens、模板、同步、设置、画布与聊天均已整合新视觉。
- 实际浏览器检查：空搜索、网格/列表、组件弹窗取消、项目上下文、聊天开关、编辑器工具与面板；冷启动没有 console error/warn，图片完成加载且无灰阶滤镜。
- `npm test`：33 项通过。`npm run build`（含 TypeScript 检查）通过；Vite 仍有主入口约 690 KB 的体积提示。未配置和运行 lint。
- 未修改用户设计节点或重置项目数据。未使用 pnpm，未产生项目内 `.pnpm-store`。

## 参考资料

- [Vercel Geist](https://vercel.com/geist/introduction)：黑白层次、密度和排版参考。
- [MotionConfig](https://motion.dev/docs/react-motion-config)：统一动效与减少动态效果支持。
