# Editor empty-state / Rin start-design

## Deliverable

- Asset: `public/brand/rin/editor/rin-start-design.png`
- PNG RGBA, 1230 × 1278 px; 1,305,777 bytes.
- Recommended presentation: `width: 240px; height: auto; object-fit: contain`; reserve approximately 240 × 250 px. The image contains clear side margins; the central character and frame remain legible at this size.
- Composition: the original silver-haired Rin sits on a pearl/ice-blue design frame and holds a translucent layout panel. Original face, asymmetric fringe, blue eyes, geometric hair clip, black-and-white coat and blue buckle accents remain recognizable. Rendering is refined anime illustration with dimensional material shading.
- No code, global IP mapping, pre-existing illustration or video was changed.

## Method and selection

Generated using the built-in `image_gen.imagegen` tool, with both inspected original references supplied through `referenced_image_paths`. No CLI or external image API was used. The selected generated RGBA PNG was copied byte-for-byte from the built-in output into the project, preserving its generated alpha channel. It was not redrawn, color-keyed or composited into the production asset after generation.

The selected output is the first generation. Later material-refinement variants and a background-extraction attempt produced RGB images with a painted checkerboard; those failed transparency QA and were not used or copied into the project. The selected illustration has genuine transparent and translucent pixels, not a checkerboard background. See `asset-qa.json` and the 240 px light/white/dark presentation check in `display-qa.png`.

Original references:
- `public/brand/rin/forma-rin-chibi-v1.png` — authoritative character identity and costume.
- `public/brand/rin/v4/rin-empty-320.webp` — supporting seated proportion and design-frame relationship.

Selected built-in output:
`C:/Users/Administrator/.codex/generated_images/01a0c007-e3aa-7092-9f17-47a8328dd887/exec-c718995d-3364-4b7b-a91b-30b4f9273533.png`

## Actual final selected prompt

```text
Use case: stylized-concept.
Asset type: a single premium transparent PNG illustration for the empty canvas of a professional visual design editor, displayed at approximately 240 px wide.
Input images: Image 1 is the authoritative identity and costume reference for the existing original mascot Rin. Image 2 is a supporting reference for Rin's seated proportions and relationship to a design frame. These are identity references, not backgrounds.
Primary request: create a polished new illustration of THE SAME Rin character in a refined high-end anime feature-film / collectible-figurine rendering. Preserve the exact recognizable IP: short silver-white layered bob, long asymmetrical fringe partially covering the eye on the viewer's left, bright ice-blue eyes, calm slightly serious delicate face, the distinctive small black geometric hair clip with its blue square on the viewer's right, black high-collar outfit, long black-and-white futuristic coat with white lapels and split tails, blue square buckle details, dark boots. Preserve the chibi large-head/small-body proportions, facial identity and costume silhouette of the references. A new purposeful pose and richer material shading are allowed; do not reinvent the character.
Composition: an elegant compact three-quarter-view arrangement. Rin is seated naturally on the upper edge of one substantial but minimal landscape design frame, one boot hanging down, the other leg gently bent. Rin looks toward a small translucent pale ice-blue layout panel lightly held or touched with one hand, as though arranging the first design component. The large frame is pearl-white, softly beveled, with a very faint transparent blue inner pane and just two or three clean abstract component blocks. Its corners communicate a design canvas without a logo. Keep all hands anatomically clean. Frame and character form one coherent balanced silhouette, fully visible, centered with 8–10% clear padding, readable at 240 px. No crop of hair, boots, coat tails, or frame.
Rendering: exceptionally careful hair strands grouped into sculpted silver locks, luminous blue irises, refined matte skin, tailored satin-matte dark fabric, subtle soft leather boots, clean chamfered frame edges, restrained translucent acrylic. Soft large studio key light, delicate cool fill, gentle contact shadows between character and frame. Crisp intentional silhouette and fine material detail, refined collectible art direction. No toy-plastic glare, no photoreal human.
Background: genuinely transparent alpha, including all empty space around the character and through any open frame areas. No solid white background, no gray background, no checkerboard painted into the image, no floor plane or environment. Any minimal contact shadow must be translucent and localized to the object.
Palette: original silver, charcoal, pearl white and restrained ice blue. No new accent color. Avoid text, letters, numerals, logos, watermark, UI screenshots, floating debris, sparkles, excessive glow, neon halos, busy background, extra characters and unnecessary props. Deliver only this one finished transparent illustration.
```

