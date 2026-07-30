# Danger Room AI Play-testers

**Surface:** https://open.grudge-studio.com/danger  
**Worker:** https://danger-ai.grudge-studio.com (same-origin `/api/danger-ai/*`)  
**Code:** `artifacts/animator/src/playtest/`  
**Tools:** `run_playtest_suite`, `playtest_locomotion_health`, `playtest_nav_math`  
**Grok skill:** `danger-playtesters` (user skills)

## What they are

Headless + live **AI QA workers** for iterative development of:

| Suite | Checks |
|-------|--------|
| **locomotion** | Sprint ≠ run-to-roll, pack gait bans, mobility roles, never-alias-to-attack, blend windows |
| **pathfinding** | Grid A*, unreachable, SI 1.8 m, Yuka/Rapier stack notes |
| **blend-math** | Cross-fade weights, smoothstep, quat double-cover, sprint mult |
| **combat-mm** | 4-slot packs, bakedRole, MM distance, slash_wave projectiles |
| **danger-e2e** | 30 heroes matrix, live clip probe, controller/rapier hooks |

## How to run

### CI / CLI

```bash
cd C:\Users\nugye\Documents\gameopen\artifacts\animator
npm test -- src/playtest/playtest.test.ts
# or full suite via vitest
npm test -- src/playtest/
```

### Danger Room Master (chat)

1. Open `/danger` → bottom-right AI dock  
2. **Agents** tab → Playtester · Locomotion / Nav / E2E  
3. Or chat: `run playtest suite` / `locomotion health`  

Tools execute in the **browser** against live Studio when hooks are wired.

### Agent loop (recommended)

```
run_playtest_suite suite=all
  → read FAIL/WARN + fixHint paths
  → set_param | preview_animation | unique_movement | edit packs
  → re-run suite
  → bake Mixamo per content/anims/bake-plan.json when mobility is placeholder
  → npm run deploy:prod when green
```

## Three.js / fleet stack (use these)

| Package | Role |
|---------|------|
| `three` | Scene, mixer, GLTF |
| `@dimforge/rapier3d` | Physics SI 1/60 |
| `three-mesh-bvh` | Mesh queries |
| `yuka` | Steering / follow-path for NPCs |
| `@workspace/epicfight` | Combat rules (not rendering) |
| postprocessing | Bloom etc. (Studio composer) |

**Do not** add Cannon-ES for Danger or fork CombatController.

## Key files

| Path | Role |
|------|------|
| `src/playtest/index.ts` | `runPlaytestSuite` / `runPlaytestText` |
| `src/playtest/suites/*` | Suite implementations |
| `src/ai/dangerTools.ts` | Chat tools |
| `infra/cloudflare/danger-ai/src/knowledge.js` | Worker specialist prompts |
| `content/anims/bake-plan.json` | Mixamo → bake queue |
| `three/grudge/anims.ts` | Loco SSOT + MOBILITY_CLIPS |

## Deploy danger-ai worker after knowledge edits

```bash
cd C:\Users\nugye\Documents\gameopen\infra\cloudflare\danger-ai
npx wrangler deploy
curl -s https://danger-ai.grudge-studio.com/health
```
