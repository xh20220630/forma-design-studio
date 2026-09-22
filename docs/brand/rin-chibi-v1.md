# 凛 Rin · 冷酷 Q 版 IP

本次采用内置 imagegen 生成与编辑。方向：冷酷的 Q 版二次元少女。

## 最终形象

[白底 Q 版主形象](../../public/brand/rin/forma-rin-chibi-v1.png)

银白短发、冰蓝瞳、半垂眼与平直嘴角构成冷淡表情。大头小身体的 Q 版比例保留黑白不对称外套、蓝色方形发饰、袖口画框角标与设计面板，将角色与 Forma 的页面、组件及代码工作流关联。

角色暂名「凛 Rin」：冷静而精准的设计搭档，擅长把想法整理成统一的设计。

最终文件为 1254 × 1254 PNG，白色背景，**不是透明底素材**。生成过程的透明背景尝试出现了烘焙棋盘格，因此最终使用清理后的白底版本。尚未替换应用头像。

前端资源路径：`/brand/rin/forma-rin-chibi-v1.png`。

[早期正常比例角色参考](../../public/brand/rin/forma-rin-concept-v1.png)仅作为角色身份参考，当前方向以 Q 版为准。

## 最终使用的提示词

### 角色身份参考

```text
Use case: stylized-concept.
Asset type: original anime girl IP mascot, master character illustration for Forma, a professional design canvas and AI-assisted design-to-code software.
Primary request: Create a cool, aloof anime young woman as the new brand character. She is clearly an adult, approximately 23–25 years old. Emphasize a memorable beautiful face, composed intelligence, understated authority, and a cold, emotionally reserved personality. An elegant original character users would recognize instantly, not a generic robot, not a cute chibi mascot.
Subject and character design: a tall slender adult anime woman with a sleek asymmetrical chin-length silver-white bob, long side-swept fringe, one slim geometric black hair clip and a small ice-blue rectangular accent. Narrow ice-blue eyes, precise slightly lowered eyebrows, unsmiling lips, calm direct gaze with a hint of disdain, no blush. Natural adult anatomy, long clean silhouette.
Costume: sophisticated futuristic creative-director streetwear, tailored cropped charcoal jacket over a fully opaque high-neck black fitted top, structured ivory outer panels, high-waisted straight charcoal trousers and sleek black ankle boots. One asymmetric longer jacket panel creates a distinctive silhouette. Restrained blue seams and small square hardware, beautifully designed clothing construction, minimal geometric details. Modest, practical, fashionable and premium. No school uniform.
Forma-specific visual motifs: a subtle blue right-angle selection-frame motif on one jacket cuff and a small square blue accessory on the belt. One hand relaxed in a trouser pocket; the other holds a slim transparent ice-blue design panel at hip height. The panel contains only three simple stacked rounded-square components and a few clean frame-corner lines, with no text or code. This is a software brand muse / design partner with a human identity, not a combat character.
Style/medium: exquisite high-end 2D Japanese anime character key visual, confident crisp linework, precise cel shading enhanced by delicate painterly edge lighting, carefully rendered hair and fabric, refined anime face, excellent hands. Fashion concept illustration quality. NOT photorealistic, NOT a 3D toy, NOT western cartoon.
Palette: charcoal #20242A, ivory #F4F5F7, silver hair, Forma blue #0D99FF and pale ice-blue accents; restrained saturation, avoid other dominant hues.
Composition/framing: single full-body character in a relaxed standing pose, subtle three-quarter turn, face turned toward viewer, character occupies roughly 82 percent of a tall portrait image, both boots visible, comfortable clear margins around entire silhouette, no cropped head or feet. Let the clear silhouette and expressive eyes be the focus.
Scene/backdrop: genuinely transparent background with alpha, no backdrop, no floor, no fake checkerboard, no scenic environment, no decorative halo; only the character and her one design panel.
Lighting/mood: cool soft directional light, controlled contrast, icy confident attitude.
Text: none.
Constraints: original identity, adult proportions, no existing anime character imitation, no recognizable franchise symbols, no weapon, no armor, no animal ears, no wings, no robot visor, no heavy cyberpunk machinery, no neon city, no cleavage, no exposed midriff, no thigh-high stockings, no sexualized pose, no watermark, no logos, no text. Do not include the prior square creature mascot.
```

