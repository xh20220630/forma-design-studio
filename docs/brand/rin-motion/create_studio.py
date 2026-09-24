import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--poster-only', action='store_true')
parser.add_argument('--save-blend', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else [])
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'apps' / 'web' / 'public' / 'brand' / 'rin'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 720, 480
scene.render.resolution_percentage = 100
scene.render.fps = 25
scene.frame_start, scene.frame_end = 1, 125
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.65
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.render.film_transparent = False
scene.render.image_settings.color_mode = 'RGB'


def material(name, color, metallic=0, roughness=0.4):
    """创建带统一表面参数的 Blender 材质，确保同类模型使用一致的灯光响应。

    参数：
        name：场景对象、材质或素材的名称。
        color：使用的颜色通道值。
        metallic：材质的金属程度。
        roughness：表面粗糙度，越大反光越分散。

    返回：
        创建的材质对象。
    """
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return result


white = material('Porcelain white', (0.93, 0.93, 0.93), roughness=0.43)
floor = material('Pure white cyclorama', (1, 1, 1), roughness=0.7)
floor_nodes = floor.node_tree.nodes
floor_nodes.clear()
floor_emission = floor_nodes.new('ShaderNodeEmission')
floor_emission.inputs['Color'].default_value = (1, 1, 1, 1)
floor_output = floor_nodes.new('ShaderNodeOutputMaterial')
floor.node_tree.links.new(floor_emission.outputs[0], floor_output.inputs['Surface'])
ink = material('Anodized graphite', (0.012, 0.016, 0.021), 0.25, 0.34)
silver = material('Brushed platinum', (0.5, 0.54, 0.58), 0.65, 0.3)
muted = material('Cool gray', (0.7, 0.73, 0.75), 0.1, 0.55)
line = material('Construction hairline', (0.68, 0.7, 0.72), roughness=0.6)
sky = material('Sky 38bdf8', (0.0395, 0.5089, 0.9387), 0.12, 0.3)
pale = material('Ice glass', (0.68, 0.85, 0.95), 0.15, 0.22)
glass = material('Smoked optical glass', (0.58, 0.63, 0.68), 0.3, 0.15)
glass.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value = 0.25
glass.node_tree.nodes.get('Principled BSDF').inputs['IOR'].default_value = 1.45
typeface = bpy.data.materials.new('Graphite typography')
typeface.use_nodes = True
type_nodes = typeface.node_tree.nodes
type_nodes.clear()
type_emission = type_nodes.new('ShaderNodeEmission')
type_emission.inputs['Color'].default_value = (0.055, 0.065, 0.075, 1)
type_output = type_nodes.new('ShaderNodeOutputMaterial')
typeface.node_tree.links.new(type_emission.outputs[0], type_output.inputs['Surface'])


def box(name, position, size, surface, bevel=0.04, parent=None):
    """创建具有实际尺寸和圆角的盒形对象，应用缩放后再倒角以保持边缘一致。

    参数：
        name：场景对象、材质或素材的名称。
        position：对象在所属坐标系中的位置。
        size：对象尺寸或文字字号。
        surface：供对象使用的材质。
        bevel：边缘倒角的宽度。
        parent：父级对象；未指定时不挂到其他对象下。

    返回：
        创建的场景对象。
    """
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent = parent
    obj.location = position
    obj.data.materials.append(surface)
    if bevel:
        mod = obj.modifiers.new('Machined edge', 'BEVEL')
        mod.width, mod.segments = bevel, 4
        obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def group(name, position=(0, 0, 0), rotation=(0, 0, 0), parent=None):
    """创建空物体作为一组模型的父级，便于整体移动和制作动画。

    参数：
        name：场景对象、材质或素材的名称。
        position：对象在所属坐标系中的位置。
        rotation：对象的旋转参数。
        parent：父级对象；未指定时不挂到其他对象下。

    返回：
        作为分组根节点的空物体。
    """
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = position
    obj.rotation_euler = tuple(math.radians(value) for value in rotation)
    return obj


