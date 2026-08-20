"""Re-export modular dungeon props at natural SI height (not 2 m tile)."""
import bpy
import os
import re
from mathutils import Vector

SRC = r"D:\Games\Models\free_modular_low_poly_dungeon_pack (1).glb"
OUT = r"C:\Users\nugye\Documents\gameopen\artifacts\animator\public\models\packs\modular-dungeon"
SKIP_RE = re.compile(r"Sketchfab|RootNode|\.fbx|\.obj|gles|materialmerger|cleaner", re.I)
WANT = {"barrel", "candle", "torch", "chest bottom", "chest top"}
TARGET_H = {
    "barrel": 0.9,
    "candle": 0.35,
    "torch": 0.7,
    "chest bottom": 0.55,
    "chest top": 0.35,
}


def slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()
    return re.sub(r"-+", "-", s)[:64] or "piece"


def wipe():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
        for b in list(block):
            block.remove(b)


def aabb(objs):
    xs, ys, zs = [], [], []
    for o in objs:
        for v in o.bound_box:
            w = o.matrix_world @ Vector(v)
            xs.append(w.x)
            ys.append(w.y)
            zs.append(w.z)
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def stem_name(name: str) -> str:
    n = re.sub(r"_[A-Za-z0-9 ]+_0$", "", name or "piece")
    return re.sub(r"\.\d{3,}$", "", n)


wipe()
bpy.ops.import_scene.gltf(filepath=SRC)
groups = {}
for o in bpy.data.objects:
    if o.type != "MESH" or not o.data or not o.data.polygons:
        continue
    if SKIP_RE.search(o.name):
        continue
    p = o.parent
    key = p.name if p and not SKIP_RE.search(p.name) else stem_name(o.name)
    groups.setdefault(key, []).append(o)

for key, objs in groups.items():
    if key not in WANT:
        continue
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    bpy.context.view_layer.update()
    mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = aabb(objs)
    cx = (mn_x + mx_x) * 0.5
    cy = (mn_y + mx_y) * 0.5
    cz = (mn_z + mx_z) * 0.5
    for o in objs:
        o.location.x -= cx
        o.location.y -= cy
        o.location.z -= cz
    bpy.context.view_layer.update()
    mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = aabb(objs)
    w = max(mx_x - mn_x, mx_y - mn_y, 1e-4)
    h = max(mx_z - mn_z, 1e-4)
    if max(w, h) > 40:
        for o in objs:
            o.scale *= 0.01
        bpy.context.view_layer.update()
        mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = aabb(objs)
        w = max(mx_x - mn_x, mx_y - mn_y, 1e-4)
        h = max(mx_z - mn_z, 1e-4)
    s = TARGET_H[key] / h
    for o in objs:
        o.scale *= s
    bpy.context.view_layer.update()
    mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = aabb(objs)
    for o in objs:
        o.location.z -= mn_z
    path = os.path.join(OUT, slug(key) + ".glb")
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
        if o.parent:
            o.parent.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_skins=False,
    )
    mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = aabb(objs)
    print(
        f"  {os.path.basename(path)} xz={max(mx_x-mn_x, mx_y-mn_y):.2f} h={mx_z-mn_z:.2f}",
        flush=True,
    )
print("DONE props")
