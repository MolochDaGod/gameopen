# Unity weapon skills · animations · tome effects → Open

**Policy:** Unity-era special weapon skills, weapons, VFX/projectiles, attacks, combat, camera, and controller may be **migrated and edited** onto fleet Open systems when they improve quality. Do not re-implement a second combat stack.

**Related:** `docs/UNITY_TO_OPEN_ASSET_MIGRATION.md` (meshes/kits) · `docs/CANONICAL_COMBAT.md` · `content/docs/CANONICAL_WEAPON_SKILLS.md` · `content/docs/UMMORPG_ADOPTION.md` · `docs/CONTROLS_CAMERA_WEAPON_SSOT.md`

---

## 1. What migrates (systems map)

| Unity / uMMORPG concept | Open production target | Package / path |
|-------------------------|------------------------|----------------|
| ScriptableWeapon + skill slots 1–4 | `content/weapons/*.json` + `content/skills/*.json` + ObjectStore master catalog | import: `scripts/import-master-weapon-skills.mjs` |
| Master skill tree (268) | ObjectStore `master-weaponSkills.json` **v3.1.0** | runtime: `three/content/masterWeaponSkills.ts` |
| ScriptableSkill cast / CD / cost | Prefab fields + `FleetWeaponSkill` | `@workspace/epicfight` `combat/fleet/weaponSkill.ts` |
| Animator Controller (weapon) | **Anim pack** by weapon class (`magic`, `sword_shield`, …) | Bip001 bake `/anims/baked/{pack}/` |
| Skill one-shots / events | `animClip` + hit windows / `requestOneShot` | `grudge6-combat-runtime` + `AnimationDirector` |
| Projectiles / skill FX | `SkillProjectileDef` + effect ids + GLB orbs/beams | `server/src/routes/effects.ts`, `models/vfx/**` |
| Combat state (block/parry/…) | `CombatController` + fleet constants | `@workspace/epicfight` |
| TPS camera / controller | `Controller` + `cameraProfiles` | `three/Controller.ts`, `@workspace/grudge-physics` |
| **TOME** off-hand pages | Arsenal `tome` + magic pack + off-hand mesh | `wpn_tome_master.json`, `t0WeaponSkills` tome kit |
| **WAND** | Arsenal `wand` + staff mesh stand-in | `wpn_wand_master.json` |

**Rule:** Port **data + feel** (names, CD, range, projectile/AoE, element colors, clip roles). Do **not** port Mirror networking, Unity Animator controllers as YAML, or KriptoFX particle systems as-is — rebind to Three/GLB VFX.

---

## 2. Weapon skill pipeline (SSOT layers)

```
Unity ScriptableSkill / master design
        │
        ▼
ObjectStore master-weaponSkills.json  (design SSOT — names, icons, tier, damageType)
        │  node scripts/import-master-weapon-skills.mjs
        ▼
content/skills|weapons/*.json         (Danger sandbox combat prefabs)
        │  masterWeaponSkills.ts + t0WeaponSkills + fleetWeaponSkillAdapter
        ▼
FleetWeaponSkill                      (fleet runtime shape)
        │  FleetCombatHost (Studio / Island / Voxel)
        ▼
Anim one-shot + hit window + VFX spawn + CombatController damage
```

| Layer | Owns |
|-------|------|
| Master catalog | Labels, icons, tree structure, design damage types |
| Content prefabs | Hit windows, VFX modes/effectIds, cooldown numbers for sandbox |
| FleetWeaponSkill | Mesh/collider/projectile/stamina for all fleet games |
| Host | Play anim, dash, spawn VFX, apply damage |

---

## 3. Animation migration

### Pack ownership

| Weapon family | Anim pack | Status (Open) |
|---------------|-----------|---------------|
| sword / dagger / mace / shield | `sword_shield` | Production packs exist |
| bow / crossbow | `longbow` | Production |
| staff / wand / **tome** | **`magic`** | **Degraded** — walk/run ready; idle/attack often **polearm fallback** |
| greataxe / greatsword / spear / scythe | `2h_melee` / `polearm` | Partial |
| gun | `rifle` / gun | Partial |
| harvest tools | `harvest` | **Gap** — bake chop/mine/gather |

