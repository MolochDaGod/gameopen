# The Voxel Store (itch.io) — asset review & production bake SSOT

**Source:** [https://the-voxel-store.itch.io/](https://the-voxel-store.itch.io/)  
**Scope:** Units (characters), props, environment — mesh / texture / animation / best file type for **game + D1 unit database**.  
**Fleet targets:** Open Danger Room, VoxGrudge, Mine-Loader Realms, unit registry on **assets.grudge-studio.com** + D1 `meshes` / `asset_registry`.

---

## 1. Catalog found (store shelf)

| Pack | Zip size (listed) | Unit / content focus |
|------|-------------------|----------------------|
| **Voxel Knights** | ~2.5 MB | Knights, archer, commander, horse, keep/walls, weapons |
| **Voxel Wizards** | ~1.4 MB | Wizard/witch/warlock, owl, tower, staff/wand/broom |
| **Voxel Rangers** | ~1.5 MB | Ranger variants, camp/tent/tower, bow + melee props |
| **Voxel Village** | (store) | Village / settlers (env + units) |
| **Voxel Farm** | (store) | Farm set |
| **Voxel Palace** | (store) | Palace / royal |
| **Voxel Cathedral** | (store) | Cathedral / religious env |

**Store claims (all packs):**

- Formats: **OBJ + FBX**
- Textures: **included**
- Characters: **rigged + pre-made animations**
- Style: **low-poly voxel / retro**
- Engines marketed: **Unity / Unreal**
- License (page text): use **with or without credit** (still keep a local LICENSE copy; NYOP packs require purchase/download on itch)

**Animations typically listed (units):** Idle, Walk, Jump, Defend, Slash / Aim Bow / Magic variants, mount/horse where relevant.

---

## 2. How these fit Grudge unit DB (vs grudge6)

| | **The Voxel Store** | **grudge6 / Toon RTS (fleet SSOT heroes)** |
|--|---------------------|-------------------------------------------|
| Role | **Secondary unit pack** — cute voxel NPCs, enemy waves, Vox/Mine eras, props | **Primary playable captains** — modular Bip001 kits |
| Rig | Likely **custom / humanoid** (Unity-oriented), **not** guaranteed Bip001 | **Bip001** + mesh_ids containers |
| Texture | Usually **per-model PNG atlas** or baked voxel colors | Race **webp atlas** rebind |
| Anim | Embedded FBX clips (short set) | Baked JSON packs + Mixamo retarget |
| Ship path | Bake → **GLB** on R2 under `models/voxel-store/…` | `models/grudge6/races/*` |

**Rule:** Do **not** replace grudge6 heroes with Voxel Store meshes for Warlords captains.  
**Do** register Voxel Store as **unit archetypes** (`kind: voxel_unit`) for Realms / Vox / crowd / TTS-style units.

---

## 3. Best practices — mesh

| Check | Best practice | Fail if |
|-------|---------------|---------|
| **One unit = one GLB** | Split multipack FBX so each character/prop is its own production file | One zip dump as one entity |
| **SI scale** | After import: height **~1.0–1.8 m** for humanoids (voxel style often short; pick a **yardstick**: e.g. knight = 1.5 m) | Random 100× / cm-as-m |
| **Origin** | Feet on y=0; XZ center on hips/body, not weapon tip | Floating / off-origin |
| **Art-forward** | Local **+Z** for fleet Controller | Sideways walk |
| **Topology** | Keep voxel faceted look; avoid over-smoothing | Unnecessary subdivision |
| **Collider** | Capsule for units; convex/box for props; write `.collider.json` | Full trimesh on every knight |
| **Naming** | Stable `mesh_id`: `vs_knights_champion`, `vs_wizards_warlock` | Spaces / random export names |
| **LOD** | Optional LOD1 only if poly spikes; these packs are already tiny | Over-LOD noise |

**Inspect after extract:**

```bash
# After purchase/download, unzip to e.g. raw/voxel-store/knights/
# Prefer FBX for units (rig+anim); OBJ only for static props if FBX missing
npm run convert -- inspect path/to/Champion.fbx
```

---

## 4. Best practices — texture

| Check | Best practice |
|-------|----------------|
| **Format (runtime)** | **WebP** or **PNG** on CDN; bake into GLB materials when possible |
| **Color space** | `SRGBColorSpace` for albedo; no double-sRGB |
| **Atlas** | Prefer **single albedo** per unit (voxel packs often already atlas-ish) |
| **Size** | Cap **512–1024** for units (pack is 1–3 MB total; textures are small) |
| **Transparency** | Avoid unless needed; voxel kits usually opaque |
| **No HTML fake-200** | Magic-byte check before registry insert |
| **No yellow sludge** | Rebind if material path breaks on FBX→GLB |

**Do not** ship huge 4K maps for these assets — wasteful for voxel style.

---

## 5. Best practices — animations

| Check | Best practice |
|-------|----------------|
| **Source** | Use **FBX** with embedded clips (not OBJ) for characters |
| **Clip set min** | `idle`, `walk`, `run` (or walk×speed), `attack`/`slash`, optional `defend`, `jump`, `death` |
| **Bake style** | **Rotation-only** tracks if you retarget onto grounded KCC (fleet pattern); or keep full FBX clips if using **pack-native skeleton** |
| **Mixer** | One `AnimationMixer` per unit; gait vs one-shot attack |
| **Rig policy** | **Option A (preferred for voxel):** keep **pack skeleton** + clip names as shipped (fastest). **Option B:** retarget to Mixamo/Bip001 only if you need shared skill packs |
| **Hand weapons** | Prefer **separate prop GLB** parented to hand bone / socket; avoid permanent welded weapon if class swaps |
| **Naming SSOT** | Map store clips → fleet roles: `Idle→idle`, `Walk→walk`, `Slash Attack→attack`, `Aim Bow→aim`, etc. |

**Clip catalog JSON (per unit, for DB):**

```json
{
  "idle": "Idle",
  "walk": "Walk",
  "jump": "Jump",
  "attack": "Slash Attack",
  "defend": "Defend",
  "aim": "Aim Bow"
}
```

---

## 6. Best file type for game + unit database

### Production binary (runtime)

| Asset class | **Ship format** | Why |
|-------------|-----------------|-----|
| **Units (animated)** | **`.glb`** (glTF binary) | One file: mesh + materials + skins + clips; Three.js / R3F native |
| **Static props / buildings** | **`.glb`** | Same pipeline; optional Draco |
| **Colliders** | **`.collider.json`** (sidecar) | Capsule / box / convex from bake |
| **Icons (UI)** | **`.webp`** 128–256 | Unit frames / roster |
| **Source archive** | keep **FBX+PNG** in private raw bucket only | Not served to clients |

### Do **not** ship to clients as primary

| Format | Why not for fleet browser games |
|--------|----------------------------------|
| **OBJ** | No skin/anim; textures separate; slow multi-file |
| **Raw FBX** | Heavy; Unity-centric; slower web load than GLB |
| **BLEND / MAX** | Author only |
| **Unzipped multipack** | Breaks isolation |

### Database row (D1 / unit registry)

```ts
// Conceptual unit record for Voxel Store assets
{
  id: "vs_knights_champion",          // stable UUID-friendly slug
  source: "the-voxel-store",
  pack: "voxel-knights",
  kind: "unit",                       // unit | prop | building | mount
  role: "melee",                      // melee | ranged | mage | mount | civilian
  displayName: "Champion",
  // CDN
  modelUrl: "https://assets.grudge-studio.com/models/voxel-store/knights/champion.glb",
  iconUrl:  "https://assets.grudge-studio.com/icons/voxel-store/knights/champion.webp",
  colliderUrl: "…/champion.collider.json",
  // Runtime
  heightM: 1.5,
  skeleton: "pack-native",            // or "mixamo" / "bip001" if retargeted
  animCatalog: { idle: "Idle", walk: "Walk", attack: "Slash Attack" },
  // Combat defaults for unit AI
  attackRangeM: 1.8,
  moveSpeed: 3.2,
  // Provenance
  license: "itch-voxel-store-nyop",
  sourceUrl: "https://the-voxel-store.itch.io/voxel-knights",
  magicByte: "glTF",
  polyEstimate: null
}
```

**ObjectStore / D1 fields:** align with `grudge-d1-r2` (`meshes`, `r2_url`, `slot` optional for props, `tags: ["voxel-store","unit","knights"]`).

---

## 7. Bake pipeline (required order)

```text
1. Purchase / download from itch (NYOP) → unzip to raw/voxel-store/<pack>/
2. Inventory: list FBX characters vs OBJ props; list clip names per FBX
3. Per UNIT (character/mount):
     a. Import FBX (prefer cm→m check)
     b. Ground feet, face +Z, height yardstick
     c. Embed/convert textures → webp or pack into GLB
     d. grudge-convert fbx2gltf / glb2glb --height <yardstick>
     e. Emit .collider.json (capsule humanoid)
     f. Write animCatalog from clip list
4. Per PROP / BUILDING:
     a. FBX or OBJ → GLB
     b. Static convex/box collider
5. Magic-byte verify GLB (glTF header)
6. wrangler r2 put → assets.grudge-studio.com/models/voxel-store/...
7. seed D1 / ObjectStore unit rows
8. Smoke: load one knight + one wizard in Open / Vox scene
```

**CLI sketch (ObjectStore convert):**

```bash
# Unit
npm run convert -- fbx2gltf raw/voxel-store/knights/Champion.fbx \
  -o dist/voxel-store/knights/champion.glb \
  --height 1.5 --texture-size 512

# Static prop
npm run convert -- glb2glb dist/tmp/tree.glb \
  -o dist/voxel-store/knights/tree.glb --height 3.0
```

---

## 8. Pack → unit class mapping (for your games)

| Pack | Unit roles for DB | Anim priority |
|------|-------------------|---------------|
| Knights | melee knight, archer, officer, **horse mount** | idle/walk/slash/aim/mounted |
| Rangers | light melee + **bow** | idle/walk/slash/aim |
| Wizards | mage DPS / support | idle/walk/staff/wand/defend |
| Village / Farm | civilians, animals, work props | idle/walk only |
| Palace / Cathedral | env + elite skins | mostly static + few heroes |

**Danger Room / annihilate:** use as **training dummies / wave units**, not as `grudge:` captain replacements.

**Vox / Mine-Loader:** excellent fit (scale + retro voxel look).

---

## 9. Review scorecard (store as shipped)

| Area | Store rating | Production action |
|------|--------------|-------------------|
| Mesh poly budget | Excellent (tiny zips) | Keep; isolate per unit |
| Formats as shipped | Fair (OBJ/FBX only) | **Must bake to GLB** |
| Textures | Good (included) | WebP + sRGB; pack in GLB |
| Rig + anim | Good for Unity | Verify clip names; map to roles |
| Hand sockets | Unknown until open FBX | Inspect bones; parent weapons |
| Scale consistency | Unknown | Enforce yardstick per pack |
| License | Permissive (page) | Archive license + pack URL in DB |
| Web delivery | Not ready | R2 + D1 required |

---

## 10. What you must do next (ops)

1. **Download** packs you own from itch → `raw/voxel-store/<pack>/` (cannot automate paywall).  
2. Run inventory script (list FBX + clip names).  
3. Batch bake units → `dist/voxel-store/…/*.glb`.  
4. Upload R2 + seed unit rows.  
5. Wire loader: `kind === 'voxel_unit'` → GLB + pack-native mixer.

---

## 11. Related fleet docs / skills

- `grudge-asset-convert` — fbx2gltf / glb2glb  
- `grudge-d1-r2` — registry  
- `grudge-warlords-assets` — **do not** displace grudge6 captains  
- `grudge-character-correctness` — scale / ground / facing  
- `docs/PRODUCTION_DEPLOY.md` — Open deploy  

---

## Bottom line

**The Voxel Store** is a solid **low-poly voxel unit/prop** source (OBJ+FBX, textured, rigged, animated). For Grudge production:

| Ship | Don’t ship |
|------|------------|
| **GLB** per unit + collider sidecar + webp icons | Raw OBJ/FBX multipacks to clients |
| D1/ObjectStore rows with `source=the-voxel-store` | Unregistered drop-in folders |
| Pack-native skeleton **or** explicit retarget | Assume Bip001 / Mixamo without check |
| Yardstick height + feet on ground | Unity default scale untested |

**Best file type for unit database + game use: production `.glb` (+ `.collider.json` + icon `.webp`).**  
Source of truth for authors remains FBX; source of truth for runtime is **GLB on R2**.
