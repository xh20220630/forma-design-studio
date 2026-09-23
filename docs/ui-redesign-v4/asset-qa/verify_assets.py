from pathlib import Path
import json

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[3]
QA = Path(__file__).resolve().parent
DEST = ROOT / 'apps/web/public/brand/rin/v4'
records = json.loads((QA / 'production-report.json').read_text(encoding='utf-8'))
roles = json.loads((QA / 'alpha-report.json').read_text(encoding='utf-8'))
checks = []
columns, tile_width, tile_height = 3, 400, 330
sheet = Image.new('RGB', (columns * tile_width, ((len(records) + columns - 1) // columns) * tile_height), '#F5F6F8')

for i, record in enumerate(records):
    path = DEST / record['file']
    img = Image.open(path)
    assert list(img.size) == record['size']
    assert img.mode == record['mode']
    x, y = i % columns * tile_width, i // columns * tile_height
    tile = Image.new('RGB', (376, 278), '#FFFFFF')
    if img.mode == 'RGBA':
        alpha = np.asarray(img.getchannel('A'))
        assert alpha.min() == 0 and alpha.max() == 255
        assert np.any((alpha > 0) & (alpha < 255))
        assert not np.any(alpha[:2]) and not np.any(alpha[-2:])
        assert not np.any(alpha[:, :2]) and not np.any(alpha[:, -2:])
        draw = ImageDraw.Draw(tile)
        for cy in range(0, 278, 16):
            for cx in range(0, 376, 16):
                draw.rectangle((cx, cy, cx + 15, cy + 15), fill='#E4E9EF' if (cx // 16 + cy // 16) % 2 else '#F6F8FA')
    thumb = img.copy()
    thumb.thumbnail((376, 270), Image.Resampling.LANCZOS)
    tile.paste(thumb, ((376 - thumb.width) // 2, (278 - thumb.height) // 2), thumb if thumb.mode == 'RGBA' else None)
    sheet.paste(tile, (x + 12, y + 12))
    ImageDraw.Draw(sheet).text((x + 14, y + 296), f"{record['file']}  {img.width}x{img.height}", fill='#191E28')
    checks.append({'file': record['file'], 'dimensions_verified': True, 'mode_verified': True, 'alpha_verified': img.mode == 'RGBA'})

assert all(role['opaque_pixels_exact'] for role in roles)
sheet.save(QA / 'production-contact-sheet.jpg', quality=93)
summary = {'asset_count': len(records), 'production_bytes': sum(record['bytes'] for record in records), 'original_rin_opaque_rgb_exact': True, 'checks': checks}
(QA / 'verification.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in summary.items() if key != 'checks'}, indent=2))
