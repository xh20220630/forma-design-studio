import hashlib
import json
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[3]
SCENE = Path(__file__).with_name('rin-pearl.blend')
bpy.ops.wm.open_mainfile(filepath=str(SCENE))
scene = bpy.context.scene
scene.frame_set(1)
first = {obj.name: obj.matrix_world.copy() for obj in scene.objects}
scene.frame_set(81)
maximum_error = max(
    abs(obj.matrix_world[row][column] - first[obj.name][row][column])
    for obj in scene.objects
    for row in range(4)
    for column in range(4)
)
assert maximum_error < 0.000001, maximum_error
rin = bpy.data.objects['Original silver-haired blue-eyed Rin, fixed pose']
assert rin.animation_data is None
assert scene.camera.animation_data is None
texture = next(
    node.image for node in rin.data.materials[0].node_tree.nodes if node.type == 'TEX_IMAGE'
)
original = (ROOT / 'apps/web/public/brand/rin/v4/rin-full-body.png').read_bytes()
assert hashlib.sha256(bytes(texture.packed_file.data)).digest() == hashlib.sha256(original).digest()
report = {
    'loopBoundaryMatrixMaxError': maximum_error,
    'rinAnimated': False,
    'cameraAnimated': False,
    'packedRinMatchesSource': True,
    'renderEngine': scene.render.engine,
    'renderSamples': scene.eevee.taa_render_samples,
}
Path(__file__).with_name('scene-verification.json').write_text(
    json.dumps(report, indent=2), encoding='utf-8'
)
print(json.dumps(report, indent=2))
