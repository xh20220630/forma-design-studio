import hashlib
import json
import math
from pathlib import Path
import struct

from PIL import Image


DOC = Path(__file__).resolve().parent
ROOT = DOC.parents[2]
OUT = ROOT / 'apps/web/public/brand/rin/v5/motion'
asset = OUT / 'home-idea-foundry.webm'
data = asset.read_bytes()


def integer(offset, marker=False):
    first = data[offset]
    if not first:
        raise ValueError('Invalid EBML integer')
    width, bit = 1, 128
    while not first & bit:
        width += 1
        bit >>= 1
    value = int.from_bytes(data[offset:offset + width], 'big')
    return (value if marker else value & ((1 << (7 * width)) - 1)), width


def elements(start, end):
    cursor = start
    while cursor < end:
        identity, length = integer(cursor, True)
        size, size_length = integer(cursor + length)
        content = cursor + length + size_length
        stop = min(content + size, end)
        assert stop > cursor
        yield identity, content, stop
        cursor = stop


def number(start, end):
    return int.from_bytes(data[start:end], 'big')


tracks, duration, frames, scale = [], None, 0, 1_000_000
for identity, start, end in elements(0, len(data)):
    if identity != 0x18538067:
        continue
    for section, start, end in elements(start, end):
        if section == 0x1549A966:
            for field, a, b in elements(start, end):
                if field == 0x2AD7B1:
                    scale = number(a, b)
                elif field == 0x4489:
                    duration = struct.unpack('>d' if b - a == 8 else '>f', data[a:b])[0]
        elif section == 0x1654AE6B:
            for entry, a, b in elements(start, end):
                if entry != 0xAE:
                    continue
                track = {}
                for field, c, d in elements(a, b):
                    if field == 0x83:
                        track['type'] = number(c, d)
                    elif field == 0x86:
                        track['codec'] = data[c:d].decode()
                    elif field == 0xE0:
                        for video_field, e, f in elements(c, d):
                            if video_field in (0xB0, 0xBA, 0x53C0):
                                track[{0xB0: 'width', 0xBA: 'height', 0x53C0: 'alpha'}[video_field]] = number(e, f)
                tracks.append(track)
        elif section == 0x1F43B675:
            for block, a, b in elements(start, end):
                if block == 0xA3:
                    frames += 1
                elif block == 0xA0:
                    frames += sum(field == 0xA1 for field, _, _ in elements(a, b))

seconds = duration * scale / 1_000_000_000
assert tracks == [{'type': 1, 'codec': 'V_VP9', 'width': 960, 'height': 640, 'alpha': 1}], tracks
assert math.isclose(seconds, 6, abs_tol=0.001), seconds
assert frames == 144, frames
poster = Image.open(OUT / 'home-idea-foundry-poster.png')
assert poster.size == (960, 640) and poster.mode == 'RGBA'
assert poster.getchannel('A').getextrema() == (0, 255)
poster.save(OUT / 'home-idea-foundry-poster.webp', format='WEBP', quality=90, method=6)
report = {'video': {'path': str(asset.relative_to(ROOT)).replace('\\', '/'), 'codec': 'VP9', 'width': 960, 'height': 640, 'fps': 24, 'duration': seconds, 'frames': frames, 'alpha': True, 'audio': False, 'loop': False, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}, 'poster': {'pngBytes': (OUT / 'home-idea-foundry-poster.png').stat().st_size, 'webpBytes': (OUT / 'home-idea-foundry-poster.webp').stat().st_size, 'rgba': True, 'frame': 144}}
(DOC / 'asset-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
