# Danger Room — UI/UX review & consolidation

**Canonical play surface:** https://open.grudge-studio.com/danger  
**Engine:** one `Studio` instance · one combat HUD · one grudge6 equipment path  

Related: [SYSTEMS_HUD_UX_CONSOLIDATION.md](./SYSTEMS_HUD_UX_CONSOLIDATION.md) · [UMMORPG_ENGINE_PRACTICES.md](./UMMORPG_ENGINE_PRACTICES.md) · [CHARACTER_MESH_DELIVERY.md](./CHARACTER_MESH_DELIVERY.md) · [GAMEPLAY_LOAD_STACK.md](./GAMEPLAY_LOAD_STACK.md)

---

## 1. What “Danger Rooms” exist (inventory)

There is **one combat product**, with several *related* systems that looked like forks:

| Name | What it is | Keep? | Role after consolidation |
|------|------------|-------|---------------------------|
| **`Studio` + mode `danger`** | Full combat sandbox (spar, skills, AI, multiplayer) | **YES — SSOT** | Only Danger Room gameplay |
| **`DangerRoom` class** | Data-driven **training chamber mesh** (floor/walls/presets) | YES | Environment only (not a second game) |
| **Dungeon inside Studio** | Optional descent / pit (water band, enemies) | YES | Sub-mode of Studio, same avatar/HUD |
| **mode `play`** | Studio + authored voxel map (arena test) | YES | Same Studio + HUD; map swap only |
| **VoxelEditor + DangerRoom** | Editor reuses room atmosphere | YES | Authoring, not combat ship |
| **danger-net / DangerClient** | Multiplayer relay for Studio rooms | YES | Networking for SSOT Studio |
| **PlayHud / dressing editor** | Lab / create surface | Separate | Not combat HUD |
| **MechHud** | Overlay while piloting | Keep | Nested under Studio only |
| **Brawl / Survival** | Sister T0 combat | Reuse systems | Import Controller + Hud cluster; not a second Danger Room |

**Conclusion:** Do **not** maintain two Danger Room games.  
**Deliverable:** `/danger` (and `/play` map test) → **Studio + Hud + EquipmentScreen + grudge6**.

---

## 2. UI/UX review (best-of scores)

| Surface / panel | UX score | Issues | Verdict |
|-----------------|----------|--------|---------|
| **Combat HUD** (`Hud.tsx` + UnitFrame + quickActions) | **A−** | Wings must stay driven by `quickActions` SSOT; icons CDN remap incomplete | **Canonical combat UI** |
| **Equipment main panel** (`EquipmentScreen`) | **B+** | Pause overlay; must always re-apply mesh_ids | **Canonical main panel** |
| **Account paperdoll** (`AccountPanel` + RacePortraitGrid) | **B+** | Create/select hero; portraits via CharacterAvatar | Keep as **out-of-combat** panel |
| **Admin / Editor / Anim dock** | **B** | Power-user tabs; hide by default | **Smart tabs** (dock, not always-on) |
| **Radial (Tab hold)** | **A** | Mode-aware tools | Keep |
| **Harvest production (P)** | **B** | Heavy shell; Esc close | Keep as activity shell |
| **Dressing Room HUD** | **B** | Lab only | Not for combat |
| **PlayHud (editor play)** | **C** | Overlaps combat metaphors | Do not use in Danger Room |
| **MechHud** | **B** | Context-only | Keep |

### Target UX layout (ship)

```
┌─ FleetBar (account · character portrait · weapon) ──────────────────┐
│ Smart tabs (optional): Admin · Clips · Room  [I equip] [P prod]     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                     3D Studio (DangerRoom environment)               │
│                         crosshair center                             │
│                                                                     │
│  Target UnitFrame ─────────────────────────────── (soft/hard lock)  │
│                                                                     │
│  [6 skills]   [Hero UnitFrame HP/SP]   [6 util]   ← combat cluster  │
│   LMB F 1-4      race PNG / avatarUrl      X C R …                  │
│  Mode chip Q · legend · radial hint                                  │
└─────────────────────────────────────────────────────────────────────┘
  EquipmentScreen = full-screen pause (Esc) · main panel uMMORPG style
```

### UX rules (hard)

1. **One key legend** — `hud/quickActions.ts` = Studio keys (no Q=parry docs).  
2. **One portrait pipeline** — `characterPortrait` / `hudPortrait`.  
3. **One skill icon pipeline** — `skillIcons.ts` → CDN pack + local fallback.  
4. **Main panel = EquipmentScreen** for live loadout; Account panel for roster/create.  
5. **Smart tabs** = dock panels (Admin/Anim/Editor), not second HUDs.  
6. **Never** full-screen Action_Bar art as buttons.

---

## 3. Import / mesh / scale mismatches (root causes)

| Mismatch | Cause | Fix (status) |
|----------|-------|--------------|
| Wrong race / no armor | mesh_ids applied before Studio exists | **Re-apply loadout on Studio mount** |
| Double weapons | Kit mesh_ids + arsenal GLB hand mount | **Skip external GLB when kit has weapon meshes** |
| Giant / tiny hero | Height fit / dual normalizers | `fitCharacterHeight` on grudge6 only; Controller uses root |
| Pink body | Atlas miss / HTML CDN | Multi-host texture + content-type gates |
| T-pose | Anim pack miss | Open `/anims/baked` → arena |
| Explorer vs grudge6 swap | Voxel flags / avatarId | `preferExplorer` vs race kit rules |
| Dungeon vs room scale | Separate dungeon GLB footprint | Dungeon owns its map; avatar scale unchanged |

