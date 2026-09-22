import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


parser = argparse.ArgumentParser()
parser.add_argument('--preview', action='store_true')
parser.add_argument('--poster-only', action='store_true')
parser.add_argument('--save-only', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
ROOT = Path(__file__).resolve().parents[3]
DOC = Path(__file__).resolve().parent
OUT = ROOT / 'public/brand/rin/v5/motion'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.eevee.taa_render_samples = 20 if args.preview else 40
scene.render.resolution_x, scene.render.resolution_y = (600, 400) if args.preview else (900, 600)
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 144
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.world.use_nodes = True
world_background = next(node for node in scene.world.node_tree.nodes if node.type == 'BACKGROUND')
world_background.inputs['Color'].default_value = (0.80, 0.87, 1.0, 1)
world_background.inputs['Strength'].default_value = 0.38


def material(name, color, roughness=0.3, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Coat Weight'].default_value = 0.24
    return mat


ink = material('Anodised ink aluminium', (0.016, 0.029, 0.047), 0.23, 0.55)
pearl = material('Warm pearl laminated edge', (0.77, 0.83, 0.88), 0.25, 0.28)
blue = material('Ice blue enamel accent', (0.003, 0.32, 0.82), 0.21, 0.30)
chrome = material('Brushed platinum hinge', (0.50, 0.62, 0.72), 0.22, 0.80)
base_mat = material('Ceramic presentation tray', (0.88, 0.93, 0.97), 0.28, 0.10)


def group(name, position=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = position
    return obj


def cube(name, position, size, mat, parent=None, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent, obj.location = parent, position
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('Crafted edge radius', 'BEVEL')
        modifier.width, modifier.segments = bevel, 4
        obj.modifiers.new('Weighted edge normals', 'WEIGHTED_NORMAL')
    return obj


def pin(name, position, radius, depth, mat, parent):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=depth)
    obj = bpy.context.object
    obj.name, obj.parent, obj.location = name, parent, position
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Machined cylinder rims', 'BEVEL')
    bevel.width, bevel.segments = 0.009, 3
    obj.modifiers.new('Pin normals', 'WEIGHTED_NORMAL')
    return obj


def artwork(path, name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    image = nodes.new('ShaderNodeTexImage')
    image.image = bpy.data.images.load(str(path))
    image.image.pack()
    # Printed artwork stays legible under the gallery softboxes; board edges retain physical shading.
    shader = nodes.new('ShaderNodeEmission')
    shader.inputs['Strength'].default_value = 0.92
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(image.outputs['Color'], shader.inputs['Color'])
    links.new(shader.outputs[0], output.inputs['Surface'])
    return mat


def face(name, parent, y, rotation, mat):
    bpy.ops.mesh.primitive_plane_add(size=1)
    obj = bpy.context.object
    obj.name, obj.parent = name, parent
    obj.location = (0, y, 0)
    obj.rotation_euler = (math.pi / 2, 0, rotation)
    obj.scale = (2.245, 1.497, 1)
    obj.data.materials.append(mat)
    return obj


def pose(obj, frame, location=None, rotation=None, scale=None):
    if location is not None:
        obj.location = location
        obj.keyframe_insert('location', frame=frame)
    if rotation is not None:
        obj.rotation_euler = tuple(math.radians(value) for value in rotation)
        obj.keyframe_insert('rotation_euler', frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert('scale', frame=frame)


width, height = 2.32, 1.57
cards = []
for i in range(6):
    initial = (-width / 2, i * 0.17 - 0.32, 2.60)
    col, row = i % 3, i // 3
    destination = ((col - 1) * 2.56 - width / 2, [0.08, -0.03, 0.10][col] + row * 0.06, 3.43 if row == 0 else 1.55)
    carrier = group(f'Atlas {i + 1:02} magnetic carrier', initial)
    hinge = group(f'Atlas {i + 1:02} vertical spine hinge', parent=carrier)
    leaf = group(f'Atlas {i + 1:02} reversible leaf', (width / 2, 0, 0), hinge)
    edge_mat = [ink, pearl, blue][i % 3]
    cube(f'Atlas {i + 1:02} solid laminated board', (0, 0, 0), (width, 0.105, height), edge_mat, leaf, 0.042)
    cube(f'Atlas {i + 1:02} paper core', (0, 0, 0), (width - 0.014, 0.045, height - 0.014), pearl, leaf, 0.035)
    face(f'Atlas {i + 1:02} numbered cover', leaf, -0.056, 0, artwork(DOC / 'textures' / f'cover-{i + 1:02}.png', f'Original numbered cover {i + 1:02}'))
    face(f'Atlas {i + 1:02} designed template reverse', leaf, 0.056, math.pi, artwork(DOC / 'textures' / f'layout-{i + 1:02}.png', f'Designed template {i + 1:02}'))
    for side in (-1, 1):
        pin(f'Atlas {i + 1:02} spine knuckle {side}', (-width / 2 + 0.018, 0, side * 0.54), 0.051, 0.23, chrome, leaf)
        cube(f'Atlas {i + 1:02} corner inlay {side}', (side * (width / 2 - 0.11), -0.059, height / 2 - 0.012), (0.115, 0.018, 0.018), blue, leaf, 0.005)
    angle = [-73, -44, -15, 15, 44, 73][i]
    pose(carrier, 1, location=initial)
    pose(carrier, 82 + i * 3, location=initial)
    pose(carrier, 109 + i * 3, location=(destination[0], destination[1] - 0.055, destination[2]))
    pose(carrier, 115 + i * 3, location=destination)
    pose(carrier, 144, location=destination)
    pose(hinge, 1, rotation=(0, 0, 0))
    pose(hinge, 14 + i * 2, rotation=(0, 0, 0))
    pose(hinge, 42 + i * 2, rotation=(0, 0, angle))
    pose(hinge, 82 + i * 3, rotation=(0, 0, angle))
    pose(hinge, 109 + i * 3, rotation=(0, 0, -2 if i % 2 else 2))
    pose(hinge, 115 + i * 3, rotation=(0, 0, 0))
    pose(hinge, 144, rotation=(0, 0, 0))
    flip_start = 52 + i * 4
    pose(leaf, 1, rotation=(0, 0, 0))
    pose(leaf, flip_start, rotation=(0, 0, 0))
    pose(leaf, flip_start + 18, rotation=(0, 0, 187))
    pose(leaf, flip_start + 24, rotation=(0, 0, 180))
    pose(leaf, 144, rotation=(0, 0, 180))
    cards.append(carrier)

tray = cube('Atlas exhibition ceramic base', (0, 0.5, 0.14), (8.18, 1.60, 0.22), base_mat, bevel=0.10)
cube('Presentation tray ink underside', (0, 0.50, 0.055), (7.90, 1.40, 0.08), ink, bevel=0.035)
cube('Presentation tray blue front signature', (-3.40, -0.321, 0.165), (0.58, 0.018, 0.025), blue, bevel=0.01)
spine = group('Closed book spine stand')
cube('Spine upright', (-1.2, 0.15, 1.24), (0.085, 0.14, 2.00), chrome, spine, 0.025)
cube('Spine top magnetic cap', (-1.2, 0.15, 2.22), (0.18, 0.20, 0.1), blue, spine, 0.025)
pose(spine, 1, scale=(1, 1, 1))
pose(spine, 84, scale=(1, 1, 1))
pose(spine, 103, scale=(1, 1, 0.001))
for index, z in enumerate((1.55, 3.43)):
    rail = group(f'Exhibition rail {index}')
    cube(f'Magnetic horizontal rail {index}', (0, 0.44, z), (7.48, 0.085, 0.060), chrome, rail, 0.025)
    for x in (-3.40, 3.40):
        cube(f'Rail vertical stanchion {index} {x}', (x, 0.55, z / 2 + 0.16), (0.045, 0.055, z - 0.12), chrome, rail, 0.017)
    pose(rail, 1, scale=(0.001, 1, 0.001))
    pose(rail, 78, scale=(0.001, 1, 0.001))
    pose(rail, 109, scale=(1, 1, 1))
    pose(rail, 144, scale=(1, 1, 1))


def contact_shadow():
    mat = bpy.data.materials.new('Transparent soft exhibition contact shadow')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    coordinates = nodes.new('ShaderNodeTexCoord')
    centered = nodes.new('ShaderNodeVectorMath')
    centered.operation = 'SUBTRACT'
    centered.inputs[1].default_value = (0.5, 0.5, 0)
    distance = nodes.new('ShaderNodeVectorMath')
    distance.operation = 'LENGTH'
    falloff = nodes.new('ShaderNodeMath')
    falloff.operation = 'MULTIPLY_ADD'
    falloff.inputs[1].default_value, falloff.inputs[2].default_value = -2, 1
    falloff.use_clamp = True
    power = nodes.new('ShaderNodeMath')
    power.operation = 'POWER'
    power.inputs[1].default_value = 2
    opacity = nodes.new('ShaderNodeMath')
    opacity.operation = 'MULTIPLY'
    opacity.inputs[1].default_value = 0.28
    clear = nodes.new('ShaderNodeBsdfTransparent')
    shade = nodes.new('ShaderNodeEmission')
    shade.inputs['Color'].default_value = (0.017, 0.030, 0.047, 1)
    mix = nodes.new('ShaderNodeMixShader')
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(coordinates.outputs['UV'], centered.inputs[0])
    links.new(centered.outputs[0], distance.inputs[0])
    links.new(distance.outputs['Value'], falloff.inputs[0])
    links.new(falloff.outputs[0], power.inputs[0])
    links.new(power.outputs[0], opacity.inputs[0])
    links.new(opacity.outputs[0], mix.inputs[0])
    links.new(clear.outputs[0], mix.inputs[1])
    links.new(shade.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])
    mat.surface_render_method = 'BLENDED'
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.12, 0.57, 0.007))
    shadow = bpy.context.object
    shadow.name, shadow.scale = 'Grounding shadow, alpha falloff', (9.5, 2.7, 1)
    shadow.data.materials.append(mat)


contact_shadow()
camera_data = bpy.data.cameras.new('Atlas exhibition camera')
camera = bpy.data.objects.new('Atlas exhibition camera', camera_data)
scene.collection.objects.link(camera)
camera.location = (7.8, -17.5, 8.6)
camera.rotation_euler = (Vector((0, 0.2, 2.2)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 10.0
scene.camera = camera
for name, position, energy, size in (
    ('Large pearl key', (-4, -6, 10), 1050, 7),
    ('Cool gallery edge', (5, 2, 8), 900, 6),
    ('Front print fill', (0, -8, 5), 650, 5),
):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((0, 0, 2.2)) - obj.location).to_track_quat('-Z', 'Y').to_euler()

for obj in scene.objects:
    if obj.animation_data and obj.animation_data.action:
        for layer in obj.animation_data.action.layers:
            for strip in layer.strips:
                for channelbag in strip.channelbags:
                    for fcurve in channelbag.fcurves:
                        for key in fcurve.keyframe_points:
                            key.interpolation = 'BEZIER'
                            key.handle_left_type = key.handle_right_type = 'AUTO_CLAMPED'

scene.frame_set(140)
scene.render.image_settings.media_type = 'IMAGE'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
bpy.context.preferences.filepaths.save_version = 0
if not args.preview:
    bpy.ops.wm.save_as_mainfile(filepath=str(DOC / 'atlas-scene.blend'))
if args.save_only:
    print('ATLAS_SCENE_SAVED')
elif args.preview:
    for frame in (1, 46, 77, 140):
        scene.frame_set(frame)
        scene.render.filepath = str(DOC / f'atlas-keyframe-{frame:03}.png')
        bpy.ops.render.render(write_still=True)
    print('ATLAS_KEYFRAMES_COMPLETE')
else:
    scene.frame_set(140)
    scene.render.filepath = str(OUT / 'atlas-poster.png')
    bpy.ops.render.render(write_still=True)
    if not args.poster_only:
        scene.render.image_settings.media_type = 'VIDEO'
        scene.render.image_settings.file_format = 'FFMPEG'
        scene.render.ffmpeg.format = 'WEBM'
        scene.render.ffmpeg.codec = 'WEBM'
        scene.render.ffmpeg.audio_codec = 'NONE'
        scene.render.ffmpeg.constant_rate_factor = 'HIGH'
        scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
        scene.render.image_settings.color_mode = 'RGBA'
        scene.render.filepath = str(OUT / 'atlas-unfold.webm')
        bpy.ops.render.render(animation=True)
    print('ATLAS_RENDER_COMPLETE')
