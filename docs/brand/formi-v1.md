# 方米 Formi · Forma IP 形象

生成方式：内置 imagegen。版本：v1。日期：2026-09-21。

## 角色

方米是由设计模块组成的小伙伴，认真、好奇，喜欢把零散想法整理成清晰、可用的作品。「方」呼应画框与组件，「Formi」与 Forma 的名称保持联系。

- 叠层的圆角方形身体：页面、图层与组件。
- 右上角蓝色方块：固定识别特征，也像画布的选择控制点。
- 蓝色画框角标与手持模块：把想法构建成统一的设计。
- 象牙白、炭黑、Forma 蓝：适配中性色工作台；渲染中的受光颜色会有自然变化。

## 素材

- [透明底主形象](../../apps/web/public/brand/formi/formi-master-v1.png)：1254 × 1254 PNG，RGBA，透明背景。用于品牌展示、欢迎页和较大尺寸 Agent 形象。
- [动作设定图](../../apps/web/public/brand/formi/formi-poses-v1.png)：1536 × 1024 PNG，浅色背景。HELLO / THINK / BUILD / DONE 四种状态；这是整张设定图，不是已拆分的动画或图标。

前端可使用资源路径 `/brand/formi/formi-master-v1.png`。本次提供形象与素材，尚未替换应用中的头像或图标。

## 使用建议

欢迎状态用于空项目页与首次对话；思考状态用于理解需求；拼合模块用于执行设计操作；完成状态用于组件创建或同步成功。小尺寸头像需要专门简化或制作裁切版本，避免直接缩小整个人物造成细节丢失。

保留叠层身体、蓝色右上角模块与画框角标这三个特征。不要添加机械关节或密集装饰；避免长期遮挡画布。操作状态保留文字说明，不仅依靠表情表达。

## 最终生成提示词

### 主形象

```text
Use case: stylized-concept.
Asset type: original software brand IP mascot, master character asset for Forma, a professional web application that unifies design canvases, design tokens, reusable components and code with an AI design assistant.
Primary request: Design one memorable original mascot called Formi (Chinese nickname 方米). It is a living design-frame / modular component creature, friendly and quietly capable, with a strong simple silhouette suited to a sidebar avatar and brand illustration. This is a finished polished character design, not a logo or a UI screenshot.
Subject: a small rounded-square cushion-like off-white body formed by two softly beveled square design tiles slightly offset in depth, almost a tiny walking canvas. One continuous main body and a smaller rear layer, not a conventional robot head on a humanoid torso. Large uncluttered face with two small charcoal pill-shaped eyes, subtly uneven eyebrows expressing curiosity, a tiny warm smile. A distinctive small bright blue square module attached at the upper right corner like an asymmetric ear / selection handle. Tiny short charcoal rounded feet and two short soft arms. One hand gently raises a single small blue rounded-square component tile, the other hand makes a small welcoming wave. A few subtle blue corner markings evoke a selected design frame; use them sparingly, built into the creature, no floating UI overlay. Character must feel like an ownable collectible designer toy with personality, not a generic service robot.
Style/medium: high-end stylized 3D character render, excellent shape design, soft matte vinyl/ceramic material, gently rounded chamfers, subtle realistic ambient occlusion, crisp silhouette, restrained sophisticated detail. Charming enough to be an IP character, tasteful enough for a professional design tool.
Color palette: warm ivory #F6F5F1, charcoal #252629, Forma blue #0D99FF; blue is the recognisable accent and held component. No additional dominant colors.
Composition/framing: one full-body character only, three-quarter front view, centered with comfortable padding, eye-level camera with slight view of top, character occupies 75–80% of a square image. Both eyes visible, all limbs fully visible.
Lighting/mood: soft large studio lighting, gentle highlights, quiet confident friendly expression.
Scene/backdrop: genuinely transparent background, RGBA alpha; no floor plane, no studio backdrop, no fake checkerboard. Keep natural self-shadowing on the character. No decorative scenery.
Text: none. Constraints: exactly one original mascot; maintain simple high-quality coherent anatomy; no existing mascot references, no Figma logo, no anthropomorphic animal ears, no robot antenna or screen visor, no gears, no neon, no purple gradients, no mechanical seams, no text, no watermark, no extra props beyond the one component tile.
```

### 动作设定图

输入参考：主形象 `formi-master-v1.png`。

```text
Use case: identity-preserve.
Asset type: four-pose character expression and action sheet for the Forma software mascot.
Input image 1 is the definitive character identity reference. Preserve this exact character's silhouette, two offset ivory rounded square layers, blue square upper-right module, paired black oval eyes and small eyebrows, ivory short limbs, charcoal shoes, blue top-left and bottom-right frame-corner marks, soft matte 3D vinyl material and ivory/charcoal/bright-blue palette.
Create a refined landscape character design sheet on a very light warm gray background. Four equally sized full-body views of this SAME mascot arranged in a clean two-by-two grid with generous spacing. No borders, no UI cards, no interface screenshot. All four figures are about the same size and wholly visible.
Upper left HELLO: recreate its friendly wave and small handheld blue component tile.
Upper right THINK: curious focused expression, one small hand thoughtfully touching cheek, other hand gently holding a blue tile, slight body lean; no thought bubbles.
Lower left BUILD: carefully align two tiny rounded blue/ivory component tiles between its hands, focused contented eyes; no machinery or furniture.
Lower right DONE: delighted subtle closed-eye smile, one thumbs up and another hand resting by side, confident little stance; no confetti.
Each pose has one understated charcoal uppercase caption centered underneath, exactly: "HELLO", "THINK", "BUILD", "DONE". Small editorial sans-serif type, no other text. Consistent soft studio lighting, gentle grounded shadows, premium polished 3D character presentation. Keep its face front or three-quarter front in all poses.
Do not redesign the character or add hats, clothing, robot hardware, a humanoid torso, new dominant colors, decorative backgrounds, a watermark, extra characters or additional props. Preserve recognizability at avatar size. This should look like an intentional professional IP character action sheet, not a product advertisement.
```
