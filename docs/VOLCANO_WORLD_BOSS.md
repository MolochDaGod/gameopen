# Volcano world boss — Shadow Flame Mantis + Ash Ghast

## Assets (baked)

| Unit | Source | Production path | Size (prod) |
|------|--------|-----------------|-------------|
| **Shadow Flame Mantis** | `D:\Games\Models\shadow_flame_mantis (1).glb` | `public/models/bosses/shadow-flame-mantis.prod.glb` | ~2.2 MB meshopt |
| **Ash Ghast** | `D:\Games\Models\minecraft_realistic_ghast.glb` | `public/models/enemies/volcano/minecraft-ghast.prod.glb` | ~0.76 MB meshopt |

Source copies kept as `.glb` without `.prod` for re-bake.

### Animations learned

**Mantis**

| Clip | Role |
|------|------|
| Idle | Stance |
| Walk / Run | Chase |
| Grabbing Munch | Melee grab |
| Rushing Charge | Gap-close charge |
| Flaming Upper Stab | Melee |
| **Shadow Call** | **Smoke VFX + spawn 2 Ash Ghasts** |
| Burning Slice | Melee AoE |
| Nuclear Slice | Ultimate (low HP) |

**Ghast**

| Clip | Role |
|------|------|
| Idle | Hover |
| Fire | Ranged fireball |

## Scale (1.8 m human yardstick)

| Unit | heightM | × human |
|------|---------|---------|
| Mantis boss | **3.2 m** | ~1.8× |
| Ash Ghast | **2.4 m** | ~1.3× |

## Boss AI

Code: `artifacts/animator/src/three/boss/`

- `volcanoBossCatalog.ts` — SSOT ids, allow-gates, ability CDs
- `ShadowFlameMantisBoss.ts` — chase + ability FSM
- `VolcanoGhastMinion.ts` — kite + Fire projectile
- `VolcanoWorldBossSystem.ts` — spawn on allowed islands/sectors

### Shadow Call

1. Play clip `Shadow Call`
2. `Vfx.smokeColumn` + dual `smokePop` (dark flame)
3. Spawn **2** `VolcanoGhastMinion` offset left/right
4. CD **22 s**; max ~4 summons

### Nuclear Slice ultimate (vfxgrudge **O** meteor + **D/A** shockwave)

1. Play `Nuclear Slice`
2. **Two light meteors** start opposite on a circle (radius 7 m) around the boss
3. **Warning circles** under each impact zone (`auraRing`); markers pulse along the arc
4. Orbit **half circle** (π) over ~2.4 s — each ends where the other began
5. Lightweight sky-drop (`bolt` + `blastImpact` + shockwave) — no heavy meteor GLB
6. **While ultimate runs:** pulse shockwave; anything **≤ 1 m** from boss takes damage + **knockback**

### Ash Ghast fire (vfxgrudge **C** fireball)

1. **1.5 s cast** — cast aura + ground ring
2. **Fireball** bolt toward player
3. **2.0 s cone** — `flameCone` ticks every 0.25 s (forward arc damage)

## World mesh production deploy

See `src/three/world/worldMeshDeploy.ts`:

- layers · colliders · UUID · sector location · size vs 1.8 m human
- `HELLMAW_WORLD_NODES` production pins for mantis + ambient ghasts

## Where it spawns

| Context | Gate |
|---------|------|
| **Hellmaw Depths** sector `s` | default pin `HELLMAW_WORLD_BOSS_SPAWN` |
| Island archetype **volcanic** / tags `volcanic` | allowed |
| Island archetype **boss** / tags `boss_event` | allowed |
| Event islands | allowed |

```ts
import { VolcanoWorldBossSystem } from "./three/boss";

const sys = new VolcanoWorldBossSystem(scene, vfx, {
  flash, damagePlayer, onBossDeath,
});
await sys.spawnIfAllowed({
  sectorId: "s",           // Hellmaw
  archetype: "volcanic", // or "boss"
  eventTags: ["boss_event"],
  origin: islandOrigin,
});
// each frame:
sys.update(dt, playerWorldPos);
```

## Island event catalog

`islandEventCatalog.ts` units:

- `shadow_flame_mantis` (event_elite / world_boss tags)
- `volcano_ghast` (event_hostile / summon)

JSON mirror: `public/content/enemies/volcano-bosses.json`

## License note

Sketchfab CC-BY-NC / CC-BY-NC-SA (ArachnoBoy / Aiden Vang) — keep attribution in ship docs; not for pure commercial resale of the mesh alone.
