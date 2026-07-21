# Production game world — rules, AI training, deploy QA

**Status:** SSOT for playable fleet worlds (2026-07)  
**Skill:** `grudge-production-world`  
**Code:** `artifacts/animator/src/three/world/productionWorldRules.ts` · `worldMeshDeploy.ts`

---

## Goal

The fleet already has **assets, scripts, concepts, and boss combat** for a complete game.
What we build and test now is only the **real deployed game world**:

1. **Deployment rules** — every node has mesh, layer, collider, location, id  
2. **Terrain rules** — SI metres, walkable slopes, heightfield preference, navmesh  
3. **Water rules** — Water layer, swim surface, valid columns for fish/boats  
4. **AI patterns** — density, corridors, boss arena clear, spawn separation, allow-gates  
5. **QA only on production** — `open.grudge-studio.com` + CDN verify  

Localhost is for implementation. **“World ready” requires a live URL.**

---

## Architecture

```
Shell GLB (CDN/R2)     looks / height / water volume
     +
Archetype kit          what MAY appear (nature, ore, animals, NPCs, bosses)
     +
Seed                   deterministic which / where
     +
Runtime                Rapier layers, navmesh, water, boss AI, harvest
     =
PLAYABLE PRODUCTION ISLAND / SECTOR
```

Archetypes: `home | mountain | volcanic | tropical | plains | boss | event | hellmaw`  
Hellmaw south sector: **`s`** (Hellmaw Depths) — Shadow Flame Mantis + Ash Ghasts.

---

## Rule tables (code SSOT)

| Domain | Constant | Highlights |
|--------|----------|------------|
| Terrain | `TERRAIN_RULES` | 1 m unit, step ≤ 0.4 m, slope ≤ 45°, heightfield preferred, shell &lt; ~6 MB |
| Water | `WATER_RULES` | layer Water, min depth 0.6 m, wade 0.9 m, valid columns only |
| AI | `AI_WORLD_PATTERNS` | corridor ≥ 2.5 m, arena ≥ 14 m, spawn sep ≥ 3.5 m, density / 100 m² |
| Gates | `gateWorldNode` | cdn mesh, physics, collider, location, scale, boss allow-gate |
| Report | `productionWorldReport()` | all Hellmaw nodes pass/fail |
| Context | `isProductionTestContext` | reject localhost-only sign-off |
| Train AI | `AI_WORLD_TRAINING_PROMPT` | embedded in Worldbuilder AI system prompt |

Physics layers: `Default | Terrain | Player | NPC | Item | Projectile | Trigger | Water | IgnoreRaycast | UI3D`

---

## Production test surfaces

| Surface | URL |
|---------|-----|
| Open | https://open.grudge-studio.com |
| Play | https://open.grudge-studio.com/play |
| Danger / worlds | https://open.grudge-studio.com/danger |
| Voxel worldbuilder | https://open.grudge-studio.com/voxel |
| CDN | https://assets.grudge-studio.com |

```bash
cd C:\Users\nugye\Documents\gameopen
npm run verify:assets:cdn
npm run deploy:prod
npm run verify:assets:open
# Then play sailtest / island-life / sector hellmaw with real SSO
```

Animator unit gates:

```bash
cd artifacts/animator
npm test -- src/three/world/productionWorldRules.test.ts src/three/boss/volcanoBossCatalog.test.ts
```

---

## Agent / human workflow

1. Load skills: `grudge-studio` → **`grudge-production-world`** → `grudge-world-scale` → `grudge-character-correctness` → `grudge-live-servers`  
2. Pick archetype + sector + seed (not a one-off map type)  
3. Shell on CDN (HEAD magic bytes)  
4. Content via kit + seed + full `WorldMeshNode`  
5. `gateWorldNode` / `productionWorldReport` — zero fails  
6. Deploy Open if client changed  
7. QA on **production URL**  
8. Only then mark world ready  

---

## Related docs

- [VOLCANO_WORLD_BOSS.md](./VOLCANO_WORLD_BOSS.md) — Mantis / Ghast combat  
- [SEED_WORLD_DEPLOY.md](./SEED_WORLD_DEPLOY.md) — seeds / map chunks  
- [ISLAND_LIFE.md](./ISLAND_LIFE.md) — survival island  
- [FLEET_ASSET_DEPLOYMENT.md](./FLEET_ASSET_DEPLOYMENT.md) — CDN rewrites  
- [AGENT_WORK_CONTRACT.md](./AGENT_WORK_CONTRACT.md) — finish SSOT, name real host  

---

## Kill list

- “Works on localhost” as production sign-off  
- Git megameshes as the only prod path  
- Fitting world props to 1.8 m character height  
- World bosses on home/plains without allow-gate  
- Navmesh through deep water without Swim  
- Meshy / capsules as production heroes  
