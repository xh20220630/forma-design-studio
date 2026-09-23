from pathlib import Path
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'apps/web/public/brand/rin'
DEST = SOURCE / 'v4'
QA = Path(__file__).resolve().parent

SOURCES = {
    'rin-full-body': 'forma-rin-chibi-v1.png',
    'rin-theme': 'rin-theme-v2.png',
    'rin-avatar': 'rin-avatar-v1.png',
    'rin-empty': 'rin-empty-v1.png',
    'rin-thinking': 'rin-thinking-v1.png',
    'rin-success': 'rin-success-v1.png',
    'rin-error': 'rin-error-v1.png',
}


def remove_detached_specks(mask, minimum_area=24):
    binary = np.asarray(mask) > 0
    parents, areas, runs = [], [], []
    previous = []

    def root(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    for y, row in enumerate(binary):
        changes = np.diff(np.pad(row.astype(np.int8), (1, 1)))
        current = []
        for start, end in zip(np.flatnonzero(changes == 1), np.flatnonzero(changes == -1)):
            index = len(parents)
            parents.append(index)
            areas.append(int(end - start))
            for old_start, old_end, old_index in previous:
                if old_start > end:
                    break
                if old_end >= start:
                    a, b = root(index), root(old_index)
                    if a != b:
                        parents[b] = a
                        areas[a] += areas[b]
            current.append((start, end, index))
            runs.append((y, start, end, index))
        previous = current
    cleaned = binary.astype(np.uint8) * 255
    for y, start, end, index in runs:
        if areas[root(index)] < minimum_area:
            cleaned[y, start:end] = 0
    return Image.fromarray(cleaned)


def extract_alpha(source, threshold=232, protected_polygons=()):
    pixels = np.asarray(source.convert('RGB')).astype(np.float32)
    near_white = (pixels.min(axis=2) >= threshold) & (np.ptp(pixels, axis=2) < 25)
    h, w = near_white.shape
    flood = Image.new('L', (w + 2, h + 2), 255)
    flood.paste(Image.fromarray(near_white.astype(np.uint8) * 255), (1, 1))
    ImageDraw.floodfill(flood, (0, 0), 128, thresh=0)
    outside = np.asarray(flood)[1:-1, 1:-1] == 128
    solid = Image.fromarray((~outside).astype(np.uint8) * 255)
    protection = ImageDraw.Draw(solid)
    for polygon in protected_polygons:
        protection.polygon(polygon, fill=255)
    solid = remove_detached_specks(solid)
    edge = solid.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.52))
    alpha = np.minimum(np.asarray(solid), np.asarray(edge)).astype(np.float32) / 255
    partial = (alpha > 0) & (alpha < 1)
    # White matting is removed only from the one-pixel contour; opaque artwork stays exact.
    pixels[partial] = np.clip((pixels[partial] - 255 * (1 - alpha[partial, None])) / alpha[partial, None], 0, 255)
    rgba = np.dstack((pixels.astype(np.uint8), np.round(alpha * 255).astype(np.uint8)))
    rgba[alpha == 0, :3] = 0
    return Image.fromarray(rgba)


def checker(size):
    canvas = Image.new('RGB', size, '#D4DCE4')
    draw = ImageDraw.Draw(canvas)
    for y in range(0, size[1], 20):
        for x in range(0, size[0], 20):
            if (x // 20 + y // 20) % 2:
                draw.rectangle((x, y, x + 19, y + 19), fill='#EBEFF3')
    return canvas


def prepare():
    records = []
    panels = []
    for name, filename in SOURCES.items():
        original = Image.open(SOURCE / filename).convert('RGB')
        protected = (
            [[(231, 712), (254, 700), (353, 688), (405, 737), (420, 831), (414, 845), (290, 863), (246, 847)]]
            if name == 'rin-error' else []
        )
        rgba = extract_alpha(original, 229 if name == 'rin-avatar' else 232, protected)
        bbox = rgba.getchannel('A').getbbox()
        cropped = rgba.crop(bbox)
        padded = Image.new('RGBA', (cropped.width + 24, cropped.height + 24))
        padded.paste(cropped, (12, 12))
        png = DEST / f'{name}.png'
        webp = DEST / f'{name}.webp'
        padded.save(png, optimize=True)
        padded.save(webp, lossless=True, method=6)
        alpha = np.asarray(padded.getchannel('A'))
        source_pixels = np.asarray(original)
        derived = np.asarray(rgba)
        opaque = derived[:, :, 3] == 255
        record = {
            'name': name,
            'source': f'apps/web/public/brand/rin/{filename}',
            'source_size': list(original.size),
            'source_crop_box': list(bbox),
            'output_size': list(padded.size),
            'padding_px': 12,
            'transparent_fraction': round(float((alpha == 0).mean()), 5),
            'partial_alpha_pixels': int(((alpha > 0) & (alpha < 255)).sum()),
            'opaque_pixels_exact': bool(np.array_equal(source_pixels[opaque], derived[:, :, :3][opaque])),
            'png_bytes': png.stat().st_size,
            'webp_bytes': webp.stat().st_size,
        }
        records.append(record)
        thumb = padded.copy()
        thumb.thumbnail((280, 340), Image.Resampling.LANCZOS)
        row = Image.new('RGB', (960, 400), '#FFFFFF')
        for i, color in enumerate((None, '#0D99FF', '#171B24')):
            tile = checker((312, 352)) if color is None else Image.new('RGB', (312, 352), color)
            tile.paste(thumb, ((312 - thumb.width) // 2, (352 - thumb.height) // 2), thumb)
            row.paste(tile, (i * 320, 32))
        ImageDraw.Draw(row).text((12, 10), f'{name} | {padded.width} x {padded.height} | opaque RGB preserved', fill='#191E28')
        panels.append(row)
    sheet = Image.new('RGB', (960, 400 * len(panels)), '#FFFFFF')
    for index, panel in enumerate(panels):
        sheet.paste(panel, (0, index * 400))
    sheet.save(QA / 'alpha-contact-sheet.jpg', quality=93)
    (QA / 'alpha-report.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
    print(json.dumps(records, indent=2))


if __name__ == '__main__':
    prepare()