def label(body, position, size, surface, parent=None, align='LEFT'):
    """创建文字标签并设置字体尺寸与材质，使场景说明采用一致的视觉风格。

    参数：
        body：需要绘制的文字。
        position：对象在所属坐标系中的位置。
        size：对象尺寸或文字字号。
        surface：供对象使用的材质。
        parent：父级对象；未指定时不挂到其他对象下。
        align：文字的水平对齐方式。

    返回：
        创建的文字对象；二维绘图版本直接绘制到目标图像。
    """
    curve = bpy.data.curves.new(body, 'FONT')
    curve.body, curve.size, curve.align_x = body, size, align
    curve.space_character = 1.05
    obj = bpy.data.objects.new(body, curve)
    scene.collection.objects.link(obj)
    obj.parent, obj.location = parent, position
    obj.data.materials.append(surface if surface == white else typeface)
    return obj


def stroke(name, points, surface, radius=0.007, parent=None):
    """沿给定点创建有厚度的曲线，避免细线在渲染时消失。

    参数：
        name：场景对象、材质或素材的名称。
        points：组成曲线的有序坐标点。
        surface：供对象使用的材质。
        radius：几何半径或矩形圆角大小。
        parent：父级对象；未指定时不挂到其他对象下。

    返回：
        创建的曲线对象。
    """
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth, curve.bevel_resolution = radius, 3
    path = curve.splines.new('POLY')
    path.points.add(len(points) - 1)
    for point, coordinate in zip(path.points, points):
        point.co = (*coordinate, 1)
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(surface)
    return obj


def image_plane(name, path, position, size, parent):
    """把图片放到场景中的平面上，让设计截图能够参与整体展示。

    参数：
        name：场景对象、材质或素材的名称。
        path：输入图片的文件路径。
        position：对象在所属坐标系中的位置。
        size：对象尺寸或文字字号。
        parent：父级对象；未指定时不挂到其他对象下。

    返回：
        创建的图片平面。
    """
    surface = bpy.data.materials.new(name)
    surface.use_nodes = True
    nodes = surface.node_tree.nodes
    nodes.clear()
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(path))
    tex.image.pack()
    emission, output = nodes.new('ShaderNodeEmission'), nodes.new('ShaderNodeOutputMaterial')
    surface.node_tree.links.new(tex.outputs['Color'], emission.inputs['Color'])
    surface.node_tree.links.new(emission.outputs[0], output.inputs['Surface'])
    bpy.ops.mesh.primitive_plane_add(size=1)
    obj = bpy.context.object
    obj.name, obj.parent, obj.location = name, parent, position
    obj.scale = (*size, 1)
    obj.data.materials.append(surface)
    return obj


def assembly(obj, offset, start, end, twist=0):
    """记录从散开位置到最终位置的关键帧，让零件按顺序完成组装。

    参数：
        obj：需要记录动画的场景对象。
        offset：相对最终姿态的初始偏移。
        start：帧区间或字节区间的起点。
        end：帧区间或字节区间的终点。
        twist：装配过程中的附加旋转幅度。

    返回：
        无返回值；结果写入当前画布、场景或输出文件。
    """
    rest = obj.location.copy()
    rotation = obj.rotation_euler.copy()
    for frame, amount in ((1, 1), (start, 1), (end, 0), (105, 0), (123, 1), (125, 1)):
        obj.location = rest + Vector(offset) * amount
        obj.rotation_euler = rotation
        obj.rotation_euler.z += twist * amount
        obj.keyframe_insert(data_path='location', frame=frame)
        obj.keyframe_insert(data_path='rotation_euler', frame=frame)


def panel(name, position, width, height, rotation=(65, 0, 0)):
    """构造带外框、页面内容与装饰的展示面板，使多个面板保持一致结构。

    参数：
        name：场景对象、材质或素材的名称。
        position：对象在所属坐标系中的位置。
        width：面板或图形宽度。
        height：面板或图形高度。
        rotation：对象的旋转参数。

    返回：
        创建的面板根对象。
    """
    root = group(name, position, rotation)
    box(
        name + ' metal edge',
        (0, 0, -0.065),
        (width + 0.035, height + 0.035, 0.10),
        silver,
        0.08,
        root,
    )
    box(name + ' face', (0, 0, 0), (width, height, 0.055), white, 0.065, root)
    return root


