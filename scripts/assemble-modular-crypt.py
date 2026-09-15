"""Snap unique modular floor+wall tiles into a gapless 5x5 crypt (SI metres)."""
import bpy
import os

TILE = 2.0
ROOT = r"C:\Users\nugye\Documents\gameopen\artifacts\animator\public\models\packs\modular-dungeon"
OUT = os.path.join(ROOT, "assembled-crypt.glb")
FLOOR = os.path.join(ROOT, "floor-001.glb")
WALL = os.path.join(ROOT, "brick-wall.glb")
DOOR = os.path.join(ROOT, "brick-wall-with-door.glb")


def wipe():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_one(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    return new[0] if new else None


def origin_zero(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj.location = (0, 0, 0)


wipe()
proto_floor = import_one(FLOOR)
proto_wall = import_one(WALL)
proto_door = import_one(DOOR) if os.path.exists(DOOR) else proto_wall
for p in (proto_floor, proto_wall, proto_door):
    if p:
        origin_zero(p)

n = 5
# floors
for x in range(n):
    for z in range(n):
        o = proto_floor.copy()
        o.data = proto_floor.data
        bpy.context.collection.objects.link(o)
        o.location = ((x - n / 2) * TILE + TILE / 2, 0, (z - n / 2) * TILE + TILE / 2)

# walls around (Y-up in blender after gltf? glTF is Y-up, blender import often +Z up)
# blender glTF importer uses +Z up. location.z is height? Default glTF: Y up converted to Z up.
# After origin_set, floors sit on z=0 in blender.
# Place walls on edges: x sides and y sides in blender XY plane.
# Use blender Z as height: floors at z=0, walls at z=0 standing.

def wall_at(x, y, yaw):
    src = proto_door if (abs(x) < 0.1 and y < 0) else proto_wall
    o = src.copy()
    o.data = src.data
    bpy.context.collection.objects.link(o)
    o.location = (x, y, 0)
    o.rotation_euler[2] = yaw


half = n * TILE / 2
for i in range(n):
    t = (i - n / 2) * TILE + TILE / 2
    wall_at(t, -half, 0)
    wall_at(t, half, 3.14159)
    wall_at(-half, t, 1.5708)
    wall_at(half, t, -1.5708)

# hide prototypes
for p in (proto_floor, proto_wall, proto_door):
    if p:
        p.hide_render = True
        p.hide_viewport = True
        p.select_set(False)

bpy.ops.object.select_all(action="DESELECT")
for o in bpy.data.objects:
    if o.type == "MESH" and not o.hide_viewport:
        o.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_animations=False,
)
print("WROTE", OUT)