---

## 4. Canonical equipment pipeline (uMMORPG parity)

Unity uMMORPG → Open mapping:

| Unity | Open |
|-------|------|
| Main panel equipment | `EquipmentScreen` + `resolveCharacterEquipmentVisual` |
| EquipmentItem → bone | Kit **child visibility** (`mesh_ids`) + optional hand GLB for Explorer |
| ScriptableWeapon skills | `t0WeaponSkills` + master catalog (info SSOT) |
| Race prefab | `RACE_ASSETS` FBX + atlas rebind |
| Animator | `GrudgeAvatar` + `AnimationDirector` / mixer |

### Flow (required)

```
Railway character
  equipment / saveData.open / classId
       ↓
resolveCharacterEquipmentVisual  →  meshIds[] + preset + icons
       ↓
Studio.setEquipmentMeshIds(meshIds)
Studio.setCharacter(grudge:race:preset)
       ↓
loadGrudge6CombatRig:
  FBX kit → unify skeleton → atlas → applyGearPreset(meshIds)
       ↓
Handheld weapons: IF mesh_ids include weapon_* / shield
  → kit mesh only (no second arsenal GLB)
ELSE Explorer/catalog
  → mountWeaponModel on hand bones
       ↓
setWeapon → skill bar rebuild (T0 / master kit)
Hud snapshot → combat cluster
```

### All grudge6 races (handheld availability)

| Race | Prefix | Kit | Weapons via mesh_ids |
|------|--------|-----|----------------------|
| western-kingdoms | WK_ | FBX | sword, axe, bow, staff, shield, quiver… |
| barbarians | BRB_ | FBX | same exclusive groups |
| dwarves | DWF_ | FBX | … |
| high-elves | ELF_ | FBX | … |
| orcs | ORC_ | FBX | … |
| undead | UD_ | FBX | … |

Presets: `gearPresets.ts` (+ remote `grudge6-gear-presets` on **info** host).  
Every class preset includes **body + arms + legs + head + weapon(+shield)** mesh names so handheld objects appear on **all six races**.

---

## 5. Materials / textures / coloration

| Step | Standard |
|------|----------|
| Atlas | Race webp on R2 `textures/grudge6/...` |
| Bind | `MeshStandardMaterial`, color white, metalness 0, roughness ~0.75 |
| Color space | sRGB |
| flipY | **false** (Toon RTS FBX path) |
| Wrap | ClampToEdge |
| Coloration | Atlas UV only — no random mesh colors |
| Explorer tints | Optional tier colors on procedural body only |

---

## 6. Weapon skills + icons (canonical)

| Slot | Key | Source |
|------|-----|--------|
| Primary | LMB | Weapon basic attack |
| F skill | F | Arsenal / T0 |
| 1–4 | 1–4 | Signature / master-weaponSkills |
| R | R | Heavy |
| Util wing | X C … | Dodge / parry / … |

Icons: `skillIcons.resolveSlotIconUrl` → `assets…/icons/pack/**` → `/icons/*.png`.  
Catalog: `info.grudge-studio.com/api/v1/master-weaponSkills.json` via `fetchCatalogJson`.

---

## 7. Smart tabs (dock) — Danger only

| Tab | Content | Default |
|-----|---------|---------|
| (none) | Pure combat HUD | Visible |
| **I** | Equipment main panel | Overlay |
| **P** | Production / harvest | Overlay |
| Admin | Spawns / difficulty / room preset | Dock hidden |
| Anim | Clip list / debug | Dock hidden |
| Editor | Env / FX params | Dock hidden |

Do not open Admin/Anim by default — combat-first UX.

---

## 8. Code ownership after consolidation

| Concern | File |
|---------|------|
| Combat engine | `three/Studio.ts` |
| Room mesh | `three/DangerRoom.ts` |
| Avatar + equip mesh | `three/grudge/*` + `lib/characterEquipmentMesh.ts` |
| Fleet → Studio wire | `App.tsx` `applyFleetLoadoutRef` |
| HUD | `components/Hud.tsx` + `hud/quickActions.ts` |
| Main panel | `components/EquipmentScreen.tsx` |
| Skills | `arsenal/*` + `content/masterWeaponSkills.ts` |
| Multiplayer | `net/DangerClient.ts` |

---

## 9. Smoke (consolidated Danger Room)

1. Library → **Danger Room**  
2. Fleet hero with race kit (not capsule)  
3. Armor pieces one set only; **one** sword/shield visible  
4. Walk/run anims  
5. LMB attack + F skill + CD on bar  
6. **I** equip → change weapon → mesh + skills update  
7. Portrait matches race or `avatarUrl`  
8. Optional: multiplayer join same room  

---

## 10. Definition of done

One Danger Room deliverable: **Studio + combat HUD + uMMORPG main panel + grudge6 Toon RTS kit** (correct atlas, scale, handheld mesh_ids on all races), with smart tabs for power tools only.
