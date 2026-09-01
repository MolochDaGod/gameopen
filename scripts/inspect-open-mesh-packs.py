"""Dump mesh/node tables for Open pack ingest. No explode-export."""
import bpy
import json
import os
import re

OUT = r"C:\Users\nugye\Documents\gameopen\artifacts\animator\public\models\packs"
SKIP_RE = re.compile(r"Sketchfab|RootNode|\.fbx|\.obj|gles|materialmerger|cleaner", re.I)

PACKS = [
    (r"D:\Games\Models\minecraft_world_npc_village.glb", "npc-village"),
    (r"D:\Games\Models\free_modular_low_poly_dungeon_pack (1).glb", "modular-dungeon"),
    (r"D:\Games\Models\stylised_planks_materials.glb", "stylised-planks"),
    (r"D:\Games\Models\grave_stone_collection.glb", "graves"),
    (r"D:\Games\Models\dungeon_essential_kit.glb", "dungeon-essential"),
]


def wipe():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
        for b in list(block):
            block.remove(b)


def world_aabb(obj):
    from mathutils import Vector
    xs, ys, zs = [], [], []
    for v in obj.bound_box:
        w = obj.matrix_world @ Vector(v)
        xs.append(w.x)
        ys.append(w.y)
        zs.append(w.z)
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def inspect(src, pack):
    wipe()
    bpy.ops.import_scene.gltf(filepath=src)
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.data and o.data.polygons]
    nodes = list(bpy.data.objects)
    rows = []
    stems = {}
    for o in meshes:
        if SKIP_RE.search(o.name):
            continue
        mats = [m.name for m in o.data.materials if m]
        mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = world_aabb(o)
        w = max(mx_x - mn_x, mx_z - mn_z)
        h = mx_y - mn_y
        parent = o.parent.name if o.parent else None
        rows.append(
            {
                "name": o.name,
                "parent": parent,
                "verts": len(o.data.vertices),
                "polys": len(o.data.polygons),
                "materials": mats,
                "xz": round(w, 3),
                "y": round(h, 3),
            }
        )
        stem = re.sub(r"\.\d{3,}$", "", o.name)
        stem = re.sub(r"_[A-Za-z ]+_0$", "", stem)
        stems.setdefault(stem, []).append(o.name)
    return {
        "pack": pack,
        "source": os.path.basename(src),
        "bytes": os.path.getsize(src),
        "meshCount": len(meshes),
        "nodeCount": len(nodes),
        "uniqueStems": sorted(stems.keys()),
        "stemCount": len(stems),
        "images": [img.name for img in bpy.data.images],
        "meshes": rows[:80],
        "meshNames": [r["name"] for r in rows],
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    report = []
    for src, pack in PACKS:
        print("INSPECT", pack, flush=True)
        info = inspect(src, pack)
        print(
            f"  meshes={info['meshCount']} stems={info['stemCount']} images={len(info['images'])}",
            flush=True,
        )
        report.append(info)
        dest = os.path.join(OUT, pack)
        os.makedirs(dest, exist_ok=True)
        with open(os.path.join(dest, "inspect.json"), "w", encoding="utf-8") as f:
            json.dump(info, f, indent=2)
    with open(os.path.join(OUT, "inspect-all.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print("WROTE inspect-all.json", flush=True)


if __name__ == "__main__":
    main()
