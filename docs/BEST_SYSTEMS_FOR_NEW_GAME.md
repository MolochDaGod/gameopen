# Best systems for the new game (Open / Danger / fleet)

**Policy:** Migrate Unity / uMMORPG **concepts and data** into these production systems. Improve them in place — do **not** invent a parallel combat, skill, camera, or character stack.

---

## 1. Canonical stack (use these)

| Domain | SSOT system | Package / path | Unity lineage |
|--------|-------------|----------------|---------------|
| **Combat state** | `CombatController` + fleet dodge/parry/slide | `@workspace/epicfight` | Epic Fight / action combat |
| **Weapon skills** | Master catalog + content prefabs + `FleetWeaponSkill` | ObjectStore + `content/skills` + epicfight | ScriptableSkill / ScriptableWeapon |
| **Skill cast plan** | `planSkillCast` / family runtimes | `three/ummorpg/skillCastPlan.ts` | Skill.CheckSelf + cast pipeline |
| **Spear family** | `spearCombat.ts` | ummorpg | Madarame / uMMORPG spear |
| **Tome / wand** | `magicCombat.ts` + `doMagicSignature` | ummorpg + Studio | Tome pages / wand spells |
| **Anim packs** | Bip001 packs + AnimationDirector | `grudge6` / `animationDirector` | Animator Controller layers |
| **Characters** | grudge6 modular kits + mesh_ids | CDN FBX + gearPresets | Toon RTS race prefabs |
| **Sockets / equip** | `skeletonSockets` + arsenal mount | ummorpg + Weapons | Hand containers / EquipmentItem |
| **Camera / controls** | Controller + grudge-physics profiles | `Controller.ts` + `@workspace/grudge-physics` | TPS CharacterController feel |
| **VFX / projectiles** | `vfxEffectCatalog` + `deploySandboxVfx` + orbs | `fx/vfxEffectCatalog.ts`, `Vfx.ts`, `effects.ts` | puter panel + skillswrite + ARPG ref |
| **Physics** | Rapier SI (1.8 m human) | `@workspace/grudge-physics` / fleet | Unity colliders → metres |
| **Identity / bag** | Railway Postgres + Grudge ID | production wiring skill | uMMORPG Player data → web accounts |
| **Assets** | R2 CDN + D1 index | assets.grudge-studio.com | Exported FBX/GLB only |

---

## 2. uMMORPG scripts → Open modules (migrated)

| Unity / uMMORPG idea | Open module | Status |
|----------------------|-------------|--------|
| Entity / Npc / Monster prefab | `prefabProfile.ts` | **Adopted** |
| Skeleton + weapon bones | `skeletonSockets.ts` | **Adopted** |
| Animator loco + skill layer | `animationDirector.ts` | **Adopted** |
| ScriptableSkill / Weapon | `scriptableSkills.ts` + master catalog | **Adopted** |
| Spear skills / charge | `spearCombat.ts` + Studio `doSpearSignature` | **Adopted** |
| Tome / wand pages + FX | `magicCombat.ts` + Studio `doMagicSignature` | **New (this pass)** |
| Unified cast planner | `skillCastPlan.ts` | **New (this pass)** |
| Content skill prefabs | `content/skills/*.json` + public copy | **Improved** |
| Fleet skill shape | `fleetWeaponSkillAdapter.ts` | **Improved** |
| Mirror netcode | — | **Deferred** (sandbox first) |
| Auction / mail / guild | — | **Out of scope** |

Import pipeline: `node scripts/import-master-weapon-skills.mjs`  
Migration detail: `docs/UNITY_WEAPON_SKILLS_TOME_MIGRATION.md` · `content/docs/UMMORPG_ADOPTION.md`

---

## 3. How a skill cast should flow (new code)

```
Input 1–4 / F
    → Studio.trySkill / signature
    → planSkillCast(weaponId, slot)     // ummorpg/skillCastPlan
    → family path:
         spear  → doSpearSignature
         tome|wand → doMagicSignature   // orbs / nova / beam
         staff kits → existing elemental / ice / soulbinder
         else → T0 kind + vfx.playSkill
    → CombatController damage (sparringBlast / applyAttack)
    → Vfx catalog (orbs, never whole fireball.glb)
```

**Gates (uMMORPG CheckSelf):** cooldown · mana/stamina · range — `canCastSkill` / `canExecuteCastPlan`.

---

## 4. Best defaults by weapon

| Weapon | Path | Anim pack | Notes |
|--------|------|-----------|-------|
| sword / dagger / axe | T0 + fleet slash | sword_shield | Getsuga slash meshes |
| spear | spearCombat | polearm | Charge / lunge MM |
| bow | ranged primary + T0 | longbow | Slot1 = primary shot |
| staff* | staff kits / elemental | magic | Keep special kits |
| **tome** | **magicCombat** | magic | Flame Wave → Divine Wave |
| **wand** | **magicCombat** | magic | Missile → Meteor |
| gun | gunClass | rifle | Tier pattern |
| heavy 2H | heavyWeaponCombat | polearm | Madarame / annihilate |

---

## 5. What **not** to use for the new game

| Avoid | Prefer |
|-------|--------|
| Second CombatController fork | epicfight fleet |
| Hard-coded skill trees in random UI files | master catalog + content prefabs |
| Whole `fireball.glb` as projectile | `models/vfx/orbs/*` |
| Link **grudge-vfx.puter.site** (404) | **vfxgrudge.puter.site** or **vfx.grudge.studio** |
| Mixamo bone names on grudge6 | Bip001 |
| Unity `.prefab` / particle systems in browser | GLB + Vfx ops |
| Meshy full-body race replace | mesh_ids kit + Meshy closed armor only |
| Per-mode localStorage controls keys | `grudge:controls` |

---

## 6. Agent checklist (shipping a feature)

1. Load skills: `grudge-fleet-combat`, `grudge6-combat-runtime`, `grudge6-modular-characters`  
2. Put design data in master / content prefab — not only Studio private fields  
3. Family runtime if cast shape is special (spear, magic, heavy)  
4. SI metres, 1.8 m human  
5. Wire Danger Room smoke: equip weapon → 1–4 cast → VFX + hit  
6. Document in this file or the Unity migration doc if policy changes  

---

## 7. Immediate next polish

| P | Item |
|---|------|
| P0 | Done: magicCombat + Studio doMagicSignature + cast plan |
| P1 | Bake `magic/cast`, `magic/idle`, `magicArea` (Bip001) |
| P1 | Dedicated tome book GLB |
| P1 | Host `FleetCombatHost` path reading fleet projectile meshPath |
| P2 | Export high-value Unity ARPG FX → R2 catalog ids |
| P2 | Harvest pack bake |

---

## 8. Related docs

- `docs/CANONICAL_COMBAT.md`
- `docs/CONTROLS_CAMERA_WEAPON_SSOT.md`
- `docs/UNITY_TO_OPEN_ASSET_MIGRATION.md`
- `docs/UNITY_WEAPON_SKILLS_TOME_MIGRATION.md`
- `content/docs/UMMORPG_ADOPTION.md`
- `docs/UMMORPG_ENGINE_PRACTICES.md`
