# grudge6 + DRC Complete System (mesh · equip · retarget packs · purge)

**Law:** Unity **RTS_TOON / grudge6** is the Warlords mesh+equip SSOT.  
**Retargeted specialty packs** (Samurai, Scarecrow hammer, Ikkaku polearm, Ghost Rider, dual_wield) play on that **same Bip001 kit**.  
**Explorer** = voxel era (Mixamo live); Warlords uses Mixamo only as **authoring → bake to Bip001**.

Related: `ANIMATION_FLEET_SSOT.md` · `CANONICAL_COMBAT.md` · `FLEET_DRC_COMPLETION_PLAN.md` · skills `grudge6-modular-characters` · `grudge-character-correctness`.

---

## 1. DRC layers (complete)

| # | Layer | SSOT |
|---|--------|------|
| **L0** | Mesh + scale + equip | Unity race kit + mesh_ids + Box3 1.8 m + `characterDeploy` |
| **L1** | Input | `FLEET_COMBAT_INPUT` / epicfight |
| **L2** | Motion packs | Bip001 `anims/baked/*` + directors |
| **L3** | Weapon skills | `FleetWeaponSkill` + content/skills + master-weaponSkills |
| **L4** | HUD | ui.grudge-studio.com HYDRA + CraftPix |

---

## 2. Mesh / texture / equipment (Unity RTS_TOON)

### Do not invent new kits

| Source of truth | Path |
|-----------------|------|
| **Production mesh** | `https://assets.grudge-studio.com/models/grudge6/races/{WK\|BRB\|ELF\|DWF\|ORC\|UD}_Characters.glb` |
| **Author / Unity** | Toon_RTS `*_Characters_customizable.FBX` + race TGA→webp atlases |
| **Equip** | Child **visibility** only (`mesh_ids` / gear_presets) — never swap body GLB |
| **Bones** | Bip001 · `R_hand_container` · `L_shield_container` · `Quiver_container` |
| **Clone** | `SkeletonUtils` / skinned instance only |

### Equip algorithm (always)

```
1. Load race kit (GLB prod → FBX+atlas fallback)
2. hideEquippableMeshes(all)
3. show mesh_ids from gear_preset / account / panel
4. exclusive: one body, one arms, one legs, one head, one weapon_r, one shield
5. deployCharacterModel: fit 1.8m, face+π/2, ground feet, center pelvis XZ
6. stripPositionTracks on all combat clips
7. AnimationDirector + re-ground after idle sample
8. FootIK after gait
```

### Name match

Fuzzy: strip `WK_|BRB_|…|Units_|weapon_` then compare keys (see modular skill).

### Atlas

- Race webp, `SRGBColorSpace`, `flipY=false` for FBX path  
- GLB-baked: prefer embedded materials; rebind only if maps missing  

---

## 3. Specialty retarget packs (on grudge6 Bip001)

| Pack | Author | Bake folder | Weapons / use |
|------|--------|-------------|----------------|
| **Samurai** | Retargeted GS | `greatsword_samurai/` | 2H **and** 1H sword stance (2026-08 SSOT) |
| **Scarecrow 2H hammer** | SC_SC / 2hweaponhammerretarget | `twohand_hammer/` (+ `_mixamo`) | hammer2h, mace 2H |
| **Ikkaku Madarame** | `ikkaku_madarame.glb` | `polearm/` | spear, javelin, polearm |
| **Ghost Rider** | PS2 motion only | `ghost_rider/` | finishers, chain, shared rolls |
| **Dual wield** | dual_wielding bake | `dual_wield/` | dashes, combos, 1H skills |
| **Locomotion** | fleet rolls | `locomotion/` | dodge/roll (correct facing) |

### 1H sword (fixed 2026-08)

**Purged as primary:** thin `sword_shield/sword and shield run` (banned loco).  

**Primary now:**

