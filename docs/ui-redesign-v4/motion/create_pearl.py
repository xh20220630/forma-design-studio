import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--preview', action='store_true')
parser.add_argument('--poster-only', action='store_true')
parser.add_argument('--save-blend', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
ROOT = Path(__file__).resolve().parents[3]
DOC = ROOT / 'docs' / 'ui-redesign-v4' / 'motion'
OUT = ROOT / 'public' / 'brand' / 'rin' / 'v4' / 'motion'
SOURCE = ROOT / 'public' / 'brand' / 'rin' / 'v4' / 'rin-full-body.png'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.eevee.taa_render_samples = 16 if args.preview else 32
scene.render.resolution_x, scene.render.resolution_y = (360, 240) if args.preview else (720, 480)
scene.render.resolution_percentage = 100
scene.render.fps = 20
scene.frame_start, scene.frame_end = 1, 80
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.82, 0.90, 1, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7


def surface(name, rgb, roughness=0.25, metallic=0.0, opacity=1):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Coat Weight'].default_value = 0.5
    if opacity < 1:
        transparent = nodes.new('ShaderNodeBsdfTransparent')
        mix = nodes.new('ShaderNodeMixShader')
        mix.inputs[0].default_value = opacity
        links.new(transparent.outputs[0], mix.inputs[1])
        links.new(shader.outputs[0], mix.inputs[2])
        links.new(mix.outputs[0], nodes.get('Material Output').inputs['Surface'])
        mat.surface_render_method = 'BLENDED'
    return mat


pearl = surface('Pearl acrylic edges', (0.82, 0.90, 1), 0.2, 0.15, 0.78)
glass = surface('Optical acrylic', (0.68, 0.83, 1), 0.12, 0.1, 0.16)
blue_glass = surface('Ice blue acrylic edge', (0.18, 0.56, 0.92), 0.12, 0.2, 0.44)
sky = surface('Rin original ice blue', (0.0395, 0.5089, 0.9387), 0.23, 0.08)
soft_ink = surface('Quiet slate detail', (0.15, 0.23, 0.34), 0.5, 0, 0.7)
white = surface('Pearl highlight', (1, 1, 1), 0.16, 0.1, 0.85)


def group(name, position=(0, 0, 0), angles=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = tuple(math.radians(angle) for angle in angles)
    return obj


def box(name, location, dimensions, mat, parent=None, bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('Polished acrylic radius', 'BEVEL')
        modifier.width, modifier.segments = bevel, 3
        obj.modifiers.new('Edge normals', 'WEIGHTED_NORMAL')
    return obj


def text(body, location, size, parent, material=soft_ink):
    data = bpy.data.curves.new(body, 'FONT')
    data.body, data.size = body, size
    data.space_character = 1.2
    obj = bpy.data.objects.new(body, data)
    scene.collection.objects.link(obj)
    obj.parent, obj.location = parent, location
    obj.rotation_euler.x = math.pi / 2
    obj.data.materials.append(material)
    return obj


def corner(parent, x, z, sx, sz):
    root = group('Ice blue selection corner')
    root.parent = parent
    root.location = (x, -0.052, z)
    box('Corner horizontal', (-sx * 0.064, 0, 0), (0.15, 0.016, 0.027), sky, root, 0.007)
    box('Corner vertical', (0, 0, -sz * 0.064), (0.027, 0.016, 0.15), sky, root, 0.007)
    rest = root.location.copy()
    for frame in (1, 15, 25, 49, 63, 81):
        phase = (frame - 1) / 80 * math.tau
        amount = (1 - math.cos(phase)) * 0.018
        root.location = rest + Vector((sx * amount, 0, sz * amount))
        root.keyframe_insert('location', frame=frame)
    return root


def panel(name, position, width, height, rotation, phase):
    root = group(name, position, rotation)
    box(name + ' clear face', (0, 0, 0), (width, 0.045, height), glass, root, 0.045)
    for xsign in (-1, 1):
        box(name + ' polished edge', (xsign * width / 2, 0, 0), (0.022, 0.06, height - 0.025), blue_glass, root, 0.009)
    for zsign in (-1, 1):
        box(name + ' pearl edge', (0, 0, zsign * height / 2), (width - 0.02, 0.06, 0.018), white, root, 0.008)
    for sx in (-1, 1):
        for sz in (-1, 1):
            corner(root, sx * (width / 2 - 0.055), sz * (height / 2 - 0.055), sx, sz)
    origin, rotation = root.location.copy(), root.rotation_euler.copy()
    for frame in range(1, 82, 10):
        angle = (frame - 1) / 80 * math.tau
        root.location = origin + Vector((0, 0, math.sin(angle + phase) * 0.025))
        root.rotation_euler = rotation
        root.rotation_euler.z += math.sin(angle + phase) * math.radians(0.7)
        root.keyframe_insert('location', frame=frame)
        root.keyframe_insert('rotation_euler', frame=frame)
    return root


left = panel('Layout acrylic pane', (-1.35, 0.38, 1.62), 1.5, 2.36, (0, -7, -8), 0)
right = panel('Component acrylic pane', (1.32, 0.24, 1.52), 1.45, 2.1, (0, 6, 8), math.pi)
text('LAYOUT', (-0.50, -0.04, 0.61), 0.095, left)
for index, width in enumerate((0.77, 0.56, 0.67)):
    box('Layout specification rule', (-0.50 + width / 2, -0.046, 0.36 - index * 0.16), (width, 0.008, 0.014), pearl, left, 0.003)
box('Layout content tile', (-0.28, -0.065, -0.38), (0.39, 0.032, 0.45), pearl, left, 0.025)
box('Layout linked tile', (0.23, -0.065, -0.38), (0.39, 0.032, 0.45), blue_glass, left, 0.025)
text('FORMA', (-0.48, -0.04, 0.53), 0.13, right)
for index, width in enumerate((0.77, 0.49)):
    box('Component label rule', (-0.48 + width / 2, -0.048, 0.24 - index * 0.17), (width, 0.009, 0.017), pearl, right, 0.003)
box('Component primary action', (-0.24, -0.06, -0.38), (0.46, 0.035, 0.16), blue_glass, right, 0.025)

portrait = bpy.data.materials.new('Original Rin RGBA identity - unaltered RGB')
portrait.use_nodes = True
nodes, links = portrait.node_tree.nodes, portrait.node_tree.links
nodes.clear()
texture = nodes.new('ShaderNodeTexImage')
texture.image = bpy.data.images.load(str(SOURCE))
texture.image.pack()
emission = nodes.new('ShaderNodeEmission')
transparent = nodes.new('ShaderNodeBsdfTransparent')
mix = nodes.new('ShaderNodeMixShader')
output = nodes.new('ShaderNodeOutputMaterial')
links.new(texture.outputs['Color'], emission.inputs['Color'])
links.new(texture.outputs['Alpha'], mix.inputs[0])
links.new(transparent.outputs[0], mix.inputs[1])
links.new(emission.outputs[0], mix.inputs[2])
links.new(mix.outputs[0], output.inputs['Surface'])
portrait.surface_render_method = 'BLENDED'
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.37, 1.60), rotation=(math.pi / 2, 0, 0))
rin = bpy.context.object
rin.name = 'Original silver-haired blue-eyed Rin, fixed pose'
rin.scale = (1.91, 3.16, 1)
rin.data.materials.append(portrait)

for name, location, dimensions in (
    ('Left acrylic pedestal', (-1.67, -0.06, 0.37), (0.53, 0.51, 0.72)),
    ('Left small glass block', (-1.20, -0.52, 0.18), (0.46, 0.45, 0.34)),
    ('Right glass prism', (1.82, 0.26, 0.29), (0.43, 0.49, 0.56)),
):
    block = box(name, location, dimensions, glass, bevel=0.035)
    for xsign in (-1, 1):
        box(name + ' highlight', (location[0] + xsign * dimensions[0] / 2, location[1] - dimensions[1] / 2, location[2]), (0.012, 0.012, dimensions[2] - 0.04), white, bevel=0.005)

bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.28, location=(1.35, -0.48, 0.3))
sphere = bpy.context.object
sphere.name = 'Optical glass sphere'
sphere.data.materials.append(glass)
bpy.ops.object.shade_smooth()