def corner_marks(parent, width, height, surface=sky):
    """在面板四角补充定位标记，让边界在展示中容易辨认。

    参数：
        parent：父级对象；未指定时不挂到其他对象下。
        width：面板或图形宽度。
        height：面板或图形高度。
        surface：供对象使用的材质。

    返回：
        无返回值；结果写入当前画布、场景或输出文件。
    """
    for xsign in (-1, 1):
        for ysign in (-1, 1):
            x, y = xsign * width / 2, ysign * height / 2
            stroke(
                'Selection corner',
                [(x - xsign * 0.14, y, 0.09), (x, y, 0.09), (x, y - ysign * 0.14, 0.09)],
                surface,
                0.012,
                parent,
            )


box('White studio floor', (0, 0, -0.16), (200, 200, 0.2), floor, 0)

rin = panel('RIN central identity', (-0.15, 0.14, 2.03), 2.53, 3.22, (66, 0, -3))
image_plane(
    'Original colored Rin portrait',
    OUT / 'forma-rin-chibi-v1.png',
    (0, 0.03, 0.041),
    (2.42, 2.42),
    rin,
)
label('RIN', (-1.04, 1.32, 0.058), 0.16, ink, rin)
label('DESIGN PARTNER', (1.04, 1.35, 0.058), 0.071, silver, rin, 'RIGHT')
box('Signature square clip', (0.91, -1.32, 0.10), (0.27, 0.27, 0.11), ink, 0.018, rin)
box('Signature sky inset', (0.95, -1.27, 0.162), (0.12, 0.12, 0.019), sky, 0.012, rin)
label('DESIGNED TO BELONG.', (-1.02, -1.30, 0.057), 0.089, ink, rin)
label('ONE LANGUAGE. EVERY SURFACE.', (-1.02, -1.45, 0.057), 0.057, silver, rin)

tokens = panel('01 tokens', (-2.85, 0.28, 2.93), 1.88, 1.46, (72, -7, 7))
label('01', (-0.76, 0.51, 0.06), 0.13, silver, tokens)
label('TOKENS', (-0.38, 0.51, 0.06), 0.11, ink, tokens)
for i, surface in enumerate((ink, sky, glass, white)):
    token = box(
        'Semantic color token ' + str(i),
        (-0.61 + i * 0.40, 0.02, 0.16),
        (0.29, 0.39, 0.20),
        surface,
        0.045,
        tokens,
    )
    assembly(token, (0, 0.17, 0.38 + i * 0.1), 5 + i * 3, 22 + i * 3, (i - 1.5) * 0.04)
label('COLOR / RADIUS / TYPE', (-0.76, -0.47, 0.06), 0.065, silver, tokens)
stroke('Token guide', [(-0.78, -0.25, 0.06), (0.78, -0.25, 0.06)], line, 0.004, tokens)

components = panel('02 component foundation', (-2.48, -0.75, 1.12), 2.21, 1.5, (64, 0, -9))
label('02', (-0.91, 0.53, 0.06), 0.13, silver, components)
label('COMPONENTS', (-0.53, 0.53, 0.06), 0.11, ink, components)
layer = group('Component floating layer', (0, -0.06, 0.13), parent=components)
box('Component inner tile', (0, 0, 0), (1.84, 0.77, 0.08), white, 0.065, layer)
box('Reusable action', (0.30, -0.05, 0.085), (0.94, 0.36, 0.085), ink, 0.07, layer)
label('CONTINUE', (0.30, -0.077, 0.132), 0.071, white, layer, 'CENTER')
box('Instance square', (-0.60, 0.0, 0.11), (0.29, 0.29, 0.12), sky, 0.04, layer)
stroke(
    'Component relation',
    [(-0.61, -0.31, 0.06), (-0.61, -0.39, 0.06), (0.59, -0.39, 0.06)],
    line,
    0.008,
    layer,
)
assembly(layer, (-0.17, 0.15, 0.48), 35, 57, -0.06)
label('LINKED. REUSABLE. PRECISE.', (-0.90, -0.56, 0.06), 0.063, silver, components)

canvas = panel('03 canvas', (2.72, 0.18, 2.11), 2.95, 2.47, (60, 7, -7))
label('03', (-1.27, 1.03, 0.06), 0.13, silver, canvas)
label('CANVAS', (-0.89, 1.03, 0.06), 0.11, ink, canvas)
stroke('Canvas header rule', [(-1.26, 0.84, 0.06), (1.26, 0.84, 0.06)], line, 0.005, canvas)
ui = group('Responsive UI assembly', (0, -0.12, 0.1), parent=canvas)
box('App sidebar', (-0.96, 0, 0.055), (0.40, 1.55, 0.08), ink, 0.04, ui)
for i in range(4):
    box(
        'Sidebar item ' + str(i),
        (-0.96, 0.48 - i * 0.27, 0.103),
        (0.22, 0.028, 0.018),
        silver,
        0.007,
        ui,
    )
