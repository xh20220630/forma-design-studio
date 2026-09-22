from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / 'textures'
SOURCE = ROOT / 'public/brand/rin/v4'
OUT.mkdir(exist_ok=True)
W, H = 960, 640
FONT = 'C:/Windows/Fonts/segoeui.ttf'
BOLD = 'C:/Windows/Fonts/segoeuib.ttf'


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def rect(draw, box, fill, radius=12, outline=None, width=1):
    draw.rounded_rectangle(box, radius, fill, outline, width)


def label(draw, position, body, size=22, color='#172230', bold=False):
    draw.text(position, body, font=font(size, bold), fill=color, spacing=5)


def photo(name, size):
    return ImageOps.fit(Image.open(SOURCE / name).convert('RGB'), size, Image.Resampling.LANCZOS)


def nav(image, title, ink='#182431', background='#FFFFFF'):
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, W, 74), fill=background)
    label(draw, (30, 19), title, 25, ink, True)
    label(draw, (562, 24), 'Explore       Collection       About', 18, ink)
    draw.line((25, 74, 935, 74), fill='#DBE4EC', width=1)
    return draw


def dashboard():
    image = Image.new('RGB', (W, H), '#F3F6FA')
    draw = nav(image, 'STUDIO / INSIGHT')
    label(draw, (30, 104), 'Clarity in every decision.', 39, bold=True)
    label(draw, (32, 166), 'A complete view of the work that matters.', 21, '#728095')
    for i, (amount, caption) in enumerate([('12,480', 'Active visitors'), ('8,320', 'Conversions'), ('3.24%', 'Growth rate')]):
        x = 30 + i * 309
        rect(draw, (x, 221, x + 290, 349), '#FFFFFF')
        label(draw, (x + 19, 238), caption, 19, '#728095')
        label(draw, (x + 19, 270), amount, 35, bold=True)
        label(draw, (x + 209, 290), '+12%', 17, '#149F79')
    rect(draw, (30, 371, 637, 607), '#FFFFFF')
    for y in range(423, 588, 40):
        draw.line((57, y, 611, y), fill='#E7EDF4', width=1)
    points = [(60, 559), (141, 510), (221, 526), (302, 450), (382, 483), (462, 416), (539, 430), (609, 392)]
    draw.line(points, fill='#0D99FF', width=6)
    for x, y in points:
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill='#0D99FF')
    rect(draw, (657, 371, 930, 607), '#172333')
    draw.arc((705, 387, 880, 562), 190, 490, fill='#0D99FF', width=17)
    label(draw, (744, 447), '72%', 39, '#FFFFFF', True)
    label(draw, (722, 552), 'Goal reached', 20, '#A7BDD0')
    return image


def commerce():
    image = Image.new('RGB', (W, H), '#ECE3D6')
    image.paste(photo('cover-commerce.webp', (W, H - 74)), (0, 74))
    draw = nav(image, 'LIVING', background='#FBF8F3')
    label(draw, (38, 159), 'Considered\nessentials.', 56, '#3A3229', True)
    label(draw, (42, 328), 'Objects for a slower,\nmore beautiful everyday.', 24, '#5A4A3B')
    rect(draw, (42, 432, 235, 493), '#9D6137', 28)
    label(draw, (67, 447), 'Discover  →', 23, '#FFFFFF')
    label(draw, (41, 570), 'COLLECTION  /  2026', 17, '#5B4836')
    return image


def travel():
    image = Image.new('RGB', (W, H), '#FFFFFF')
    image.paste(photo('cover-travel.webp', (W, H - 74)), (0, 74))
    draw = nav(image, 'NORTH / OUTSIDE')
    rect(draw, (25, 124, 483, 485), '#163D48', 0)
    label(draw, (51, 145), 'A wider\nworld awaits.', 56, '#FFFFFF', True)
    label(draw, (55, 314), 'Find a little distance.\nBring back a new perspective.', 21, '#D2E9EC')
    rect(draw, (54, 407, 262, 465), '#FFFFFF', 28)
    label(draw, (78, 422), 'Explore  →', 22, '#174251')
    label(draw, (688, 566), 'FIELD NOTES / 03', 18, '#FFFFFF')
    return image


