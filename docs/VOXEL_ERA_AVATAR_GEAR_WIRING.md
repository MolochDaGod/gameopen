# Voxel era — avatar · gear · weapons · anim · DB (no duplicate systems)

**Status:** SSOT 2026-08  
**Product:** `gameEra=voxel` only  
**Do not invent** a second character DB, second avatar store, second mixer, second physics body, or a “voxel weapon prefab v2” parallel to existing paths.

| Parent SSOT |
|-------------|
| Eras / codexes / UUID | [FLEET_ERA_CODEX_UUID_SSOT.md](./FLEET_ERA_CODEX_UUID_SSOT.md) |
| Voxel worlds / blocks | [VOXEL_CANONICAL.md](./VOXEL_CANONICAL.md) · [CODEX_AND_VOXEL_GENERATION.md](./CODEX_AND_VOXEL_GENERATION.md) |
| Open character avatars | [CHARACTER_AVATARS.md](./CHARACTER_AVATARS.md) |
| Combat weapon packages (shared templates) | [content/docs/WEAPON_PREFAB.md](../content/docs/WEAPON_PREFAB.md) · spine sockets only |

---

## 1. One-truth stack (voxel)

```
Browser (Open Realms / Mine-Loader / Campfire voxel seats)
    │
    ├─ Identity     → id.grudge-studio.com  JWT
    ├─ Characters   → Railway Postgres  GET/PATCH /api/characters?era=voxel
    │                    max 4 · gameEra=voxel · never warlords rows on Realms
    ├─ Account bag  → Railway /api/account|/inventory  (shared across eras)
    ├─ Voxel look   → saveData.open.voxelLook  (+ local mirror avatarEdit:voxelLook:v1)
    ├─ Open loadout → saveData.open  (weaponId for Danger only — see §4)
    ├─ Realms blob  → saveData.realms  (Mine / world progress — era-isolated)
    ├─ Worlds/blocks→ Mine-Loader Railway  /api/blocks · /api/worlds  (1 replica)
    ├─ Definitions  → Voxel Codex (blocks, item icons, kits) — not Warlords master-weaponSkills as body
    └─ Binaries     → assets.grudge-studio.com (TVS / explorer / codex GLB)
```

| Concern | **Use this** | **Do not use** |
|---------|--------------|----------------|
| Character CRUD | Railway `?era=voxel` | Second Postgres / local-only heroes |
| Avatar body look | `voxelAvatarSave` → `saveData.open.voxelLook` | grudge6 `mesh_ids` as Realms body |
| Play host (flagship) | mineloader.grudge-studio.com | Open Danger as Realms substitute |
| Open Realms entry | `/realms` + voxel-era roster only | Warlords / grudge6 player mesh |
| World / blocks | Mine-Loader + `@workspace/voxel-canonical` | Free-form hex block maps as SSOT |
| Gear **UI icons** | Codex item-catalog packs | Invent new icon host |
| Gear **held mesh** (Mine) | pixel tools / rpg_weapons / TVS variants | grudge6 Toon race kits as voxel body |
| Craft **resource** 3D props | `assets/resources/lp` · catalog `lp_*` (ores/ingots stages) | Using resource GLBs as avatar bones/anims |
| Danger combat weapon | `saveData.open.weaponId` + arsenal | Separate “voxel combat weapon DB” |
| Anim (Explorer) | One mixer · explorer/Mixamo path | Second AnimationMixer / Bip001-only packs forced on cube body |
| Physics | One Rapier world per surface | Second physics engine |

---

## 2. Databases (who owns what)

| Store | Voxel-era role |
|-------|----------------|
| **Railway Postgres** | Characters (`gameEra=voxel`), account bag, wallet |
| **Mine-Loader Railway** | Worlds, blocks catalog, Realms authority |
| **D1** | Asset **index** only (optional mesh keys) — never player state |
| **R2 CDN** | GLB / icons / atlases |
| **ObjectStore JSON** | Shared catalogs when mirrored; Voxel Codex lives primarily on Mine generators |
| **localStorage** | Cache / offline draft (`voxelLook` mirror) — never sole production truth when signed in |

**Law:** One account, four era shelves. Voxel heroes are only `era=voxel`. Warlords heroes never hydrate Realms avatars.

---

## 3. Avatar customization (existing modules)

| Layer | Module | Persist |
|-------|--------|---------|
| Look schema | `three/explorer/voxelAvatarSave.ts` | `VoxelAvatarSave` v1 |
| Fleet write | `lib/characterLoadout.ts` → `saveData.open.voxelLook` | PATCH `/api/characters/:id` |
| Local mirror | `avatarEdit:voxelLook:v1` | localStorage |
| Seats / lobby | `CampfireLobbyScene` + `loadVoxelAvatarForCharacter` | same look |
| Dressing / Avatar Edit | `/dressing`, `/avatar` | writes voxelLook |
| Runtime body | `ExplorerCharacter` / explorer loader | `voxelAvatarToLook` |

**Cosmetics in voxelLook today:** skin, shirt, pants, boot, eye, hat, hatColor, cape, capeColor, ledShell (+ optional Avatar Edit head payload).

**Not voxelLook:** grudge6 modular armor `mesh_ids` / gear presets — those are **warlords** (and Danger when a warlords hero is selected).

---

## 4. Gear & weapons — which system by surface

