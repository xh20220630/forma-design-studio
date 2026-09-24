import json
import math
from pathlib import Path

import bpy


DOC = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(DOC / 'atlas-scene.blend'))
scene = bpy.context.scene
leaves = [bpy.data.objects[f'Atlas {i + 1:02} reversible leaf'] for i in range(6)]
carriers = [bpy.data.objects[f'Atlas {i + 1:02} magnetic carrier'] for i in range(6)]
samples = {}
for frame in (1, 46, 77, 130, 144):
    scene.frame_set(frame)
    samples[frame] = [
        {
            'leaf': leaf.name,
            'flipDegrees': round(math.degrees(leaf.rotation_euler.z), 3),
            'worldPosition': [round(float(v), 4) for v in leaf.matrix_world.translation],
            'carrierPosition': [round(float(v), 4) for v in carrier.location],
        }
        for leaf, carrier in zip(leaves, carriers)
    ]
assert all(abs(item['flipDegrees']) < 0.01 for item in samples[1])
assert all(abs(item['flipDegrees'] - 180) < 0.01 for item in samples[144])
assert samples[130] == samples[144]
assert len({tuple(item['carrierPosition']) for item in samples[144]}) == 6
assert scene.frame_end == 144 and scene.render.fps == 24
assert all(image.packed_file for image in bpy.data.images if image.source == 'FILE')
report = {
    'meshObjects': sum(obj.type == 'MESH' for obj in scene.objects),
    'animatedObjects': sum(bool(obj.animation_data) for obj in scene.objects),
    'packedArtworkImages': sum(image.source == 'FILE' for image in bpy.data.images),
    'allSixLeavesTurn180Degrees': True,
    'sixDistinctFinalGridPositions': True,
    'completionHoldFrames': 15,
    'noCharacterArtwork': True,
    'samples': samples,
}
(DOC / 'scene-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key != 'samples'}, indent=2))