shadow = bpy.data.materials.new('Soft contact shadow')
shadow.use_nodes = True
nodes, links = shadow.node_tree.nodes, shadow.node_tree.links
nodes.clear()
uv = nodes.new('ShaderNodeTexCoord')
center = nodes.new('ShaderNodeVectorMath')
center.operation = 'SUBTRACT'
center.inputs[1].default_value = (0.5, 0.5, 0)
length = nodes.new('ShaderNodeVectorMath')
length.operation = 'LENGTH'
falloff = nodes.new('ShaderNodeMath')
falloff.operation = 'MULTIPLY_ADD'
falloff.inputs[1].default_value = -2
falloff.inputs[2].default_value = 1
falloff.use_clamp = True
soften = nodes.new('ShaderNodeMath')
soften.operation = 'POWER'
soften.inputs[1].default_value = 2
opacity = nodes.new('ShaderNodeMath')
opacity.operation = 'MULTIPLY'
opacity.inputs[1].default_value = 0.16
shade = nodes.new('ShaderNodeEmission')
shade.inputs['Color'].default_value = (0.035, 0.055, 0.09, 1)
clear = nodes.new('ShaderNodeBsdfTransparent')
blend = nodes.new('ShaderNodeMixShader')
output = nodes.new('ShaderNodeOutputMaterial')
links.new(uv.outputs['UV'], center.inputs[0])
links.new(center.outputs[0], length.inputs[0])
links.new(length.outputs['Value'], falloff.inputs[0])
links.new(falloff.outputs[0], soften.inputs[0])
links.new(soften.outputs[0], opacity.inputs[0])
links.new(opacity.outputs[0], blend.inputs[0])
links.new(clear.outputs[0], blend.inputs[1])
links.new(shade.outputs[0], blend.inputs[2])
links.new(blend.outputs[0], output.inputs['Surface'])
shadow.surface_render_method = 'BLENDED'
for name, position, size in (
    ('Rin ground contact', (0, -0.34, 0.012), (1.45, 0.78, 1)),
    ('Left pedestal contact', (-1.5, -0.02, 0.006), (1.1, 0.92, 1)),
    ('Right glass contact', (1.48, -0.2, 0.009), (1.16, 0.94, 1)),
):
    bpy.ops.mesh.primitive_plane_add(size=1, location=position)
    contact = bpy.context.object
    contact.name, contact.scale = name, size
    contact.data.materials.append(shadow)

