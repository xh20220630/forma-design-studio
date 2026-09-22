import json
import math
from pathlib import Path
import struct

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
DOC = Path(__file__).resolve().parent
OUT = ROOT / 'public/brand/rin/v5/motion'
video = OUT / 'atlas-unfold.webm'
data = video.read_bytes()


def vint(offset, keep_marker=False):
    first = data[offset]
    if not first:
        raise ValueError('Invalid EBML integer')
    width, marker = 1, 0x80
    while not first & marker:
        width += 1
        marker >>= 1
    value = int.from_bytes(data[offset:offset + width], 'big')
    return (value if keep_marker else value & ((1 << (7 * width)) - 1)), width


def elements(start, end):
    cursor = start
    while cursor < end:
        identity, width = vint(cursor, True)
        size, size_width = vint(cursor + width)
        content = cursor + width + size_width
        stop = min(content + size, end)
        if stop <= cursor:
            raise ValueError('Invalid EBML size')
        yield identity, content, stop
        cursor = stop


def integer(a, b):
    return int.from_bytes(data[a:b], 'big')


assert data[:4] == bytes.fromhex('1a45dfa3')
tracks, duration, frames, scale = [], None, 0, 1_000_000
for identity, start, end in elements(0, len(data)):
    if identity != 0x18538067:
        continue
    for section, start, end in elements(start, end):
        if section == 0x1549A966:
            for field, a, b in elements(start, end):
                if field == 0x2AD7B1:
                    scale = integer(a, b)
                elif field == 0x4489:
                    duration = struct.unpack('>d' if b - a == 8 else '>f', data[a:b])[0]
        elif section == 0x1654AE6B:
            for entry, a, b in elements(start, end):
                if entry != 0xAE:
                    continue
                track = {}
                for field, c, d in elements(a, b):
                    if field == 0x83:
                        track['type'] = integer(c, d)
                    elif field == 0x86:
                        track['codec'] = data[c:d].decode()
                    elif field == 0xE0:
                        for field, e, f in elements(c, d):
                            if field == 0xB0:
                                track['width'] = integer(e, f)
                            elif field == 0xBA:
                                track['height'] = integer(e, f)
                            elif field == 0x53C0:
                                track['alpha'] = integer(e, f)
                tracks.append(track)
        elif section == 0x1F43B675:
            for block, a, b in elements(start, end):
                if block == 0xA3:
                    frames += 1
                elif block == 0xA0:
                    frames += sum(field == 0xA1 for field, _, _ in elements(a, b))

seconds = duration * scale / 1_000_000_000
assert tracks == [{'type': 1, 'codec': 'V_VP9', 'width': 900, 'height': 600, 'alpha': 1}], tracks
assert math.isclose(seconds, 6, abs_tol=0.001), seconds
assert frames == 144, frames
poster = Image.open(OUT / 'atlas-poster.webp')
assert poster.size == (900, 600) and poster.mode == 'RGBA'
assert poster.getchannel('A').getextrema() == (0, 255)
report = {
    'video': {'path': '/brand/rin/v5/motion/atlas-unfold.webm', 'codec': 'VP9', 'width': 900, 'height': 600, 'fps': 24, 'duration': seconds, 'frames': frames, 'alphaMode': 1, 'audio': False, 'bytes': len(data)},
    'poster': {'path': '/brand/rin/v5/motion/atlas-poster.webp', 'width': 900, 'height': 600, 'rgba': True, 'bytes': (OUT / 'atlas-poster.webp').stat().st_size},
    'temporaryFrameSequence': 'none; rendered directly to WebM',
}
(DOC / 'asset-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