### Clip roles to bake (magic / tome / wand priority)

| Role | Unity source intent | Open bake key (target) |
|------|---------------------|------------------------|
| idle | hold tome/wand idle | `magic/idle` (not polearm) |
| walk / run | magic loco | `magic/Standing Walk|Run Forward` (present) |
| cast / attack | 1H cast spell | `magic/cast` or `standing-1h-cast-spell-01` bake |
| magicAttack | page surge cast | `magic/magicAttack` |
| magicArea | nova release | `magic/magicArea` |
| castSpell / castSpell2 | beam cast charge/release | used by `beamCast.ts` tome/wand profiles |

**Sources on disk (when available):**

- Mixamo / fleet: `anim/magic/*.fbx`, `anim/magic-loco/*.fbx` (listed in `weapon-live-anims.json`)
- Toon RTS / Explosive packs → retarget **Bip001**, bake JSON under same-origin `/anims/baked/magic/`
- Unity GenesisGrudge FX packs (`!FX/ARPG Effects`, KriptoFX) → **reference only**; export meshes/textures, not Unity particle assets

### Skill anim contract

```json
"animKey": "cast",
"anim": {
  "path": "/anims/baked/magic/cast",
  "status": "ready|placeholder",
  "pack": "magic",
  "role": "cast"
}
```

Until bake lands: `animKey` still drives `PlayerAnimationDirector` / pack fallback (`attack` → polearm attack today for tome).

---

## 4. Tome skills & effects (focus)

### Design intent (Unity / master)

| Slot | Hotbar | Skill (clean name) | Feel | Element |
|------|--------|--------------------|------|---------|
| 1 | 1 | **Flame Wave** | Dash/burn page + fire projectile | fire |
| 2 | 2 | **Blaze Fury** | Frenzy cast / fire wave | fire |
| 3 | 3 | **Ice Nova** | Frost AoE + chill | frost |
| 4 | 4 | **Divine Wave** | Holy wave / scripture beam | holy / arcane |

Off-hand: `wpn_tome_master` · mesh stand-in `models/weapons/shield.glb` · icon `Book_1.png` · `animPack: magic`.

### Production VFX bind (Open — do not use whole `fireball.glb`)

| Skill | castEffectId | impactEffectId | projectile mesh | hit kind |
|-------|--------------|----------------|-----------------|----------|
| Flame Wave | `spell-glyph` | `explosion` | `orb-fire` | projectile |
| Blaze Fury | `chaos-glyph` | `explosion` | `orb-flare` | projectile / short beam |
| Ice Nova | `spell-glyph` | `crystals` + ring | — / optional `orb-core` | aoe sphere |
| Divine Wave | `light-beam` / `yellow-light` | `light-of-slash` | optional beam profile | beam + aoe |

Catalog SSOT: `server/src/routes/effects.ts`  
Orb rules: skill `grudge-vfx-orbs-strike` · `docs/vfx/FIREBALL_ORBS.md`  
Beam feel: `three/combat/beamCast.ts` → `BEAM_PROFILES.tome` (Scripture Beam)

### Prefab shape (migrated)

```json
{
  "family": "tome",
  "hitWindows": [{ "t": 0.28, "kind": "projectile", "radius": 0.45, "speed": 22 }],
  "vfx": {
    "mode": "directional",
    "cast": "#ff7a1a",
    "impact": "#ff9a40",
    "castEffectId": "spell-glyph",
    "impactEffectId": "explosion",
    "projectileMesh": "models/vfx/orbs/orb-fire.glb"
  },
  "fleet": {
    "role": "combo",
    "animRole": "cast",
    "castEffectId": "spell-glyph",
    "impactEffectId": "explosion",
    "projectile": { "kind": "orb", "speed": 22, "range": 16, "meshPath": "models/vfx/orbs/orb-fire.glb" }
  }
}
```

