# Melee slash FX + Getsuga residual (deterministic)

## What Getsuga is (and is not)

**Getsuga / slash-wave is a melee attack residual** — an animated slash projectile that
extends certain weapon attacks past the blade. It is **not** a free ability and **not**
Alt+Space (or any sandbox hotkey). Space = jump only.

| Job | How |
|-----|-----|
| Extra melee range | Travel **1 m … ~10 m** from weapon tip (per attack profile) |
| Damage collider | `contactRadius` + path ticks along the wave |
| Physical push | Knock/force on path hit + bag/enemy radius damage |
| Visual variety | Color variants (`slashred` / `slashblue` / `slashpurple` / `slashyellow`) + `meshScale` sizes |
| Aim / angle | Spawn at **weapon edge**; dir = grip→tip at the anim hit frame |

## SSOT

| Layer | Module |
|-------|--------|
| Profiles (weapon family × combo stage) | `three/combat/meleeStrikeFx.ts` |
| Hit-frame spawn + push/damage | `Studio.scheduleComboHit` → `Vfx.getsugaSlash` |
| Fleet skill residual ranges | `arsenal/fleetWeaponSkillAdapter.ts` (role 1.5 m … 10 m) |
| Arc render (indexed) | `Vfx.slashArcParam` / `Vfx.playMeleeSlash` |
| Weapon trail (grip→tip) | `Vfx.bladeTrailSegment` + `Studio.swingTimer` |
| Named slash meshes | `models/vfx/slash/slash{red,blue,purple,yellow}.glb` |
| AoE / knock | profile `aoeRadius` + `targets.launch` / path push |

## Example ranges (1H)

| Stage | Range | Variant | meshScale | Role |
|-------|-------|---------|-----------|------|
| light | ~1.15 m | slashblue | 0.55 | short residual / melee extension |
| mid | ~4 m | slashblue | 0.9 | mid wave |
| finisher | ~9 m | slashyellow | 1.35 | long wave |

2H finisher can go **10 m** (slashred, larger contact). Unarmed / shield bash: no wave unless authored.

## Combo stages

- Stage 0 → light (short residual when profile has projectile)  
- Mid stages → mid (+ optional secondary arc + slash_wave)  
- Finisher → heavy arcs + longer wave/bolt + AoE + knock-up  

## No random / no hotkey

- Arc index: profile only  
- Projectile color/size/range: profile only  
- Sandbox Alt+V/B/F/G/T/C only — **no Space Getsuga**  
- Secondary arc: fixed index + delay  

## Authoring

Editor still uses `slashArcParam(index, …)` + localStorage `slashSettings` for per-crescent tweaks.
Combat uses the profiles above; do not call bare `slashArc` for combat if you need stage fidelity.
New melee residual: add `projectile: { kind: "slash_wave", range, variant, meshScale, contactRadius, … }`
on the weapon-stage row in `meleeStrikeFx.ts` only.
