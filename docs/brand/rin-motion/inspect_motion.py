import argparse
import math
from pathlib import Path
import struct


parser = argparse.ArgumentParser()
parser.add_argument('--studio', action='store_true')
args = parser.parse_args()
filename = 'rin-studio-loop.webm' if args.studio else 'rin-assembly.webm'
width, height, expected_seconds, expected_frames = (720, 480, 5, 125) if args.studio else (400, 240, 2.4, 60)
ASSET = Path(__file__).resolve().parents[3] / 'apps' / 'web' / 'public' / 'brand' / 'rin' / filename
data = ASSET.read_bytes()


def variable_integer(offset, keep_marker=False):
    first = data[offset]
    if not first:
        raise ValueError('Invalid EBML integer')
    width = 1
    marker = 0x80
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
            raise ValueError('Invalid EBML element size')
        yield identity, content, stop
        cursor = stop


def number(start, end):
    return int.from_bytes(data[start:end], 'big')


assert data[:4] == bytes.fromhex('1a45dfa3'), 'Missing EBML header'
tracks = []
scale = 1_000_000
duration = None
frame_count = 0
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
                tracks.append(track)
        elif section == 0x1F43B675:
            for block, a, b in elements(start, end):
                if block == 0xA3:
                    frame_count += 1
                elif block == 0xA0:
                    frame_count += sum(field == 0xA1 for field, _, _ in elements(a, b))

assert tracks == [{'type': 1, 'codec': 'V_VP9', 'width': width, 'height': height}], tracks
assert duration is not None, 'Missing duration'
seconds = duration * scale / 1_000_000_000
assert math.isclose(seconds, expected_seconds, abs_tol=0.001), seconds
assert frame_count == expected_frames, frame_count
print(f'{ASSET.name}: VP9, {width}x{height}, {seconds:.3f}s, {frame_count} frames, no audio, {len(data):,} bytes')