### Known import bugs (fixed in content; re-import must preserve)

1. Master TOME often dumps **comma-joined ultimate names** into one skill → strip quotes, take first token or map by slot.
2. Import marked fire tomes as **melee** hit windows + `vfx.mode: none` → use magic heuristics.
3. `anim.status: placeholder` until magic cast bake ships.
4. Mesh remains shield stand-in until dedicated tome GLB bake.

---

## 5. Unity FX packs → Open (reference)

| Unity folder (local) | Migrate as |
|----------------------|------------|
| `GenesisGrudge/.../!FX/ARPG Effects` | Style reference; re-author as GLB orbs/glyphs or use existing `models/vfx/*` |
| KriptoFX / particle dissolve | Shader/tint reference only — browser uses Three materials + catalog GLBs |
| Skill prefab particle IDs | Map → `castEffectId` / `impactEffectId` in prefab + FleetWeaponSkill |

**Never** load Unity `.prefab` / particle systems in the browser.

---

## 6. Camera & controller (migratable improvements)

| Unity feel | Open target |
|------------|-------------|
| Orbit / over-shoulder | `Controller.setCameraOpts` + `cameraProfiles` |
| Combat soft/hard lock | `grudge-combat-targeting` + aim package |
| Skill short flight | `Controller.startSkillFlight` |
| Input map parry/dodge/slide | `FLEET_COMBAT_INPUT` (C / X / Alt) |

Improve numbers inside existing hosts — do not fork a Unity CharacterController C# port.

---

## 7. Backlog (skills / tome / anims)

| P | Item | Action |
|---|------|--------|
| **P0** | Tome prefabs combat-ready VFX + hit kinds | Content fixed (see `content/skills/tome_*.json`) |
| **P0** | Import script magic/tome heuristics | `import-master-weapon-skills.mjs` |
| **P0** | T0 kit labels match clean Unity names | `t0WeaponSkills.ts` tome kit |
| **P0** | **Runtime cast path** | `magicCombat.ts` + Studio `doMagicSignature` (**done**) |
| **P0** | Unified cast planner | `skillCastPlan.ts` (**done**) |
| **P1** | Bake `magic/idle` + `magic/cast` + `magicArea` (Bip001) | Retarget → `/anims/baked/magic/` · update `weapon-live-anims.json` |
| **P1** | Dedicated tome book GLB | Replace shield stand-in; SI scale |
| **P2** | Full 268 skills unique clips | Gradual; one-shot + VFX until bake |
| **P2** | Export high-value Unity ARPG FX to GLB | R2 + D1; bind effect ids |
| **P2** | Harvest anim pack bake | See asset migration doc |

**Best systems for the new game:** `docs/BEST_SYSTEMS_FOR_NEW_GAME.md`

---

## 8. Agent checklist (when migrating a Unity skill)

1. [ ] Find skill in master catalog (uuid / name) or design note  
2. [ ] Write/update `content/skills/{id}.json` with correct **hitWindows** + **vfx** + **fleet**  
3. [ ] Map anim to pack role (`magic` / `sword_shield` / …) — never invent Mixamo bones for grudge6  
4. [ ] Bind projectile/AoE to catalog effect ids (orbs, not whole fireball scene)  
5. [ ] `assessWeaponSkillReadiness` / Danger Room cast smoke  
6. [ ] Prefer edit existing Open systems over new parallel skill engines  

---

## 9. Bottom line

- **Weapon skill system** is already the uMMORPG/master → content → fleet pipeline; keep **editing** into that.  
- **Animations** for tome/wand need **magic pack bake** (cast/idle/area) — biggest remaining Unity leftover for casters.  
- **Tome effects** migrate as **effect ids + orbs/beams/novas** on the Open VFX catalog, not Unity particles.  
- Camera/controller improvements land in `Controller` + grudge-physics profiles when Unity feel is better.

Next concrete work after this doc: (1) magic cast bake, (2) Studio cast path reads prefab `castEffectId`, (3) tome mesh GLB.