| Role | Clip |
|------|------|
| idle/walk/run/attack | `greatsword_samurai/gs_samurai_*_sword` / combo_a |
| skills / dash | dual_wield + samurai dash_opener / teleport |
| finisher | ghost_rider/quakesmash |
| rolls | locomotion/dodge_* · roll_forward |

---

## 4. PURGE list (do not use as primary)

| Path / pattern | Why |
|----------------|-----|
| `locomotion/running` | Run-to-roll, wrong gait |
| `locomotion/walking` | Tips / fall on Arena kits |
| `sword_shield/sword and shield run` | Wrong-way / terrible on grudge6 |
| Torch run as only 1H run | Prefer `locomotion/run_forward` or samurai run |
| Raw Mixamo FBX on Bip001 | T-pose — bake first |
| `scene.clone()` skinned kit | Broken body/equip |
| Pelvis-as-feet ground | Hip float |
| Meshy / capsule heroes | Forbidden for grudge6 |
| Arena `/cdn/assets/characters` as primary | R2 races only |

---

## 5. Bone / hip patterns (best results)

| Rule | Detail |
|------|--------|
| Skeleton | Bip001 (spaces or underscores after GLTF sanitize) |
| Rematch | `rematchClipToSkeleton` / resolveBoneName — **never** convert back to wrong space form |
| Tracks | **Quaternion only** on grounded kit (`toRotationOnlyClip` / stripPositionTracks) |
| Hips | Do not drive world root with hip position tracks |
| After play | `sampleClipAndReground` / reGround after idle + attack |
| Hands | Attach weapons to containers, not raw finger bones |
| Facing | Art-forward +π/2 once for Toon FBX kits |

---

## 6. Weapon → pack map (DRC)

| Weapon family | AnimPack | Primary bake |
|---------------|----------|--------------|
| sword, shield, axe, dagger, mace 1H | sword_shield | **samurai sword** + dual_wield |
| greatsword, greataxe, scythe | twohand | samurai |
| hammer2h, maul | hammer | twohand_hammer (Scarecrow) |
| spear, javelin | polearm | Madarame |
| bow, longbow | longbow | longbow |
| staff, wand, tome | magic | magic |
| pistol / rifle | pistol / rifle | gun bakes |
| unarmed | unarmed | dual_wield attacks |

Skills: `FleetWeaponSkill` rows + slash/chain VFX from ghost_rider / dual_wield dash.

---

## 7. Explorer (voxel) note

- Live rig: Mixamo 25-bone.  
- Hammer has `twohand_hammer_mixamo` twin for that lane.  
- Same **quality process**; different **live skeleton**.  
- Armor/weapon mesh systems for explorer: start from same **visibility equip** idea when packs land.

---

## 8. Process checklist (any host)

```
[ ] Era = warlords → grudge6 GLB + Bip001 only
[ ] mesh_ids equip green (one body, one weapon)
[ ] Pack from animPackForWeapon / weapon-live-packs
[ ] No banned loco paths
[ ] stripPositionTracks + rematch + re-ground
[ ] Rolls from locomotion/* not run-to-roll
[ ] Skills map to baked clips + epicfight readiness
[ ] HUD from HYDRA pack (when wired)
```

## 9. Code entry points

| Concern | File |
|---------|------|
| Pack clips | `three/grudge/anims.ts` ANIM_PACK_CLIPS |
| Load + ban | `loadBakedClip` / BANNED_LOCOMOTION_CLIPS |
| Mesh deploy | `grudge6Runtime.ts` · `characterDeploy.ts` |
| Live weapon table | `content/anims/weapon-live-packs.json` |
| Lane law | `three/anim/fleetAnimSsot.ts` |
| Combat rules | `@workspace/epicfight` |

---

**Success:** Equip sword on WK grudge6 — samurai idle/walk/run/attack, dual_wield dash, GR roll, feet on ground, correct facing, no old sword_shield run.
