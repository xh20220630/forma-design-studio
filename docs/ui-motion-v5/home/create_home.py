import argparse
import json
import math
from pathlib import Path
import sys
import tempfile

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


parser = argparse.ArgumentParser()
parser.add_argument('--mode', choices=['preview', 'render', 'source'], default='preview')
parser.add_argument('--samples', type=int, default=32)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
ROOT = Path(__file__).resolve().parents[3]
DOC = Path(__file__).resolve().parent
OUT = ROOT / 'apps/web/public/brand/rin/v5/motion'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.eevee.taa_render_samples = 16 if args.mode == 'preview' else args.samples
scene.render.resolution_x, scene.render.resolution_y = (480, 320) if args.mode == 'preview' else (960, 640)
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 144
scene.render.film_transparent = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
scene.view_settings.view_transform = 'AgX'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.73, 0.83, 1.0, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.45


def material(name, color, roughness=0.3, metal=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next((node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
    if shader is None:
        shader = mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        output = next((node for node in mat.node_tree.nodes if node.type == 'OUTPUT_MATERIAL'), None)
        output = output or mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
        mat.node_tree.links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Coat Weight'].default_value = 0.28
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    return mat


pearl = material('Warm porcelain / structural shell', (0.88, 0.92, 0.97), 0.28, 0.08)
white = material('Matte ceramic / interface face', (0.97, 0.98, 1), 0.43)
slate = material('Deep graphite / typography', (0.025, 0.043, 0.071), 0.38)
silver = material('Brushed platinum / hinge and dial', (0.24, 0.33, 0.44), 0.22, 0.92)
blue = material('Rin cyan / active design modules', (0.008, 0.33, 0.92), 0.23, 0.22)
ice = material('Ice ceramic / secondary modules', (0.4, 0.76, 0.96), 0.29, 0.1)
mist = material('Pale mist / quiet interface fields', (0.48, 0.62, 0.75), 0.4)
glow = material('Ice light / travelling route', (0.06, 0.68, 1), 0.2, 0.15, 2.0)


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent, obj.location = parent, location
    return obj


def box(name, location, dimensions, mat, parent=None, radius=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name, obj.dimensions = name, dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent, obj.location = parent, location
    obj.data.materials.append(mat)
    if radius:
        bevel = obj.modifiers.new('Machined soft edge', 'BEVEL')
        bevel.width, bevel.segments = radius, 4
        obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    return obj


def sphere(name, position, radius, mat, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=radius)
    obj = bpy.context.object
    obj.name, obj.parent, obj.location = name, parent, position
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def tube(name, points, radius, mat, parent=None):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 16
    data.bevel_depth, data.bevel_resolution = radius, 3
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for item, position in zip(spline.bezier_points, points):
        item.co = position
        item.handle_left_type = item.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    return obj


def label(body, position, size, parent, mat=slate):
    data = bpy.data.curves.new(body, 'FONT')
    data.body, data.size = body, size
    data.extrude = 0.0006
    obj = bpy.data.objects.new(body, data)
    scene.collection.objects.link(obj)
    obj.parent, obj.location = parent, position
    obj.rotation_euler.x = math.pi / 2
    obj.data.materials.append(mat)
    return obj


def ease(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)


def assemble(obj, start, end, origin, target, turn=(0, 0, 0), final_turn=(0, 0, 0), arc=(0, 0, 0), grow=False):
    start_pos, end_pos = Vector(origin), Vector(target)
    control = (start_pos + end_pos) / 2 + Vector(arc)
    for frame in range(1, 145):
        value = ease((frame - start) / (end - start))
        obj.location = (1 - value) ** 2 * start_pos + 2 * (1 - value) * value * control + value ** 2 * end_pos
        obj.rotation_euler = tuple(math.radians(a + (b - a) * value) for a, b in zip(turn, final_turn))
        if grow:
            scale = max(0.001, value)
            obj.scale = (scale, scale, scale)
            obj.keyframe_insert('scale', frame=frame)
        obj.keyframe_insert('location', frame=frame)
        obj.keyframe_insert('rotation_euler', frame=frame)


stage = empty('01 / landing plinth')
box('Floating pearl foundation', (0, 0, 0.13), (4.9, 2.5, 0.25), pearl, stage, 0.17)
box('Thin platinum reveal', (0, 0, 0.01), (4.67, 2.27, 0.09), silver, stage, 0.12)
box('Soft white working surface', (0, 0, 0.266), (4.66, 2.28, 0.035), white, stage, 0.1)
assemble(stage, 1, 40, (0.1, 0.5, -0.35), (0, 0, 0), (0, 0, -27), arc=(0.2, -0.3, 0.2))

main = empty('02 / primary interface lands', (-0.83, 0.56, 1.53))
box('Main panel / platinum rear shell', (0, 0.025, 0), (2.58, 0.16, 2.27), silver, main, 0.09)
box('Main panel / porcelain face', (0, -0.06, 0), (2.48, 0.085, 2.18), pearl, main, 0.075)
box('Main panel / header', (0, -0.113, 0.79), (2.26, 0.035, 0.38), white, main, 0.055)
for index, mat in enumerate((blue, silver, mist)):
    sphere('Window chrome pin', (-0.98 + index * 0.105, -0.145, 0.9), 0.021, mat, main)
label('FORMA', (-0.57, -0.141, 0.735), 0.145, main)
label('IDEA  /  01', (0.49, -0.142, 0.76), 0.065, main)
box('Left navigation inset', (-0.85, -0.112, -0.23), (0.52, 0.033, 1.57), white, main, 0.05)
for index in range(5):
    box('Navigation row', (-0.84, -0.14, 0.35 - index * 0.245), (0.30, 0.018, 0.039), blue if index == 1 else mist, main, 0.012)
assemble(main, 10, 59, (-2.25, 0.9, 1.15), (-0.83, 0.56, 1.53), (30, -20, 78), (0, 0, -3), arc=(-0.35, -1.45, 0.6))

graph = empty('03 / chart cassette clicks in', parent=main)
box('Analytics cassette', (0, 0, 0), (1.58, 0.12, 0.85), white, graph, 0.055)
label('IDEAS IN MOTION', (-0.65, -0.066, 0.23), 0.073, graph)
for index, height in enumerate((0.13, 0.2, 0.29, 0.26, 0.39, 0.48)):
    box('Extruded chart column', (-0.58 + index * 0.22, -0.085, -0.30 + height / 2), (0.13, 0.055, height), blue if index > 3 else ice, graph, 0.026)
assemble(graph, 50, 88, (0.85, -1.0, 0.98), (0.32, -0.185, 0.17), (35, -35, -72), arc=(0.5, -0.3, 0.3))

for index, (width, mat) in enumerate(((0.75, blue), (0.66, white))):
    module = empty(f'04.{index} / metric card', parent=main)
    box('Metric card porcelain', (0, 0, 0), (width, 0.1, 0.52), mat, module, 0.05)
    label('12' if index == 0 else '08', (-width / 2 + 0.11, -0.059, -0.045), 0.24, module, white if index == 0 else slate)
    box('Metric card label', (0.07, -0.063, -0.17), (0.3, 0.015, 0.025), ice if index == 0 else mist, module, 0.01)
    x = -0.09 if index == 0 else 0.73
    assemble(module, 65 + index * 8, 99 + index * 7, (x - 0.8, -1.0, -0.7), (x, -0.19, -0.64), (15, 95 - index * 20, 45), arc=(-0.4, -0.15, 0.4))

hinge = empty('05 / swing leaf hinge', (0.49, 0.59, 0.47))
for z in (0.3, 1.76):
    box('Platinum hinge knuckle', (0, 0.04, z), (0.14, 0.19, 0.27), silver, hinge, 0.06)
leaf = empty('06 / folded secondary page', parent=hinge)
box('Secondary page thick shell', (0.76, 0, 1.02), (1.5, 0.13, 2.02), pearl, leaf, 0.08)
box('Secondary page blue inset', (0.76, -0.077, 1.02), (1.35, 0.045, 1.86), ice, leaf, 0.055)
label('MAKE IT REAL', (0.21, -0.105, 1.71), 0.09, leaf)
for index, w in enumerate((0.90, 0.63, 0.8)):
    box('Secondary page text rule', (0.22 + w / 2, -0.113, 1.51 - index * 0.13), (w, 0.023, 0.028), white, leaf, 0.011)
for index in range(2):
    box('Secondary page component tile', (0.45 + index * 0.61, -0.118, 0.82), (0.48, 0.07, 0.45), white if index == 0 else blue, leaf, 0.045)
box('Secondary page action', (0.59, -0.125, 0.36), (0.8, 0.07, 0.22), white, leaf, 0.065)
assemble(hinge, 26, 69, (1.70, 1.3, 0.64), (0.49, 0.59, 0.47), (0, -24, 50), arc=(0.5, 0, 0.7))
assemble(leaf, 49, 90, (0, 0, 0), (0, 0, 0), (0, 0, 112), (0, 0, -17))

for index, mat in enumerate((slate, ice, blue)):
    chip = empty(f'07.{index} / palette tile docks')
    box('Palette tile platinum edge', (0, 0, 0), (0.43, 0.44, 0.105), silver, chip, 0.055)
    box('Palette tile coloured face', (0, 0, 0.064), (0.37, 0.38, 0.035), mat, chip, 0.05)
    assemble(chip, 54 + index * 9, 92 + index * 7, (2.4 - index * 0.3, -0.5, 1.5 + index * 0.22), (-1.49 + index * 0.49, -0.72, 0.39), (50, -85, 75 + index * 20), arc=(0.5, -0.7, 0.5))

dial = empty('08 / precision dial settles')
bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=12, major_radius=0.235, minor_radius=0.07)
ring = bpy.context.object
ring.name, ring.parent = 'Polished platinum focus dial', dial
ring.data.materials.append(silver)
bpy.ops.object.shade_smooth()
sphere('Ice dial lens', (0, 0, 0), 0.12, blue, dial)
assemble(dial, 39, 89, (-2.55, -0.6, 1.35), (-1.94, -0.69, 0.42), (80, 55, -90), arc=(-0.2, -0.5, 0.65))

button = empty('09 / foreground action plate')
box('Action dock porcelain', (0, 0, 0), (1.12, 0.48, 0.12), pearl, button, 0.1)
box('Action dock blue surface', (0, 0, 0.075), (1.0, 0.37, 0.045), blue, button, 0.08)
for x in (-0.06, 0.06):
    box('Action glyph', (x, 0, 0.103), (0.04, 0.15, 0.015), white, button, 0.009)
assemble(button, 73, 109, (1.65, -1.1, 1.3), (0.43, -0.80, 0.385), (15, 110, 35), arc=(0.4, -0.6, 0.6))

route_points = [(-1.78, -0.15, 0.296), (-1.30, -0.33, 0.296), (-0.55, -0.33, 0.296), (0.1, -0.45, 0.296), (0.75, -0.34, 0.296), (1.45, -0.22, 0.296), (1.95, 0.15, 0.296)]
tube('Inlaid circuit track', route_points, 0.013, mist, stage)
route = tube('10 / light reveals connected workflow', route_points, 0.019, glow, stage)
for frame in range(1, 145):
    value = ease((frame - 96) / 29)
    route.data.bevel_factor_end = max(0.0001, value)
    route.data.keyframe_insert('bevel_factor_end', frame=frame)
for index, location in enumerate(route_points[::2]):
    node = sphere(f'11.{index} / workflow node confirmation', location, 0.052, blue, stage)
    for frame in range(1, 145):
        value = ease((frame - (98 + index * 7)) / 6)
        pulse = math.sin(math.pi * max(0, min(1, (frame - 100 - index * 6) / 8))) * 0.45
        node.scale = (max(0.001, value * (1 + pulse)),) * 3
        node.keyframe_insert('scale', frame=frame)

bead = sphere('12 / travelling cyan light', route_points[0], 0.043, glow, stage)
for frame in range(1, 145):
    value = ease((frame - 96) / 29)
    distance = value * (len(route_points) - 1)
    segment = min(len(route_points) - 2, int(distance))
    blend = distance - segment
    bead.location = Vector(route_points[segment]).lerp(Vector(route_points[segment + 1]), blend)
    bead.location.z += 0.03
    bead.scale = (1 if 96 <= frame < 128 else 0.001,) * 3
    bead.keyframe_insert('location', frame=frame)
    bead.keyframe_insert('scale', frame=frame)

# A feathered alpha contact patch keeps the transparent stage grounded on any hero surface.
shadow = bpy.data.materials.new('Grounded feathered contact shadow')
shadow.use_nodes = True
nodes, links = shadow.node_tree.nodes, shadow.node_tree.links
nodes.clear()
uv = nodes.new('ShaderNodeTexCoord')
offset = nodes.new('ShaderNodeVectorMath'); offset.operation = 'SUBTRACT'; offset.inputs[1].default_value = (0.5, 0.5, 0)
length = nodes.new('ShaderNodeVectorMath'); length.operation = 'LENGTH'
falloff = nodes.new('ShaderNodeMapRange'); falloff.inputs['From Min'].default_value = 0.1; falloff.inputs['From Max'].default_value = 0.5; falloff.inputs['To Min'].default_value = 0.32; falloff.inputs['To Max'].default_value = 0
dark = nodes.new('ShaderNodeEmission'); dark.inputs['Color'].default_value = (0.025, 0.05, 0.085, 1)
clear = nodes.new('ShaderNodeBsdfTransparent')
mix = nodes.new('ShaderNodeMixShader')
output = nodes.new('ShaderNodeOutputMaterial')
links.new(uv.outputs['UV'], offset.inputs[0]); links.new(offset.outputs[0], length.inputs[0]); links.new(length.outputs['Value'], falloff.inputs['Value'])
links.new(falloff.outputs['Result'], mix.inputs[0]); links.new(clear.outputs[0], mix.inputs[1]); links.new(dark.outputs[0], mix.inputs[2]); links.new(mix.outputs[0], output.inputs['Surface'])
shadow.surface_render_method = 'BLENDED'
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -0.08))
patch = bpy.context.object
patch.name, patch.scale = 'Soft ground contact', (6.1, 3.5, 1)
patch.data.materials.append(shadow)

camera_data = bpy.data.cameras.new('Fixed three-quarter product camera')
camera = bpy.data.objects.new(camera_data.name, camera_data)
scene.collection.objects.link(camera)
camera.location = (5.1, -10.5, 6.9)
camera.rotation_euler = (Vector((0, 0, 1.12)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 7.15
scene.camera = camera
for name, position, power, size, color in (
    ('Large warm softbox', (-3, -4, 8), 1150, 5, (1, 0.95, 0.89)),
    ('Cool edge ribbon', (5, 2, 6), 1250, 3.0, (0.60, 0.82, 1)),
    ('Frontal bounce', (0, -6, 3), 450, 4, (0.84, 0.92, 1)),
):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size, data.color = power, 'DISK', size, color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((0, 0, 1)) - obj.location).to_track_quat('-Z', 'Y').to_euler()

scene.frame_set(144)
anchor = world_to_camera_view(scene, camera, Vector((1.15, -0.50, 0.30)))
head = world_to_camera_view(scene, camera, Vector((1.15, -0.50, 2.60)))
metadata = {'duration': 6, 'fps': 24, 'frames': 144, 'rinOverlay': {'feetX': round(anchor.x, 4), 'feetY': round(1-anchor.y, 4), 'height': round(head.y-anchor.y, 4), 'origin': 'bottom center', 'note': 'Normalized coordinates in uncropped 3:2 video; original IP rendered by DOM only.'}}
(DOC / 'scene-layout.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
scene.render.image_settings.media_type = 'IMAGE'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
if args.mode == 'preview':
    temp = Path(tempfile.mkdtemp(prefix='rin-home-v5-'))
    previews = []
    for frame in (1, 48, 88, 144):
        scene.frame_set(frame)
        scene.render.filepath = str(temp / f'key-{frame:03}.png')
        bpy.ops.render.render(write_still=True)
        previews.append(str(scene.render.filepath))
    (DOC / 'preview-source.json').write_text(json.dumps({'directory': str(temp), 'frames': previews}, indent=2), encoding='utf-8')
else:
    scene.render.filepath = str(OUT / 'home-idea-foundry-poster.png')
    if args.mode == 'render':
        bpy.ops.render.render(write_still=True)
    scene.render.image_settings.media_type = 'VIDEO'
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'WEBM'
    scene.render.ffmpeg.codec = 'WEBM'
    scene.render.ffmpeg.audio_codec = 'NONE'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = str(OUT / 'home-idea-foundry.webm')
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(DOC / 'home-idea-foundry.blend'))
    if args.mode == 'render':
        bpy.ops.render.render(animation=True)
print('HOME_IDEA_FOUNDRY_COMPLETE', json.dumps(metadata))
