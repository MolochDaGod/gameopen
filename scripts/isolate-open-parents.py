"""
Isolate Open packs by PARENT group (all material children), SI scale, feet on ground.
Does NOT explode dungeon_essential_kit (113 MB textures).
"""
import bpy
import os
import json
import re
from mathutils import Vector

OUT = r"C:\Users\nugye\Documents\gameopen\artifacts\animator\public\models\packs"
SKIP_RE = re.compile(r"Sketchfab|RootNode|\.fbx|\.obj|gles|materialmerger|cleaner", re.I)
TILE = 2.0


def slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()
    s = re.sub(r"-+", "-", s)
    return s[:64] or "piece"


def stem_name(name: str) -> str:
    n = name or "piece"
    n = re.sub(r"_[A-Za-z0-9 ]+_0$", "", n)
    n = re.sub(r"\.\d{3,}$", "", n)
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


def world_aabb(obj):
    xs, ys, zs = [], [], []
    for v in obj.bound_box:
        w = obj.matrix_world @ Vector(v)
        xs.append(w.x)
        ys.append(w.y)
        zs.append(w.z)
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def group_aabb(objs):
    xs, ys, zs = [], [], []
    for o in objs:
        mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = world_aabb(o)
        xs += [mn_x, mx_x]
        ys += [mn_y, mx_y]
        zs += [mn_z, mx_z]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def mesh_objects():
    return [o for o in bpy.data.objects if o.type == "MESH" and o.data and o.data.polygons]


def collect_groups():
    """Parent name → mesh children. Skip merger roots; unparented meshes are their own group."""
    groups = {}
    for o in mesh_objects():
        if SKIP_RE.search(o.name):
            continue
        p = o.parent
        key = None
        if p and not SKIP_RE.search(p.name):
            key = p.name
        else:
            key = stem_name(o.name)
        groups.setdefault(key, []).append(o)
    return groups