def midnight():
    image = photo('cover-midnight.webp', (W, H))
    draw = nav(image, 'MIDNIGHT', '#ECF5FF', '#0D1520')
    label(draw, (43, 133), 'Make something\nthat matters.', 55, '#FFFFFF', True)
    label(draw, (46, 291), 'A different kind of creative space.', 22, '#9FB5CF')
    rect(draw, (47, 354, 236, 414), '#0D99FF', 28)
    label(draw, (72, 370), 'Get started', 22, '#FFFFFF')
    label(draw, (48, 571), 'IDEAS / IN MOTION', 18, '#A9CAE3')
    return image


def journal():
    image = Image.new('RGB', (W, H), '#F9F8F5')
    draw = nav(image, 'JOURNAL / 06', background='#F9F8F5')
    label(draw, (30, 99), 'Thought in motion.', 54, '#253033', True)
    label(draw, (33, 173), 'A collection of places, objects and unexpected connections.', 21, '#687478')
    for i, (source, title) in enumerate([('cover-commerce.webp', 'THE ART OF LIVING'), ('cover-travel.webp', 'FINDING PERSPECTIVE'), ('cover-midnight.webp', 'AFTER HOURS')]):
        x = 30 + i * 309
        image.paste(photo(source, (286, 258)), (x, 235))
        label(draw, (x + 2, 516), title, 18, '#273137', True)
        draw.line((x + 3, 558, x + 250, 558), fill='#B7C1C5', width=3)
        draw.line((x + 3, 575, x + 204, 575), fill='#D0D7DA', width=3)
    return image


def system():
    image = Image.new('RGB', (W, H), '#EAF6FF')
    draw = nav(image, 'SYSTEM / LIBRARY', '#143346', '#EAF6FF')
    label(draw, (34, 102), 'Built to belong.', 53, '#143346', True)
    label(draw, (38, 178), 'One language. A thousand possibilities.', 22, '#617B91')
    colors = ['#0D99FF', '#172333', '#FFFFFF', '#A9DBF7']
    for i, color in enumerate(colors):
        x = 36 + i * 227
        rect(draw, (x, 238, x + 203, 370), color)
        label(draw, (x + 3, 386), ['BRAND', 'INK', 'PAPER', 'AIR'][i], 19, '#526E83')
    rect(draw, (34, 442, 420, 594), '#FFFFFF')
    label(draw, (55, 455), 'Aa', 76, '#172333', True)
    label(draw, (199, 477), 'TYPE / 01\nClear by design.', 22, '#526E83')
    rect(draw, (443, 442, 930, 594), '#FFFFFF')
    rect(draw, (466, 469, 677, 525), '#0D99FF', 12)
    label(draw, (490, 484), 'Create new', 22, '#FFFFFF', True)
    rect(draw, (697, 469, 908, 525), '#EAF6FF', 12)
    label(draw, (722, 484), 'Explore', 22, '#0878C8')
    draw.line((469, 558, 866, 558), fill='#DAE9F4', width=4)
    return image


names = ['INSIGHT', 'LIVING', 'NORTH', 'MIDNIGHT', 'JOURNAL', 'SYSTEM']
for index, create in enumerate([dashboard, commerce, travel, midnight, journal, system]):
    create().save(OUT / f'layout-{index + 1:02}.png', optimize=True)
    cover = Image.new('RGB', (W, H), ['#172333', '#EDF0F2', '#C5E7FC'][index % 3])
    draw = ImageDraw.Draw(cover)
    ink = '#DDECF7' if index % 3 == 0 else '#173344'
    label(draw, (54, 39), 'FORMA / TEMPLATE ATLAS', 22, ink)
    draw.line((55, 107, 905, 107), fill='#0D99FF', width=3)
    label(draw, (53, 166), f'{index + 1:02}', 158, ink, True)
    label(draw, (59, 467), names[index], 46, ink, True)
    label(draw, (61, 552), 'A NEW WAY TO BEGIN', 19, ink)
    for x in (820, 855, 890):
        draw.rectangle((x, 503, x + 16, 519), fill='#0D99FF')
    cover.save(OUT / f'cover-{index + 1:02}.png', optimize=True)
print('ATLAS_TEXTURES_COMPLETE', OUT)
