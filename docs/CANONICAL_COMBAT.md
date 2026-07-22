# Canonical fleet combat (Open · Voxel · Warlords)

**Package:** `@workspace/epicfight`  
**Fleet SSOT:** `@workspace/epicfight` → `combat/fleet` (or import from package root)

This is the **single controller and ruleset** for player combat across:

| Surface | Host |
|---------|------|
| Open / Danger Room | `gameopen` → `artifacts/animator` Studio |
| Voxel games | same epicfight CC + fleet rules |
| Warlords / warstrat | same CC + skill schema |
| RTS-Grudge battle | same when wiring hero combat |

Do **not** re-implement dodge math, parry windows, slide trip rules, or weapon-skill shape in each app.

---

## Core pieces

### 1. State machine — `CombatController`

- Health, stamina, poise, attack / dodge / **parry** / block / stun / fallen
- `applyAttack(payload)` → pure `resolveDefense` (block / parry / dodge outcomes)
- `unparryable` payload flag → slide trips break parry into **fallen**

### 2. Fleet constants — `combat/fleet/constants.ts`

| Export | Meaning |
|--------|---------|
| `FLEET_COMBAT_INPUT` | KeyC parry, KeyX dodge, Alt slide, KeyE block, … |
| `FLEET_DODGE` | 40% stam cost, 0.5 m min / 4.9 m max |
| `FLEET_SLIDE` | trip / block-stop / parry-break |
| `FLEET_PARRY` | perfect / fail debt / uppercut package |
| `FLEET_STAMINA_COST` | jump, stab, throw, uppercut, … |
| `FLEET_SLASH_*` | slashred/blue/purple/yellow mesh paths |

### 3. Pure rules — `combat/fleet/rules.ts`

- `planDodge(cur, max)` → `{ distance, cost, short }`
- `resolveSlideContact(state)` → trip | blocked | parryBreak
- `planFailedParryStamina()` → 2 s recover debt
- `slashVariantForStage(stage)`
- `parryClipsForSide(side)`

### 4. Weapon skills — `combat/fleet/weaponSkill.ts`

Every skill is a **`FleetWeaponSkill`**:

| Field group | Fields |
|-------------|--------|
| Identity | `id`, `weaponId`, `slot` 0–3, `label`, `role` |
| Animation | `animClip`, `animClipEnd`, `animRole`, `combo.stages[]` |
| Mesh + collider | `meshPath`, `collider` (sphere/capsule/box), `attachToHand` |
| VFX | `castEffectId`, `impactEffectId`, `trailColor`, `projectile` |
| Timing | `cooldown`, `castDuration`, `activeDuration`, `staminaCost` |
| Damage | `damage`, `poiseDamage`, `force`, `shieldBreak`, `unparryable` |

Use `assessWeaponSkillReadiness(skill)` before shipping a kit.

### 5. Host adapter — `combat/fleet/host.ts`

Implement `FleetCombatHost` once per game (anim play, dash, hitHostiles, spawnVfx, skills).  
Use `fleetPlayerCombatPatch()` when building the player `CombatConfig`.

---

## Input map (canonical)

| Action | Code | Behaviour |
|--------|------|-----------|
| Parry | **C** | Timed window; success → rebound + stun + uppercut launch; fail → full dmg + 2 s stam recover |
| Dodge | **X** | Stam-scaled roll; 40% max stam; min 0.5 m if &lt;15% stam |
| Slide | **Alt** | Trip; unparryable; block stops slider 0.2 s; breaks parry → knockdown |
| Block pulse | **E** | Forcefield guard |
| Stab | **Z** | Physical stam cost |
| Jump | **Space** | Stam cost (double jump higher) |
| Skills | **1–4 / F** | From `FleetWeaponSkill` kit |

Alt+letter still sandbox VFX; Alt alone = slide.

---

## Weapon skill production checklist

For each skill before “ready”:

1. [ ] Baked anim clip on CDN / public  
2. [ ] `meshPath` if skill spawns mesh  
3. [ ] `collider` sized in metres (SI, 1.8 m human)  
4. [ ] `castEffectId` + `impactEffectId` (or projectile)  
5. [ ] `cooldown` + `staminaCost`  
6. [ ] Combo stages if multi-hit  
7. [ ] `assessWeaponSkillReadiness` → `ok: true`  

Slash projectiles: production meshes  
`models/vfx/slash/slash{red,blue,purple,yellow}.glb` (+ ice-bow fallback).

---

## Wiring a new game

```ts
import {
  CombatController,
  defaultCombatConfig,
  fleetPlayerCombatPatch,
  planDodge,
  FLEET_COMBAT_INPUT,
  type FleetWeaponSkill,
  type FleetCombatHost,
} from "@workspace/epicfight";

const playerCC = new CombatController(
  defaultCombatConfig(fleetPlayerCombatPatch()),
  { id: "player", light: [], heavy: [] },
);

// On dodge input:
const plan = planDodge(playerCC.getStamina(), cfg.maxStamina);
playerCC.drainStamina(plan.cost);
// host.dash(dir, plan.distance, …)
```

Open reference implementation: `artifacts/animator/src/three/Studio.ts` + `combatCuts.ts` + `combatModel.ts`.

---

## Versioning

- Pure rules change → bump epicfight consumers + retest Open Danger Room  
- Do not fork dodge/parry/slide constants into Warlords JSON without importing SSOT  
