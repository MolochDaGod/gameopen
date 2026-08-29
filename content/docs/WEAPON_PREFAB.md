# Weapon Prefab Contract (shared combat packages · Grudge Open)

A **weapon prefab** is a **held combat mesh package** (stats, skills, mesh, spine sockets, VFX defaults).  
It is **not** the voxel avatar customizer, **not** Railway character rows, and **not** the Voxel Codex item catalog.

| Layer | Owns character body / era look | Owns held weapon combat mesh |
|-------|--------------------------------|------------------------------|
| **voxel era** | `saveData.open.voxelLook` · [VOXEL_ERA_AVATAR_GEAR_WIRING.md](../../docs/VOXEL_ERA_AVATAR_GEAR_WIRING.md) | Codex / pixel tools on Mine; optional `weaponId` → arsenal on Danger only |
| **warlords era** | grudge6 `mesh_ids` + gear presets | This prefab + arsenal + ObjectStore skills |
| **Danger / sandbox** | Selected fleet character | This prefab + `MountedWeapon.tip` / spine |

A package is game-ready when **data + mesh + combat + present + spine + physics/effect** are green (or intentional `placeholder`).  
Do **not** invent parallel combat systems or a second avatar store under “prefab.”

| Surface | Role |
|---------|------|
| **Author JSON** | `content/weapons/*.json` + `content/skills/*.json` + `content/items/*.json` |
| **Schema** | `content/schemas/weapon_def.schema.json` |
| **Runtime mount** | `artifacts/animator/src/three/Weapons.ts` + `arsenal/*` |
| **Spine defaults** | `artifacts/animator/src/three/arsenal/weaponPrefabSpine.ts` |
| **Casting lab spine** | `CastingAbilitiesThreeJS/src/character/weaponPrefabSpine.js` · `docs/SCRIPTABLE_PLAY_SSOT.md` |
| **Melee residual** | `three/combat/meleeStrikeFx.ts` + `docs/MELEE_SLASH_FX.md` |
| **Catalog / icons** | ObjectStore `master-weaponSkills.json` · CDN `assets.grudge-studio.com` |
| **UUID graph** | `docs/WEAPON_PREFAB_UUID_SSOT.md` |
| **Voxel era wiring** | `docs/VOXEL_ERA_AVATAR_GEAR_WIRING.md` |

Gold package: **`wpn_sword_iron_01`**.

---

## 1. Six layers (identity → play)

| Layer | Owns | Ready when |
|-------|------|------------|
| **identity** | `id` (`wpn_*`), `itemId` (`itm_*`), family, slot, tags, UUIDs | Stable ids; links to item + skill list |
| **stats** | `baseDamage`, `attackSpeed`, twoHanded, animPack | Numbers SI-sensible; animPack matches family |
| **skills** | `skills[]` → `content/skills/*` | ≥1 primary with hit window + anim key |
| **assets** | mesh path + icon + optional atlas | File on disk or **CDN**; grip tested |
| **runtime** | spine points, grip, forward/align, physics, effects | Spine resolves; tip/cast usable in Studio |
| **loadout** | bag/equip/hotbar/craft export graph | Instance stays Railway; template is content |

Readiness still reports **data · mesh · combat · present** (ship gate). Spine is **runtime** readiness: missing spine falls back to family defaults (not ship-blocked until family default is wrong).

---

## 2. Asset awareness (where files live)

| Kind | Authority | Typical path |
|------|-----------|----------------|
| **Weapon GLB** | R2 CDN / Open public | `models/weapons/{name}.glb` · prod: `https://assets.grudge-studio.com/models/weapons/…` |
| **Icons** | ObjectStore + R2 | `icons/pack/weapons/…` · always set `cdnUrl` when known |
| **Skill defs catalog** | ObjectStore | `master-weaponSkills.json` v3.1+ |
| **Named weapons catalog** | ObjectStore | `weapons.json` · `t0-weapons.json` |
| **Anim packs (Bip001)** | Open baked / CDN | `anims/baked/{sword_shield\|longbow\|magic\|…}/` |
| **VFX meshes** | R2 | `models/vfx/…` (slash packs, projectiles) |
| **Player instances** | Railway Postgres | bag / equip — **not** D1, not content JSON |

**Laws**

