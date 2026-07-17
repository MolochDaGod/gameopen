# Melee slash FX (deterministic)

## Problem fixed

`Vfx.glbSlash` used `Math.random()` to pick crescents from `attack-slashes.glb`, so the same combo looked different every hit. That is removed.

## SSOT

| Layer | Module |
|-------|--------|
| Profiles (weapon family × combo stage) | `three/combat/meleeStrikeFx.ts` |
| Arc render (indexed) | `Vfx.slashArcParam` / `Vfx.playMeleeSlash` |
| Weapon trail (grip→tip) | `Vfx.bladeTrailSegment` + `Studio.swingTimer` |
| Projectiles | `Vfx.slashWave` / `Vfx.bolt` from profile |
| AoE / knock | profile `aoeRadius` + `targets.launch` |

## Arc index

Meshes from `models/vfx/attack-slashes.glb` are sorted **alphabetically by name** once at load. Profile `arcIndex` always maps to the same mesh.

## Combo stages

- Stage 0 → light  
- Mid stages → mid (+ optional secondary arc + slash_wave)  
- Finisher → heavy arcs + wave/bolt + AoE + knock-up  

## No random

- Arc index: profile only  
- Roll / flip: authored `rotate` / `direction` only  
- Secondary arc: fixed index + delay  

## Authoring

Editor still uses `slashArcParam(index, …)` + localStorage `slashSettings` for per-crescent tweaks. Combat uses the profiles above; do not call bare `slashArc` for combat if you need stage fidelity.