### Q 版转换

参考输入：正常比例角色参考图。

```text
Use case: identity-preserve.
Asset type: original Q-version / chibi anime female software brand mascot for Forma.
Input image 1: character identity reference only. Preserve the silver-white asymmetrical bob haircut, geometric black-and-ice-blue hair clip, cool blue eyes, monochrome asymmetric coat, blue square hardware and small design-frame symbols. Completely redesign the proportions into a clearly CHIBI / Q-VERSION collectible anime character.
Primary request: A COOL, ALOOF CHIBI ANIME GIRL. The extremely stylized adult character is approximately 2.5 heads tall: oversized round head about 40 percent of total height, tiny compact torso, very short legs and arms, little boots. Big head and small body must read instantly. No realistic adult fashion-illustration proportions and no elongated limbs. This is the definitive mascot form, not a portrait crop of the earlier tall illustration.
Expression is the main priority: half-lidded narrow ice-blue eyes, sharp small upper eyelid lines, slightly angled brows, an absolutely flat tiny mouth or barely downturned mouth, cool unimpressed gaze, self-assured and emotionally restrained. Adorably stern silhouette with a cold personality. NO smile, NO blush, NO sparkle pupils, NO shy or bubbly expression.
Character: simplified silver-white bob with one long side-swept lock and subtle pointed tufts, black-blue square hairclip. Tiny fitted black high-neck top, short black-and-ivory asymmetrical coat with one longer side flap, high-waisted black trousers, chunky flat black ankle boots. Tiny blue rectangular belt buckle and a blue right-angle selection mark on the cuff. Practical opaque outfit. One small hand in pocket, other hand holding a single compact translucent blue rectangular design tile with two small simple geometric components, no text. Relaxed slight lean, three-quarter front view with direct cool gaze.
Style: premium Japanese chibi anime game mascot illustration, confident clean linework, highly refined cel shading, soft tiny material highlights, carefully designed simplified hair shapes and folds, expressive face, crisp high-quality edges. 2D illustration with subtle volume, NOT a realistic human, NOT a plastic 3D toy. Single whole character, no other character variants in the image.
Palette: pearl white/silver, charcoal black, ice-blue accents #0D99FF. Controlled and restrained, no pink or purple.
Composition: square image, full body centered, character occupies about 80 percent of frame, entire oversized head and both short boots fully inside image with generous margins. Strong simple silhouette suitable for a small sidebar assistant avatar.
Background: true transparent alpha background, no floor or backdrop, no gray glow or halo, no checkerboard texture. Keep self-shading inside the silhouette. Include only character and held small design tile.
Text: none. Avoid: realistic tall proportions, long legs, glamorous runway pose, cleavage, exposed midriff, skirts, stockings, high heels, weapons, robot parts, animal ears, additional props, excessive UI holograms, logos, watermark. Main requirement: cold aloof Q-version chibi anime girl, recognizable as the same silver-haired Forma design partner.
```

### 最终背景整理

参考输入：Q 版转换结果，最终保留白底版本。

```text
Edit this chibi character illustration: replace the entire gray checkerboard background with a perfectly clean, flat, solid white (#FFFFFF) background. The background must be completely uniform white from edge to edge, with no squares, no grid, no texture, no shadows, no lines, and no transparency pattern. This is a white-background character design presentation.
Keep the silver-haired cool chibi anime girl exactly recognizable: same oversized head and tiny body, half-lidded blue eyes and unsmiling face, asymmetrical black-and-white outfit, hairclip, trousers, boots, pose and little blue design panel. Preserve clean anime linework and cel shading. Give the full character a little white breathing room on every side; head and boots wholly visible. Only replace the background and add a small margin; no text, no watermark, no extra objects.
```