1. Prefer **CDN absolute** or `loadGltfFirst` multi-host for production meshes (Vercel bans large `.glb` in SPA).  
2. Content `mesh.path` is **relative key** under gameopen models root — resolvers add CDN.  
3. Icons: never invent local-only paths without `cdnUrl` when shipping.  
4. Do **not** put player-owned instances in content JSON.

---

## 3. Spine / locations (HARD)

Every mounted weapon has a **local-space spine** (child markers under the grip-root).  
Runtime today uses primarily **`tip`** (`MountedWeapon.tip`); full spine is authoring + future multi-socket resolve.

### 3.1 Point dictionary

| Point id | Role | Consumers |
|----------|------|-----------|
| **grip** | Hand mount origin (bone socket) | Equip, IK, dual-wield off |
| **blade** | Primary edge mid (slash/trail start mid-blade) | Trails, slash residual origin |
| **tip** | Far lethal point (blade tip / spear point) | Melee residual, trail end, aim sample |
| **blunt** | Impact mass center (mace/hammer head) | Blunt hit VFX, crush impulse |
| **barrel** | Bore exit (gun/rifle/crossbow) | Muzzle flash, projectile spawn |
| **cast** | Magic cast/orb origin (staff tip / wand gem / tome face) | Orbs, beams, staff skills |
| **special** | Extra socket (scythe crook, gunblade second muzzle, shield boss) | Family-specific FX |
| **physics** | Collider / contact center (or box mid) | Rapier capsule/box attach |
| **effect** | Default VFX attach (often = tip or cast) | Status aura, charge glow |

### 3.2 Family defaults (SI metres, local Y-up held unless noted)

Local frame after grip: **+Y along weapon length** for melee/staff; **+Z along bore** for guns (`align: "z"`).

| Family | Primary combat point | Default tip-ish (m) | Notes |
|--------|----------------------|---------------------|--------|
| sword / dagger | blade + tip | tip ~0.9–1.2 / 0.4–0.5 | Edge residual from tip |
| greatsword / greataxe / scythe | tip | tip ~1.5–1.8 | Longer residual allowed |
| axe | tip near bit | ~1.0 | |
| mace / hammer | **blunt** | blunt ~1.0–1.1 | Prefer blunt over tip for impact |
| spear | tip | ~2.0 | |
| bow / crossbow | barrel (string rest) | barrel Z+ | Projectile from barrel |
| gun / pistol / rifle | **barrel** | barrel Z+ | Muzzle only — never cast |
| staff / wand | **cast** | cast = tip | Orbs from cast |
| tome | cast (book face) | cast near grip+Y | Off-hand |
| shield | blunt / special | boss center | Bash, not slash |

Code defaults: Open `weaponPrefabSpine.ts` · Casting `weaponPrefabSpine.js` → `defaultSpineForFamily(family)`. Same dictionary.

### 3.3 JSON shape (`mesh.spine` or top-level `spine`)

```json
"spine": {
  "forward": "y+",
  "align": "y",
  "points": {
    "grip":    { "pos": [0, 0, 0] },
    "blade":   { "pos": [0, 0.55, 0] },
    "tip":     { "pos": [0, 1.12, 0] },
    "blunt":   { "pos": [0, 0.55, 0] },
    "barrel":  { "pos": [0, 0.06, 0.36] },
    "cast":    { "pos": [0, 1.4, 0] },
    "special": { "pos": [0, 0.8, 0.1] },
    "physics": { "pos": [0, 0.5, 0], "radius": 0.08, "halfHeight": 0.45 },
    "effect":  { "pos": [0, 1.12, 0] }
  },
  "status": "ready"
}
```

- Omit unused points (guns omit blade; swords omit barrel).  
- `status`: `ready` \| `placeholder` \| `missing` (missing → family defaults at runtime).  
- Positions are **local metres** after mesh normalize (see `WeaponModelPiece.length`).

### 3.4 Resolve order (runtime)

```
1. Prefab JSON spine.points[id]
2. Family default from weaponPrefabSpine
3. Procedural mount tip (Weapons.ts addTip / modelTip)
4. Grip origin only (last resort — combat degraded)
```

Studio / combat already sample **grip→tip** for residual slash. New code should call `resolveWeaponSpinePoint(weapon, "barrel"|"cast"|…)` instead of inventing offsets.

---

## 4. Physics (prefab contract)