def origin_zero_group(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    bpy.context.view_layer.update()
    mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = group_aabb(objs)
    cx = (mn_x + mx_x) * 0.5
    cy = (mn_y + mx_y) * 0.5
    cz = (mn_z + mx_z) * 0.5
    for o in objs:
        o.location.x -= cx
        o.location.y -= cy
        o.location.z -= cz
    bpy.context.view_layer.update()


def plan_wh(mn_x, mx_x, mn_y, mx_y, mn_z, mx_z):
    """Blender after glTF import is Z-up: plan = XY, height = Z."""
    w = max(mx_x - mn_x, mx_y - mn_y, 1e-4)
    h = mx_z - mn_z
    return w, h


def scale_group(objs, mode: str):
    """mode: tile (2m plan), grave (~1.4m H), plank (1m cube)."""
    bpy.context.view_layer.update()
    box = group_aabb(objs)
    w, h = plan_wh(*box)
    d = max(w, h, 1e-4)
    if d > 40:
        for o in objs:
            o.scale *= 0.01
        bpy.context.view_layer.update()
        box = group_aabb(objs)
        w, h = plan_wh(*box)
    if mode == "tile":
        s2 = TILE / w
        for o in objs:
            o.scale *= s2
    elif mode == "grave":
        s2 = 1.4 / max(h, 1e-4)
        for o in objs:
            o.scale *= s2
    elif mode == "plank":
        s2 = 1.0 / max(w, h, 1e-4)
        for o in objs:
            o.scale *= s2
    bpy.context.view_layer.update()
    mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = group_aabb(objs)
    for o in objs:
        o.location.z -= mn_z
    bpy.context.view_layer.update()
    mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = group_aabb(objs)
    w, h = plan_wh(mn_x, mx_x, mn_y, mx_y, mn_z, mx_z)
    return w, h


def export_group(objs, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    parents = set()
    for o in objs:
        o.select_set(True)
        if o.parent:
            o.parent.select_set(True)
            parents.add(o.parent)
    bpy.context.view_layer.objects.active = objs[0]
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


def isolate(src, folder, mode, cap=80, only=None):
    print("PACK", folder, flush=True)
    import_glb(src)
    groups = collect_groups()
    dest = os.path.join(OUT, folder)
    os.makedirs(dest, exist_ok=True)
    catalog = []
    i = 0
    for key, objs in groups.items():
        if only and key not in only and slug(key) not in only:
            continue
        if i >= cap:
            break
        sl = slug(key)
        path = os.path.join(dest, sl + ".glb")
        origin_zero_group(objs)
        w, h = scale_group(objs, mode)
        export_group(objs, path)
        catalog.append(
            {
                "id": sl,
                "name": key,
                "role": mode,
                "file": f"models/packs/{folder}/{sl}.glb",
                "isolateParent": key,
                "childMeshes": [o.name for o in objs],
                "approxXZ_m": round(w, 3),
                "approxY_m": round(h, 3),
                "snap_m": 2.0 if mode == "tile" else (1.0 if mode == "plank" else 0.5),
            }
        )
        i += 1
        print(f"  {sl}.glb  xz={w:.2f} h={h:.2f} children={len(objs)}", flush=True)
    with open(os.path.join(dest, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "pack": folder,
                "source": os.path.basename(src),
                "isolate": "parent-group",
                "si": "metres",
                "pieces": catalog,
            },
            f,
            indent=2,
        )
    return catalog


def assemble_crypt():
    """5x5 gapless crypt from 2m floor + wall tiles."""
    root = os.path.join(OUT, "modular-dungeon")
    floor_p = os.path.join(root, "floor-001.glb")
    if not os.path.exists(floor_p):
        floor_p = os.path.join(root, "floor.glb")
    wall_p = os.path.join(root, "brick-wall.glb")
    door_p = os.path.join(root, "brick-wall-with-door.glb")
    out = os.path.join(root, "assembled-crypt.glb")

    wipe()

    def take(path):
        if not os.path.exists(path):
            return []
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        return [o for o in bpy.data.objects if o not in before and o.type == "MESH"]

    floors = take(floor_p)
    walls = take(wall_p)
    doors = take(door_p) if os.path.exists(door_p) else walls
    if not floors or not walls:
        print("assemble skip — missing floor/wall", flush=True)
        return

    def proto_empty(name, meshes):
        e = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(e)
        for m in meshes:
            m.parent = e
        return e

    floor_e = proto_empty("_proto_floor", floors)
    wall_e = proto_empty("_proto_wall", walls)
    door_e = proto_empty("_proto_door", doors)

    n = 5
    instances = []
    for x in range(n):
        for z in range(n):
            e = floor_e.copy()
            bpy.context.collection.objects.link(e)
            for ch in floor_e.children:
                c = ch.copy()
                c.data = ch.data
                bpy.context.collection.objects.link(c)
                c.parent = e
            # Blender Z-up after glTF: plan XY, height Z
            e.location = ((x - n / 2) * TILE + TILE / 2, (z - n / 2) * TILE + TILE / 2, 0)
            instances.append(e)

    half = n * TILE / 2

    def wall_row(x, y, yaw, use_door=False):
        src = door_e if use_door else wall_e
        e = src.copy()
        bpy.context.collection.objects.link(e)
        for ch in src.children:
            c = ch.copy()
            c.data = ch.data
            bpy.context.collection.objects.link(c)
            c.parent = e
        e.location = (x, y, 0)
        e.rotation_euler[2] = yaw
        instances.append(e)

    for i in range(n):
        t = (i - n / 2) * TILE + TILE / 2
        wall_row(t, -half, 0, use_door=(i == n // 2))
        wall_row(t, half, 3.14159)
        wall_row(-half, t, 1.5708)
        wall_row(half, t, -1.5708)

    for p in (floor_e, wall_e, door_e):
        p.hide_viewport = True
        p.hide_render = True
        for ch in p.children:
            ch.hide_viewport = True
            ch.hide_render = True

    bpy.ops.object.select_all(action="DESELECT")
    for e in instances:
        e.select_set(True)
        for ch in e.children:
            ch.select_set(True)
            ch.hide_viewport = False
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
    )
    print("WROTE crypt", out, os.path.getsize(out), flush=True)


def write_essential_catalog():
    src = r"D:\Games\Models\dungeon_essential_kit.glb"
    print("CATALOG dungeon-essential (no explode)", flush=True)
    import_glb(src)
    groups = collect_groups()
    dest = os.path.join(OUT, "dungeon-essential")
    os.makedirs(dest, exist_ok=True)
    pieces = []
    for key, objs in groups.items():
        bpy.context.view_layer.update()
        mn_x, mx_x, mn_y, mx_y, mn_z, mx_z = group_aabb(objs)
        w, h = plan_wh(mn_x, mx_x, mn_y, mx_y, mn_z, mx_z)
        if max(w, h) > 40:
            w *= 0.01
            h *= 0.01
        pieces.append(
            {
                "id": slug(key),
                "name": key,
                "role": "tile",
                "file": None,
                "localSource": "D:/Games/Models/dungeon_essential_kit.glb",
                "isolateParent": key,
                "childMeshes": [o.name for o in objs],
                "approxXZ_m": round(w, 3),
                "approxY_m": round(h, 3),
                "snap_m": 2.0,
                "scaleHint": "author often cm — ×0.01 if AABB>40",
                "shipped": False,
                "reason": "113MB kit — isolateParent at bake time; do not copy into SPA",
            }
        )
    with open(os.path.join(dest, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "pack": "dungeon-essential",
                "source": "dungeon_essential_kit.glb",
                "isolate": "parent-group",
                "shipped": False,
                "pieces": pieces,
            },
            f,
            indent=2,
        )
    print("  stems", len(pieces), flush=True)
    return pieces


def copy_village_map():
    import shutil
    dest = os.path.join(OUT, "npc-village")
    os.makedirs(dest, exist_ok=True)
    src = r"D:\Games\Models\minecraft_world_npc_village.glb"
    dst = os.path.join(dest, "npc-village.glb")
    shutil.copy2(src, dst)
    inspect_path = os.path.join(dest, "inspect.json")
    layers = []
    if os.path.exists(inspect_path):
        with open(inspect_path, encoding="utf-8") as f:
            info = json.load(f)
        for m in info.get("meshes", []):
            mats = m.get("materials") or ["?"]
            layers.append(
                {
                    "id": slug(mats[0]),
                    "name": mats[0],
                    "isolateNode": m["name"],
                    "verts": m["verts"],
                    "xz": m["xz"],
                    "y": m["y"],
                    "note": "Mineways fused WORLD layer, not a 1m block",
                }
            )
    cat = {
        "pack": "npc-village",
        "source": "minecraft_world_npc_village.glb",
        "isolate": "block-type-layers",
        "file": "models/packs/npc-village/npc-village.glb",
        "role": "map",
        "snap_m": 1,
        "layers": layers,
        "note": "Not houses. 28 material layers (Oak_Planks = every oak plank in the village).",
    }
    with open(os.path.join(dest, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump(cat, f, indent=2)
    print("WROTE village map", os.path.getsize(dst), flush=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    all_rows = []
    rows = isolate(
        r"D:\Games\Models\free_modular_low_poly_dungeon_pack (1).glb",
        "modular-dungeon",
        "tile",
        cap=90,
    )
    all_rows.extend([{**r, "pack": "modular-dungeon"} for r in rows])
    assemble_crypt()
    rows = isolate(
        r"D:\Games\Models\grave_stone_collection.glb",
        "graves",
        "grave",
        cap=8,
    )
    all_rows.extend([{**r, "pack": "graves"} for r in rows])
    rows = isolate(
        r"D:\Games\Models\stylised_planks_materials.glb",
        "stylised-planks",
        "plank",
        cap=6,
    )
    all_rows.extend([{**r, "pack": "stylised-planks"} for r in rows])
    copy_village_map()
    ess = write_essential_catalog()
    all_rows.extend([{**r, "pack": "dungeon-essential"} for r in ess])
    with open(os.path.join(OUT, "open-mesh-packs.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "si": "metres",
                "isolate": "parent-group",
                "tile_m": TILE,
                "packs": all_rows,
            },
            f,
            indent=2,
        )
    print("DONE pieces", len(all_rows), flush=True)


if __name__ == "__main__":
    main()
