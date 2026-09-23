from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
DEST = ROOT / 'apps/web/public/brand/rin/v4'
QA = Path(__file__).resolve().parent
SCENES = ['hero-environment', 'cover-commerce', 'cover-travel', 'cover-midnight']


def optimize():
    masters = QA / 'masters'
    masters.mkdir(exist_ok=True)
    records = []
    for name in SCENES:
        original = Image.open(masters / f'{name}.png').convert('RGB')
        img = original.copy()
        img.thumbnail((1920, 640) if name.startswith('hero') else (1200, 750), Image.Resampling.LANCZOS)
        target = DEST / f'{name}.webp'
        img.save(target, quality=88, method=6)
        records.append({'file': target.name, 'size': list(img.size), 'bytes': target.stat().st_size, 'mode': img.mode, 'source_size': list(original.size), 'crop': 'none'})
        if name.startswith('hero'):
            wide = original.crop((0, 100, original.width, 650)).resize((1920, 486), Image.Resampling.LANCZOS)
            target = DEST / 'hero-environment-wide.webp'
            wide.save(target, quality=88, method=6)
            records.append({'file': target.name, 'size': list(wide.size), 'bytes': target.stat().st_size, 'mode': wide.mode, 'source_size': list(original.size), 'crop': [0, 100, original.width, 650]})
            compact = original.crop((1350, 0, 2074, 724)).resize((640, 640), Image.Resampling.LANCZOS)
            target = DEST / 'studio-compact.webp'
            compact.save(target, quality=88, method=6)
            records.append({'file': target.name, 'size': list(compact.size), 'bytes': target.stat().st_size, 'mode': compact.mode, 'source_size': list(original.size), 'crop': [1350, 0, 2074, 724]})
    for name in ['rin-full-body', 'rin-theme', 'rin-avatar', 'rin-empty', 'rin-thinking', 'rin-success', 'rin-error']:
        original = Image.open(DEST / f'{name}.png').convert('RGBA')
        height = 128 if name == 'rin-avatar' else 640 if name in ('rin-full-body', 'rin-theme') else 320
        img = original.copy()
        img.thumbnail((height, height), Image.Resampling.LANCZOS)
        safe = Image.new('RGBA', img.size)
        content = original.copy()
        content.thumbnail((img.width - 4, img.height - 4), Image.Resampling.LANCZOS)
        safe.paste(content, ((safe.width - content.width) // 2, (safe.height - content.height) // 2))
        img = safe
        target = DEST / f'{name}-{height}.webp'
        img.save(target, lossless=True, method=6)
        records.append({'file': target.name, 'size': list(img.size), 'bytes': target.stat().st_size, 'mode': img.mode, 'source_size': list(original.size), 'crop': 'none'})
    scene = Image.open(DEST / 'hero-environment-wide.webp').convert('RGBA')
    scene = scene.resize((1440, 365), Image.Resampling.LANCZOS)
    character = Image.open(DEST / 'rin-full-body.png').convert('RGBA')
    character.thumbnail((190, 322), Image.Resampling.LANCZOS)
    scene.alpha_composite(character, (1025, 25))
    scene.convert('RGB').save(QA / 'hero-composition-preview.jpg', quality=94)
    (QA / 'production-report.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
    print(json.dumps(records, indent=2))


if __name__ == '__main__':
    optimize()