| Surface | Body | Held gear / weapon | Anim |
|---------|------|--------------------|------|
| **Mine-Loader / Realms play** | Voxel / TVS / explorer kit for `era=voxel` | Codex item slots + pixel-tool / TVS weapon GLBs ([CODEX §D–E](./CODEX_AND_VOXEL_GENERATION.md)) | Explorer / realm loco |
| **Open Campfire (voxel seats)** | `voxelLook` cubes/explorer | Visual only unless launching Danger | Idle gestures |
| **Open Danger / brawler** | Selected character (often warlords grudge6) **or** explorer if loadout says so | `saveData.open.weaponId` → `arsenal/*` + optional `content/weapons` spine | Bip001 packs / arsenal clips |
| **Warlords client / Foundry** | grudge6 `loadRaceKit` + mesh_ids | WCS / ObjectStore weapons | sword_shield, longbow, magic, … |

### Shared **weapon prefab** (not a second avatar system)

`content/weapons` + `weaponPrefabSpine.ts` = **combat package templates** (stats, skills, mesh path, **spine sockets**: cast/barrel/blade/blunt/tip/physics/effect).

- Used when mounting a **weapon mesh** for combat (Danger, sandbox, export).  
- **Does not** replace `voxelLook`, Railway characters, or Codex item catalog.  
- Spine is **socket SSOT for the weapon GLB**, not a character customization DB.

```
Avatar customization (voxel)     Weapon package (any combat sandbox)
        │                                    │
        ▼                                    ▼
 saveData.open.voxelLook          content/weapons + arsenal + spine
 Railway character era=voxel      Optional: saveData.open.weaponId
```

**Mismatch to avoid**

| Bad | Good |
|-----|------|
| Apply warlords `meshIds` as Realms body | `era=voxel` only + voxelLook / TVS |
| Store voxel cosmetics only in a new table | `saveData.open.voxelLook` |
| Invent “voxelWeaponPrefab” parallel JSON tree | Codex items + existing `wpn_*` only if combat needs it |
| Dual-write different shapes into `saveData.warlords` for voxel | Keep `open` / `realms` namespaces |
| Second mixer for gear preview | One mixer per avatar |

---

## 5. Assets & animations

| Asset | Path / host |
|-------|-------------|
| Codex blocks / icons | Mine-Loader generators → R2 / `/api/blocks` |
| Explorer / TVS props | `assets.grudge-studio.com` · campfire TVS CDN law |
| Pixel tools / RPG weapon OBJ | Mine `modelLibrary` / CODEX generation docs |
| Open arsenal weapon GLB | `models/weapons/*` (CDN-first in prod) |
| Anim — Explorer | Explorer clip set / Mixamo path (one mixer) |
| Anim — Danger grudge6 | Bip001 packs under `anims/baked/*` + fleet hydrate |

**Scale:** voxel world 1 unit ≈ 1 block; characters ~2.4–2.6 blocks (Codex). SI 1.8 m still applies for grudge6 Danger heroes.

---

## 6. Code map (extend these — no forks)

| Need | File |
|------|------|
| Era list | `lib/grudgeAuth.ts` → `FLEET_CHARACTER_ERAS` |
| Loadout / weaponId / voxelLook | `lib/characterLoadout.ts` |
| Voxel look sanitize / events | `three/explorer/voxelAvatarSave.ts` |
| Realms entry | `lib/openRoutes.ts` · Realms surface |
| Weapon sockets | `three/arsenal/weaponPrefabSpine.ts` |
| Weapon content | `content/weapons/*` · `content/docs/WEAPON_PREFAB.md` |
| Codex generation | Mine-Loader `artifacts/voxelcraft` (see CODEX doc) |
| Blocks contract | `lib/voxel-canonical` · `/api/blocks` |

---

## 7. Wiring checklist (voxel customization + gear)

```
[ ] Character created with gameEra=voxel (Foundry ?era=voxel or Mine create)
[ ] Roster fetch always ?era=voxel for Realms / Mine
[ ] Dressing / Avatar Edit → saveData.open.voxelLook (+ local mirror)
[ ] Campfire seats read voxelLook for voxel-era heroes
[ ] Realms play never forces grudge6 race kits
[ ] Held gear in Mine uses Codex / pixel tools — not mesh_ids alone
[ ] If launching Danger from Open: weaponId from saveData.open; body follows character era rules
[ ] Spine on content weapons only when authoring combat meshes — not for skin/shirt colors
[ ] One mixer, one physics world, Railway character SSOT only
```

---

## 8. Kill list (duplicates / mismatches)

- Parallel `voxelAvatar2` / `newLookStore`  
- Warlords body on `/realms`  
- Treating `WEAPON_PREFAB` as the voxel character customizer  
- D1 or content JSON as bag / character SSOT  
- Mixing `saveData.warlords` profession XP into voxel rows  
- Second anim mixer or second Rapier instance for gear preview  
- Meshy / generic capsule as shipped voxel hero  

---

## 9. Related agent prompt

```
Era: voxel only.
Characters: Railway ?era=voxel.
Avatar: voxelAvatarSave + saveData.open.voxelLook.
Worlds: Mine-Loader + VOXEL_CANONICAL.
Gear UI: Voxel Codex item catalog.
Combat weapon templates (Danger): content/weapons + weaponPrefabSpine — sockets only.
Do not invent a second DB, avatar store, or prefab tree.
```
