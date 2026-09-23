import json
from pathlib import Path
import shutil
import tempfile

from PIL import Image, ImageDraw, ImageFont


DOC = Path(__file__).resolve().parent
ROOT = DOC.parents[2]
manifest = json.loads((DOC / 'preview-source.json').read_text(encoding='utf-8'))
temp = Path(manifest['directory']).resolve()
system_temp = Path(tempfile.gettempdir()).resolve()
assert temp.parent == system_temp and temp.name.startswith('rin-home-v5-'), temp
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 15)
small = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 12)
sheet = Image.new('RGB', (1008, 784), '#edf4f8')
draw = ImageDraw.Draw(sheet)
draw.text((24, 14), 'IDEA FOUNDRY / 6-second assembly study', font=font, fill='#203347')
captions = ['00.00 / scattered machining', '01.96 / spine locks, hinge opens', '03.63 / interface modules dock', '05.96 / connected, completely still']
for index, (path, caption) in enumerate(zip(manifest['frames'], captions)):
    frame = Image.open(path).convert('RGBA')
    x, y = 16 + (index % 2) * 496, 46 + (index // 2) * 362
    background = Image.new('RGBA', frame.size, '#f0f5f9')
    background.alpha_composite(frame)
    sheet.paste(background.convert('RGB'), (x, y))
    draw.text((x + 12, y + 327), caption, font=small, fill='#203347')
sheet.save(DOC / 'home-storyboard.jpg', quality=94)
poster = Image.open(manifest['frames'][-1]).convert('RGBA')
composition = Image.new('RGBA', poster.size, '#eef5fb')
composition.alpha_composite(poster)
layout = json.loads((DOC / 'scene-layout.json').read_text(encoding='utf-8'))['rinOverlay']
rin = Image.open(ROOT / 'apps/web/public/brand/rin/v4/rin-full-body.png').convert('RGBA')
height = round(poster.height * layout['height'])
rin = rin.resize((round(rin.width / rin.height * height), height), Image.Resampling.LANCZOS)
x = round(layout['feetX'] * poster.width - rin.width / 2)
y = round(layout['feetY'] * poster.height - height)
composition.alpha_composite(rin, (x, y))
composition.save(DOC / 'home-rin-overlay-guide.png')
alpha_boxes = []
for path in manifest['frames']:
    img = Image.open(path).convert('RGBA')
    alpha_boxes.append({'frame': Path(path).stem, 'alphaBounds': img.getchannel('A').point(lambda x: 255 if x > 16 else 0).getbbox()})
(DOC / 'preview-verification.json').write_text(json.dumps(alpha_boxes, indent=2), encoding='utf-8')
shutil.rmtree(temp)
(DOC / 'preview-source.json').unlink()
print('CONTACT_SHEET_COMPLETE', str(DOC / 'home-storyboard.jpg'))
