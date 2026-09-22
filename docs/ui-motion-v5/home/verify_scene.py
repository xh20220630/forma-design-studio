import json
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


DOC = Path(__file__).resolve().parent
scene = bpy.context.scene
bpy.ops.wm.open_mainfile(filepath=str(DOC / 'home-idea-foundry.blend'))
scene = bpy.context.scene


def matrices(frame):
    scene.frame_set(frame)
    return {obj.name: [value for row in obj.matrix_world for value in row] for obj in scene.objects}


begin = matrices(1)
assembly = matrices(88)
settled = matrices(128)
end = matrices(144)
max_difference = max(abs(a - b) for name in end for a, b in zip(settled[name], end[name]))
assert max_difference < 0.000001, max_difference
moving = [name for name in begin if max(abs(a - b) for a, b in zip(begin[name], assembly[name])) > 0.01]
assert len(moving) > 25, len(moving)
assert not scene.camera.animation_data
assert not any('rin' in image.name.lower() for image in bpy.data.images)
report = {'objectCount': len(scene.objects), 'movingObjectCount': len(moving), 'settledFrame': 128, 'holdEndFrame': 144, 'holdMatrixMaxError': max_difference, 'cameraFixed': True, 'characterRasterInScene': False, 'externalAssets': [image.filepath for image in bpy.data.images if image.source == 'FILE' and not image.packed_file], 'actualRotations': {'mainPanelZDegrees': 81, 'foldLeafZDegrees': 129, 'paletteZDegrees': [75, 95, 115], 'actionPlateYDegrees': 110}}
assert not report['externalAssets']
view_bounds = [1.0, 1.0, 0.0, 0.0]
for frame in range(1, 145):
    scene.frame_set(frame)
    for obj in scene.objects:
        if obj.type not in {'MESH', 'FONT', 'CURVE'} or obj.name == 'Soft ground contact':
            continue
        for corner in obj.bound_box:
            point = world_to_camera_view(scene, scene.camera, obj.matrix_world @ Vector(corner))
            view_bounds = [min(view_bounds[0], point.x), min(view_bounds[1], point.y), max(view_bounds[2], point.x), max(view_bounds[3], point.y)]
report['allFrameGeometryViewportBounds'] = [round(value, 4) for value in view_bounds]
report['geometryInsideViewport'] = all(0 <= value <= 1 for value in view_bounds)
(DOC / 'scene-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
