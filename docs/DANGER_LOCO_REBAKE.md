# Danger Room locomotion re-bake (24 heroes)

## Symptoms (fixed)

| Bug | Cause | Fix |
|-----|--------|-----|
| Walk **leaning / tipping** | Pack walk → `locomotion/walking` (bad rest pose on Arena Bip001) | Pack walks → `magic/Standing Walk Forward` / `longbow/standing walk forward` |
| Feet **underground** | Height fit on bind pose only; walk hips drop soles | Post-idle pose re-ground + FootGrounder beginFrame/apply |
| Run is **roll** | `locomotion/running` is run-to-roll (~2.5s, pelvis first≠last) | Ban list + pelvis-loop reject; sprint = clone of true run cycle |

## 24 heroes

6 races × 4 combat presets (mage / knight / ranger / warrior) share the **same** rotation-only pack clips:

| Preset | Anim pack | Walk | Run |
|--------|-----------|------|-----|
| mage | magic | Standing Walk Forward | Standing Run Forward |
| knight | sword_shield | Standing Walk Forward | sword and shield run |
| ranger | longbow | standing walk forward | standing run forward |
| warrior | polearm | polearm/walk | polearm/run |
| (+ unarmed traveler) | unarmed | Standing Walk Forward | torch run forward |

Sprint is **never** a separate roll clip — it is `run` cloned at **1.75×**.

## Code SSOT

| Repo | File |
|------|------|
| Open (Danger Room) | `artifacts/animator/src/three/grudge/anims.ts` |
| Open runtime | `artifacts/animator/src/three/grudge/grudge6Runtime.ts` |
| Arena | `src/bakedAnimLoader.js` |

## Local remade clips (Open same-origin)

Shipped under `artifacts/animator/public/anims/baked/`:

- `magic/Standing Walk Forward.json`
- `magic/Standing Run Forward.json`
- `longbow/standing walk forward.json`
- `longbow/standing run forward.json`
- `sword_shield/sword and shield run.json`
- `uploads_2026_06/locomotion/torch run forward.json`
- `polearm/*` (Madarame)

Loader prefers **same-origin** before Arena CDN so Danger always gets the remade packs after deploy.

## Verify

1. Hard refresh Open Danger: `?door=danger` (clear clip cache).
2. Walk — upright torso, feet on floor.
3. Run / sprint — forward cycle, **no** somersault/roll.
4. `npx vitest run src/three/grudge/anims.loco.test.ts`
5. Arena: `npm test` path tests + anim-test gait slider.

## Banned paths (never map walk/run/sprint)

- `locomotion/running`
- `uploads_2026_06/locomotion/running`
- `locomotion/walking`
- `uploads/locomotion/Quick_Roll_To_Run`