camera_data = bpy.data.cameras.new('Pearl Studio orthographic')
camera = bpy.data.objects.new('Pearl Studio orthographic', camera_data)
scene.collection.objects.link(camera)
camera.location = (0, -12, 4.4)
camera.rotation_euler = (Vector((0, 0, 1.6)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 5.6
scene.camera = camera
for name, position, power, size in (
    ('Pearl softbox', (-3, -5, 7), 650, 5),
    ('Ice rim', (4, 1, 6), 450, 4),
    ('Face fill', (0, -7, 3), 150, 3),
):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = power, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((0, 0, 1.5)) - obj.location).to_track_quat('-Z', 'Y').to_euler()

scene.frame_set(1)
scene.render.image_settings.media_type = 'IMAGE'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = str(DOC / 'rin-pearl-preview.png' if args.preview else OUT / 'rin-pearl-poster.png')
bpy.ops.render.render(write_still=True)
if not args.poster_only and not args.preview:
    scene.render.image_settings.media_type = 'VIDEO'
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'WEBM'
    scene.render.ffmpeg.codec = 'WEBM'
    scene.render.ffmpeg.audio_codec = 'NONE'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = str(OUT / 'rin-pearl-loop.webm')
if args.save_blend:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(DOC / 'rin-pearl.blend'))
if not args.poster_only and not args.preview:
    bpy.ops.render.render(animation=True)
print('RIN_PEARL_COMPLETE', scene.render.filepath)