box('App identity square', (-0.96, 0.65, 0.116), (0.105, 0.105, 0.037), sky, 0.012, ui)
feature = group('Feature component', (0.37, 0.32, 0.06), parent=ui)
box('Feature surface', (0, 0, 0), (1.75, 0.87, 0.105), pale, 0.055, feature)
label('Your next idea.', (-0.66, 0.13, 0.066), 0.13, ink, feature)
box('Feature text rule', (-0.26, -0.05, 0.066), (0.80, 0.025, 0.015), silver, 0.004, feature)
box('Feature action', (-0.39, -0.24, 0.095), (0.55, 0.17, 0.064), ink, 0.022, feature)
assembly(feature, (0.23, 0.22, 0.57), 62, 83, 0.04)
for i in range(2):
    tile = group('Canvas linked card ' + str(i), (-0.07 + i * 0.91, -0.48, 0.06), parent=ui)
    box('UI content tile ' + str(i), (0, 0, 0), (0.84, 0.55, 0.07), white, 0.042, tile)
    box(
        'UI tile token ' + str(i),
        (-0.22, 0.09, 0.067),
        (0.18, 0.18, 0.064),
        silver if i else sky,
        0.025,
        tile,
    )
    box('UI tile rule ' + str(i), (0, -0.13, 0.049), (0.62, 0.021, 0.013), muted, 0.004, tile)
    assembly(tile, (0.08 * (i + 1), -0.09, 0.4 + i * 0.12), 67 + i * 3, 87 + i * 3)
corner_marks(ui, 2.50, 1.80)
label('EVERY INSTANCE, IN SYNC.', (-1.25, -1.06, 0.064), 0.069, silver, canvas)

stroke(
    'Upper connector', [(-1.86, 0.27, 2.81), (-1.67, 0.30, 2.80), (-1.57, 0.38, 2.66)], line, 0.008
)
stroke(
    'Lower connector', [(-1.55, -0.7, 1.05), (-1.40, -0.7, 1.05), (-1.29, -0.62, 1.18)], line, 0.008
)
stroke('Canvas connector', [(1.15, 0.15, 2.29), (1.38, 0.15, 2.29)], sky, 0.012)
for x, z in ((-1.65, 2.80), (-1.42, 1.08), (1.34, 2.29)):
    box(
        'Connector node',
        (x, 0.15 if x > 0 else 0.28 if z > 2 else -0.68, z),
        (0.065, 0.065, 0.065),
        sky,
        0.008,
    )

camera_data = bpy.data.cameras.new('Editorial orthographic')
camera = bpy.data.objects.new('Editorial orthographic', camera_data)
scene.collection.objects.link(camera)
camera.location = (0, -12, 7.7)
camera.rotation_euler = (Vector((0, 0, 1.85)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 9.15
scene.camera = camera
for name, position, power, size in (
    ('Large key', (-4, -6, 10), 420, 7),
    ('Soft rim', (5, 3, 9), 280, 6),
    ('Front bounce', (0, -6, 4), 80, 4),
):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.shape, light.size = power, 'DISK', size
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((0, 0, 1.5)) - obj.location).to_track_quat('-Z', 'Y').to_euler()

scene.frame_set(96)
scene.render.image_settings.media_type = 'IMAGE'
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUT / 'rin-studio-poster.png')
bpy.ops.render.render(write_still=True)
scene.render.image_settings.media_type = 'VIDEO'
scene.render.image_settings.file_format = 'FFMPEG'
scene.render.ffmpeg.format = 'WEBM'
scene.render.ffmpeg.codec = 'WEBM'
scene.render.ffmpeg.audio_codec = 'NONE'
scene.render.ffmpeg.constant_rate_factor = 'HIGH'
scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
scene.render.filepath = str(OUT / 'rin-studio-loop.webm')
if args.save_blend:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).with_name('rin-studio.blend')))
if not args.poster_only:
    bpy.ops.render.render(animation=True)
print('RIN_STUDIO_COMPLETE', scene.render.filepath)
