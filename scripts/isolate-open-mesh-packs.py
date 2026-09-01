"""
Isolate Sketchfab multipacks into unique SI pieces for Open.
Does not treat a pack as one fused play mesh.
"""
import bpy
import os
import json
import math
import re

OUT = r"C:\Users\nugye\Documents\gameopen\artifacts\animator\public\models\packs"
SKIP_RE = re.compile(
    r"Sketchfab|RootNode|\.fbx|\.obj|gles|materialmerger|cleaner", re.I
)


def slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()
    s = re.sub(r"-+", "-", s)
    return s[:64] or "piece"


def stem(name: str) -> str:
    n = name or "piece"
    n = re.sub(r"\.\d{3,}$", "", n)
    n = re.sub(r"_[A-Za-z ]+_0$", "", n)
    return n


def wipe():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
        for b in list(block):
            block.remove(b)


def import_glb(path: str):
    wipe()
    bpy.ops.import_scene.gltf(filepath=path)


def mesh_objects():
    return [o for o in bpy.data.objects if o.type == "MESH" and o.data and o.data.polygons]


def world_aabb(obj):
    xs, ys, zs = [], [], []
    for v in obj.bound_box:
        w = obj.matrix_world @ __import__("mathutils").Vector(v)
        xs.append(w.x)
        ys.append(w.y)
        zs.append(w.z)
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def origin_to_geometry(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj.location = (0, 0, 0)


def export_obj(obj, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_skins=False,
        export_cameras=False,
        export_lights=False,
    )


def unique_by_stem(objs, prefer_parent=True):
    picked = {}
    for o in objs:
        if SKIP_RE.search(o.name):
            continue
        key = stem(o.name)
        if key not in picked:
            picked[key] = o
    return picked


def scale_so_max_xz(obj, target=2.0):
    mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = world_aabb(obj)
    w = max(mx_x - mn_x, mx_z - mn_z, 1e-4)
    h = mx_y - mn_y
    if w > 40:
        s = 0.01
        obj.scale *= s
        bpy.context.view_layer.update()
        mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = world_aabb(obj)
        w = max(mx_x - mn_x, mx_z - mn_z, 1e-4)
        h = mx_y - mn_y
    if 0.2 < w < 8:
        return w, h
    s = target / w
    obj.scale *= s
    bpy.context.view_layer.update()
    mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = world_aabb(obj)
    return max(mx_x - mn_x, mx_z - mn_z), mx_y - mn_y


def plant_feet(obj):
    bpy.context.view_layer.update()
    mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = world_aabb(obj)
    obj.location.y -= mn_y
    bpy.context.view_layer.update()


def isolate_pack(src, folder, role, extra_rename=None, max_pieces=80):
    import_glb(src)
    objs = mesh_objects()
    picked = unique_by_stem(objs)
    dest = os.path.join(OUT, folder)
    os.makedirs(dest, exist_ok=True)
    catalog = []
    i = 0
    for key, obj in list(picked.items()):
        if i >= max_pieces:
            break
        name = extra_rename(obj) if extra_rename else key
        sl = slug(name)
        path = os.path.join(dest, sl + ".glb")
        origin_to_geometry(obj)
        w, h = scale_so_max_xz(obj, 2.0 if role != "plank" else 1.0)
        plant_feet(obj)
        export_obj(obj, path)
        catalog.append(
            {
                "id": sl,
                "name": name,
                "role": role,
                "file": f"models/packs/{folder}/{sl}.glb",
                "isolateNode": obj.name,
                "approxXZ_m": round(w, 3),
                "approxY_m": round(h, 3),
                "snap_m": 1.0 if role in ("floor", "tile", "wall") else 0.5,
            }
        )
        i += 1
        print(f"  wrote {sl}.glb  xz={w:.2f} h={h:.2f}")
    cat_path = os.path.join(dest, "catalog.json")
    with open(cat_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "pack": folder,
                "source": os.path.basename(src),
                "isolate": "unique-stems",
                "pieces": catalog,
            },
            f,
            indent=2,
        )
    return catalog


def village_rename(obj):
    mats = obj.data.materials
    if mats and mats[0] and mats[0].name:
        return mats[0].name
    return obj.name


def main():
    os.makedirs(OUT, exist_ok=True)
    packs = [
        (
            r"D:\Games\Models\free_modular_low_poly_dungeon_pack (1).glb",
            "modular-dungeon",
            "tile",
            None,
            70,
        ),
        # dungeon_essential_kit.glb is 113 MB — do NOT explode into public/
        # Catalog only: scripts/isolate-open-parents.py write_essential_catalog()
        (
            r"D:\Games\Models\grave_stone_collection.glb",
            "graves",
            "prop",
            None,
            8,
        ),
        (
            r"D:\Games\Models\stylised_planks_materials.glb",
            "stylised-planks",
            "plank",
            None,
            6,
        ),
        (
            r"D:\Games\Models\minecraft_world_npc_village.glb",
            "npc-village-blocks",
            "block",
            village_rename,
            30,
        ),
    ]
    all_rows = []
    for src, folder, role, rename, cap in packs:
        print("PACK", folder)
        rows = isolate_pack(src, folder, role, rename, cap)
        all_rows.extend([{**r, "pack": folder} for r in rows])
    master = os.path.join(OUT, "open-mesh-packs.json")
    with open(master, "w", encoding="utf-8") as f:
        json.dump({"packs": all_rows, "si": "metres", "isolate": True}, f, indent=2)
    print("DONE", len(all_rows), "pieces")


if __name__ == "__main__":
    main()