| Field | Meaning |
|-------|---------|
| `physics.kind` | `capsule` \| `box` \| `sphere` \| `none` |
| `physics.attach` | spine point id (usually `physics` or `blunt`) |
| `physics.radius` / `halfHeight` / `size` | SI metres |
| `physics.sensor` | hit volume only (no rigid push) vs solid |
| `physics.mass` | optional; default light held |

**Best practices**

- Melee hit volumes follow **tip/blade arc** in anim hit windows, not a free-floating box.  
- Guns: projectile spawn at **barrel**; no melee capsule required.  
- Staff: soft sphere at **cast** for cast-time body only if needed.  
- Never 100× unit scales — human ~1.8 m is yardstick.

---

## 5. Effects (prefab contract)

| Field | Meaning |
|-------|---------|
| `effects.trail` | blade trail grip→tip colors |
| `effects.muzzle` | flash at barrel |
| `effects.cast` | charge/cast glow at cast |
| `effects.impact` | hit burst at blunt/tip |
| `effects.residual` | slash_wave / bolt profiles → `meleeStrikeFx` / skill VFX |
| `effects.audio` | Kenney / CDN SFX keys |

Skill JSON still owns **per-skill** VFX (`vfx` SkillVfxProfile). Prefab `effects` are **defaults** when skill omits anchors:

| Skill travel `startAnchor` | Spine point |
|----------------------------|-------------|
| `weaponTip` | tip |
| `muzzle` / `barrel` | barrel |
| `cast` / `hand` | cast (or grip) |
| `blunt` | blunt |

Getsuga / slash residual: **melee attack only** from tip — see `docs/MELEE_SLASH_FX.md` (not Alt+Space).

---

## 6. Definitions & catalogs

| Definition | Source |
|------------|--------|
| Weapon family skills (design) | ObjectStore `master-weaponSkills.json` |
| Content combat sandbox | `content/weapons` + `content/skills` |
| Runtime arsenal (Danger) | `arsenal/melee.ts` · `ranged.ts` · `magic.ts` · `gunClass.ts` |
| T0 kits | `arsenal/t0WeaponSkills.ts` + ObjectStore `t0-weapons.json` |
| Icons | CDN + readiness `icon.status` |

Import pipeline: `scripts/import-master-weapon-skills.mjs` → fills content packages; **then** author spine on gold weapons.

---

## 7. Seven jobs (do not invent parallel systems)

| Job | System |
|-----|--------|
| bag / drop | Railway inventory + content template id |
| equip | grip bone + mesh load |
| controller anim | `animPack` / Bip001 packs |
| hotbar | skill ids on weapon |
| combat | hit windows + spine points + meleeStrikeFx |
| craft | recipes → itemId (ObjectStore) |
| export | prefab JSON + UUID graph for Unity/Warlords |

---

## 8. Readiness status

- `ready` — shippable  
- `placeholder` — intentional stub (lab OK)  
- `missing` — blocks `ship: true`

### Weapon JSON minimum

- `id`, `itemId`, `family`, `slot`, `baseDamage`, `skills[]`  
- `mesh.path`, `mesh.status`  
- `readiness` { data, mesh, combat, present }  
- **Recommended:** `spine` (or rely on family defaults) + `icon.cdnUrl`

### Skill JSON minimum

See `content/docs/SKILL_PREFAB.md`.

---

## 9. Agent / human batch rule

```
Contract: content/docs/WEAPON_PREFAB.md
Spine: content/docs/WEAPON_PREFAB.md §3 + arsenal/weaponPrefabSpine.ts
UUID: docs/WEAPON_PREFAB_UUID_SSOT.md
Gold: wpn_sword_iron_01
Fill missing readiness + spine only. Do not change combat formulas.
Run: pnpm readiness:weapons
```

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm scaffold:weapon --family sword --slug steel_longsword` | item + weapon + 4 skills (+ spine stub) |
| `pnpm readiness:weapons` | readiness table + ship gate |
| `pnpm content:index` | rebuild manifests |

---

## 10. Kill list

- Parallel “socket system” outside spine dictionary  
- Hardcoded tip offsets in Studio when prefab has spine  
- Muzzle FX from hand for guns (must use **barrel**)  
- Magic projectiles from grip when **cast** exists  
- Meshy/capsule as production hero weapons  
- Shipping `ship: true` with mesh `missing`  
- Free-hotkey Getsuga (residual is attack-profile only)
