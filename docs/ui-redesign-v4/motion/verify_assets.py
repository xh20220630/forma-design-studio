import hashlib
import json
import math
from pathlib import Path
import struct

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/brand/rin/v4/motion'
ASSET = OUT / 'rin-pearl-loop.webm'
data = ASSET.read_bytes()


def variable_integer(offset, keep_marker=False):
    first = data[offset]
    if not first:
        raise ValueError('Invalid EBML integer')
    width, marker = 1, 0x80
    while not first & marker:
        width += 1
        marker >>= 1
    value = int.from_bytes(data[offset:offset + width], 'big')
    if not keep_marker:
        value &= (1 << (7 * width)) - 1
    return value, width


def elements(start, end):
    cursor = start
    while cursor < end:
        identity, width = variable_integer(cursor, True)
        size, size_width = variable_integer(cursor + width)
        content = cursor + width + size_width
        stop = min(content + size, end)
        if stop <= cursor:
            raise ValueError('Invalid EBML size')
        yield identity, content, stop
        cursor = stop


def number(start, end):
    return int.from_bytes(data[start:end], 'big')


assert data[:4] == bytes.fromhex('1a45dfa3')
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
                        for size_field, e, f in elements(c, d):
                            if size_field == 0xB0:
                                track['width'] = number(e, f)
                            elif size_field == 0xBA:
                                track['height'] = number(e, f)
                            elif size_field == 0x53C0:
                                track['alpha'] = number(e, f)
                tracks.append(track)
        elif section == 0x1F43B675:
            for block, a, b in elements(start, end):
                if block == 0xA3:
                    frames += 1
                elif block == 0xA0:
                    frames += sum(field == 0xA1 for field, _, _ in elements(a, b))

seconds = duration * scale / 1_000_000_000
assert tracks == [{'type': 1, 'codec': 'V_VP9', 'width': 720, 'height': 480, 'alpha': 1}], tracks
assert math.isclose(seconds, 4, abs_tol=0.001), seconds
assert frames == 80, frames
poster = Image.open(OUT / 'rin-pearl-poster.png')
assert poster.size == (720, 480) and poster.mode == 'RGBA'
assert poster.getchannel('A').getextrema() == (0, 255)
poster.save(OUT / 'rin-pearl-poster.webp', format='WEBP', quality=88, method=6)
report = {
    'video': {'path': str(ASSET.relative_to(ROOT)).replace('\\', '/'), 'codec': 'VP9', 'width': 720, 'height': 480, 'fps': 20, 'duration': seconds, 'frames': frames, 'alpha': True, 'audio': False, 'bytes': len(data)},
    'poster': {'pngBytes': (OUT / 'rin-pearl-poster.png').stat().st_size, 'webpBytes': (OUT / 'rin-pearl-poster.webp').stat().st_size, 'rgba': True},
    'sourceRinSha256': hashlib.sha256((ROOT / 'public/brand/rin/v4/rin-full-body.png').read_bytes()).hexdigest(),
}
(Path(__file__).parent / 'asset-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
