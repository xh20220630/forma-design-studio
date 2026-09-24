import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def arguments():
    """读取 Blender 分隔符后的脚本参数，避免将 Blender 自身参数当作素材选项。

    参数：
        无。

    返回：
        解析后的命令行选项。
    """
    argv = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--poster-only', action='store_true')
    parser.add_argument('--save-blend', action='store_true')
    return parser.parse_args(argv)


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'apps' / 'web' / 'public' / 'brand' / 'rin'
IMAGE = OUT / 'forma-rin-chibi-v1.png'
OUT.mkdir(parents=True, exist_ok=True)
args = arguments()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 400
scene.render.resolution_y = 240
scene.render.resolution_percentage = 100
scene.render.fps = 25
scene.frame_start = 1
scene.frame_end = 60
scene.world.color = (0.7, 0.7, 0.7)
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.render.film_transparent = False
scene.render.image_settings.color_mode = 'RGB'


def material(name, value, metallic=0, roughness=0.4):
    """创建带统一表面参数的 Blender 材质，确保同类模型使用一致的灯光响应。

    参数：
        name：场景对象、材质或素材的名称。
        value：当前待处理的颜色或进度值。
        metallic：材质的金属程度。
        roughness：表面粗糙度，越大反光越分散。

    返回：
        创建的材质对象。
    """
    result = bpy.data.materials.new(name)
    result.diffuse_color = (value, value, value, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (value, value, value, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return result


paper = material('Warmless white', 0.95, roughness=0.6)
ink = material('Graphite', 0.022, metallic=0.12, roughness=0.32)
silver = material('Brushed silver', 0.55, metallic=0.65, roughness=0.32)
muted = material('Pale graphite', 0.70, roughness=0.45)
sky = material('Sky detail', 0.70, metallic=0.12, roughness=0.4)
sky.diffuse_color = (0.0395, 0.5089, 0.9387, 1)
sky.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = sky.diffuse_color
glass = material('Smoked translucent glass', 0.63, roughness=0.19)
glass.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value = 0.65
glass.node_tree.nodes.get('Principled BSDF').inputs['IOR'].default_value = 1.45


def box(name, location, size, surface, bevel=0.04):
    """创建具有实际尺寸和圆角的盒形对象，应用缩放后再倒角以保持边缘一致。

    参数：
        name：场景对象、材质或素材的名称。
        location：对象在所属坐标系中的位置。
        size：对象尺寸或文字字号。
        surface：供对象使用的材质。
        bevel：边缘倒角的宽度。

    返回：
        创建的场景对象。
    """
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(surface)
    if bevel:
        modifier = obj.modifiers.new('Precision edge', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def label(text, location, size, surface):
    """创建文字标签并设置字体尺寸与材质，使场景说明采用一致的视觉风格。

    参数：
        text：需要绘制的文字。
        location：对象在所属坐标系中的位置。
        size：对象尺寸或文字字号。
        surface：供对象使用的材质。

    返回：
        创建的文字对象；二维绘图版本直接绘制到目标图像。
    """
    curve = bpy.data.curves.new(text, 'FONT')
    curve.body = text
    curve.size = size
    curve.space_character = 1.2
    curve.extrude = 0
    obj = bpy.data.objects.new(text, curve)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.data.materials.append(surface)
    return obj


def assemble(obj, offset, delay=0, twist=0):
    """在起止位置之间设置装配动画，使用平滑节奏减少突然跳动。

    参数：
        obj：需要记录动画的场景对象。
        offset：相对最终姿态的初始偏移。
        delay：动画开始前的延迟。
        twist：装配过程中的附加旋转幅度。

    返回：
        无返回值；结果写入当前画布、场景或输出文件。
    """
    origin = obj.location.copy()
    for frame, amount in (
        (1, 1),
        (8 + delay, 1),
        (22 + delay, 0),
        (37 + delay, 0),
        (58, 1),
        (60, 1),
    ):
        obj.location = origin + Vector(offset) * amount
        obj.rotation_euler.z = twist * amount
        obj.keyframe_insert(data_path='location', frame=frame)
        obj.keyframe_insert(data_path='rotation_euler', frame=frame)


box('Studio', (0, 0, -0.17), (200, 200, 0.2), paper, 0)
box('Portrait card', (-2.25, 0.1, 0), (2.55, 3.1, 0.1), paper, 0.08)
portrait = bpy.data.materials.new('Original Rin bitmap, unchanged color')
portrait.use_nodes = True
nodes = portrait.node_tree.nodes
nodes.clear()
texture = nodes.new('ShaderNodeTexImage')
texture.image = bpy.data.images.load(str(IMAGE))
texture.image.pack()
emission = nodes.new('ShaderNodeEmission')
output = nodes.new('ShaderNodeOutputMaterial')
portrait.node_tree.links.new(texture.outputs['Color'], emission.inputs['Color'])
portrait.node_tree.links.new(emission.outputs[0], output.inputs['Surface'])
bpy.ops.mesh.primitive_plane_add(size=2, location=(-2.25, 0.16, 0.058))
portrait_plane = bpy.context.object
portrait_plane.name = 'Rin original 2D portrait plane'
portrait_plane.scale = (1.19, 1.19, 1)
portrait_plane.data.materials.append(portrait)
label('RIN', (-3.26, -1.26, 0.061), 0.18, ink)
label('DESIGN ASSISTANT', (-2.54, -1.22, 0.061), 0.08, silver)
box('Hairclip marker', (-3.22, 1.37, 0.09), (0.17, 0.17, 0.055), ink, 0.014)
box('Hairclip marker inset', (-3.22, 1.37, 0.12), (0.075, 0.075, 0.014), sky, 0.008)

box('Design board', (1.23, 0.18, 0.01), (3.55, 2.9, 0.10), muted, 0.08)
box('Design board surface', (1.23, 0.18, 0.075), (3.46, 2.81, 0.045), paper, 0.05)
label('01 / A SINGLE SOURCE', (-0.37, 1.43, 0.12), 0.105, ink)
box('Header baseline', (1.23, 1.24, 0.12), (3.10, 0.012, 0.016), muted, 0.005)

parts = [
    ('Navigation', (-0.06, 0.10, 0.25), (0.55, 1.75, 0.12), ink, (-0.32, -0.15, 0.68), 0),
    ('Main component', (1.49, 0.56, 0.23), (2.18, 0.77, 0.10), silver, (0.20, 0.15, 0.83), 2),
    ('Content card A', (0.92, -0.34, 0.23), (1.04, 0.71, 0.10), glass, (-0.07, -0.28, 0.95), 4),
    ('Content card B', (2.07, -0.34, 0.23), (1.04, 0.71, 0.10), paper, (0.34, -0.28, 0.57), 6),
]
for name, position, dimensions, surface, offset, delay in parts:
    obj = box(name, position, dimensions, surface, 0.045)
    assemble(obj, offset, delay, 0.025 if delay % 4 else -0.025)
    if name == 'Navigation':
        for index in range(4):
            line = box(
                f'Navigation item {index}',
                (-0.06, 0.71 - index * 0.30, 0.317),
                (0.28, 0.025, 0.014),
                silver,
                0.005,
            )
            assemble(line, offset, delay)
    elif name == 'Main component':
        for index, width in enumerate((1.13, 0.72)):
            line = box(
                f'Component content {index}',
                (1.24 - (1.13 - width) / 2, 0.65 - index * 0.18, 0.289),
                (width, 0.045, 0.014),
                ink,
                0.006,
            )
            assemble(line, offset, delay)
    else:
        square = box(
            f'{name} token',
            (position[0] - 0.27, position[1] + 0.11, 0.296),
            (0.20, 0.20, 0.032),
            ink,
            0.025,
        )
        assemble(square, offset, delay)
        line = box(
            f'{name} label',
            (position[0], position[1] - 0.18, 0.291),
            (0.72, 0.025, 0.012),
            muted,
            0.005,
        )
        assemble(line, offset, delay)

for index, surface in enumerate((sky, silver, glass)):
    token = box(
        f'Token {index}', (-0.13 + index * 0.29, -1.01, 0.20), (0.19, 0.19, 0.16), surface, 0.022
    )
    assemble(token, (-0.16 + index * 0.08, -0.15, 0.42 + index * 0.10), index)
label('TOKEN   /   COMPONENT   /   UI', (0.80, -1.06, 0.135), 0.089, ink)

camera_data = bpy.data.cameras.new('Orthographic studio')
camera = bpy.data.objects.new('Orthographic studio', camera_data)
scene.collection.objects.link(camera)
camera.location = (0.2, -6.2, 10.5)
target = Vector((0, 0.15, 0.10))
camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 8.3
scene.camera = camera

for name, position, power, size in (
    ('Key softbox', (-3, -4, 8), 700, 7),
    ('Fill softbox', (5, 3, 6), 400, 5),
):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = power
    light.shape = 'DISK'
    light.size = size
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (-obj.location).to_track_quat('-Z', 'Y').to_euler()

scene.frame_set(32)
scene.render.image_settings.media_type = 'IMAGE'
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUT / 'rin-assembly-poster.png')
bpy.ops.render.render(write_still=True)
scene.render.image_settings.media_type = 'VIDEO'
scene.render.image_settings.file_format = 'FFMPEG'
scene.render.ffmpeg.format = 'WEBM'
scene.render.ffmpeg.codec = 'WEBM'
scene.render.ffmpeg.audio_codec = 'NONE'
scene.render.ffmpeg.constant_rate_factor = 'HIGH'
scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
scene.render.filepath = str(OUT / 'rin-assembly.webm')
if args.save_blend:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).with_name('rin-assembly.blend')))
if not args.poster_only:
    bpy.ops.render.render(animation=True)
print('RIN_MOTION_COMPLETE', scene.render.filepath)
