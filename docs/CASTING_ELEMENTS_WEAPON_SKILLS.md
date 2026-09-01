# Casting elements → Warlords weapon skills

**Status:** migration SSOT  
**Source:** CastingAbilitiesThreeJS (path cast + 4 elements + beauty VFX)  
**Target:** Grudge Warlords / Danger staffs (`FleetWeaponSkill` + `SkillPack`)  
**Code:** `artifacts/animator/src/three/grudge/castingElementSkills.ts`

## Goal

Import **cast / travel / impact** phase mapping and **magic Bip001 cast anims** from the Casting sandbox into **Warlords staff weapon skills**, and add an **arcane** tree (purple + explosive + wind-like).

Do **not** port freehand path-draw as combat SSOT. Map phases:

| Casting phase | Warlords field |
|---------------|----------------|
| Cast tell / hand | `castEffectId` |
| Path travel head | `projectile` + travel effect id |
| Path end | `impactEffectId` + optional `aoeRadius` |
| Cast body anim | `animClip` / `animRole: cast` (`magic` pack) |

## Element → staff weapon

| Casting element | Effect ids (cast / travel / impact) | Warlords `weaponId` |
|-----------------|--------------------------------------|---------------------|
| fire | fire_hand / fireball / inferno | `staffFire` |
| water | arcane_swirl / moon_beam / frost_wave | `staffIce` |
| earth | earth_surge ×3 | `staffNature` |
| wind | arcane_swirl / chain_lightning / ice_lightning_burst | `staffStorm` |
| **arcane** | arcane_swirl / chain_lightning / inferno (+ purple slash) | `staff` |

## Hotbar (4 skills each)

Shared pattern: bolt → wave/nova → path/area → ultimate.

| Slot | Role | Anim |
|------|------|------|
| 1 | Primary | `magic/standing 1h cast spell 01` |
| 2 | Special | `magic/staffattack` |
| 3 | Ranged/area | cast clip |
| 4 | Power | staffattack / cast |

Arcane labels: **Arcane Bolt · Arcane Gale · Void Burst · Storm Arcane**.

## How hosts load

```ts
import { skillPackForStaffWeaponId, castingElementToFleetRows } from
  "../grudge/castingElementSkills";
import { skillPackForWeaponId } from "../grudge/weaponSkillPacks";

// Warlords equip staffFire:
const pack = skillPackForWeaponId("staffFire");

// Or build FleetWeaponSkill rows:
const fleet = castingElementToFleetRows("arcane", "staff");
```

CastingAbilities local mirror: `src/combat/elementWeaponSkills.js` + `?arcane=1` for purple tree.

## What stays different

| CastingAbilities | Warlords |
|------------------|----------|
| Freehand path draw | Aim lock / beam or bolt projectile |
| Ability volume shaders | Host Vfx + projectile mesh |
| Visual-only | Damage + CC + range gates |

## Checklist before ship

- [x] Host resolves `castEffectId` / `impactEffectId` in Vfx catalog (`deploySandboxVfx` + Studio `doFleetStaffSkill` / Grudge6CombatCharacter)
- [x] Magic pack Bip001 clips: same-origin `public/anims/baked/magic/standing 1h cast spell 01.json` + CDN `staffattack.json`; role `cast` aliased in grudge6Runtime
- [x] Equip / hotbar: `skillPackForWeaponId` + `t0SignatureSkills` staff trees + Studio loadout rebind
- [x] Damage/range via fleet SkillPack + sparringBlast — not Casting path volumes
- [ ] Staff mesh grip from arsenal (not only modular kit)  
- [ ] `assessWeaponSkillReadiness` green  
- [x] No second combat controller — use fleet CC host  

## Live hotbar bind

| Equip `weaponId` | Hotbar tree |
|------------------|-------------|
| `staffFire` | Fire Bolt · Flame Wave · Meteor Path · Inferno |
| `staffIce` | Water Lash · Frost Wave · Moon Beam · Blizzard Shell |
| `staffNature` | Earth Spike · Quake Surge · Stone Path · Tectonic Burst |
| `staffStorm` | Wind Bolt · Gale Nova · Chain Storm · Tempest |
| `staff` / wand / tome | Arcane Bolt · Arcane Gale · Void Burst · Storm Arcane |

API: `skillPackForWeaponId("staffFire")` · Studio equip rebinds via `t0SignatureSkills`.
