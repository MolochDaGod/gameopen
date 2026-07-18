# Status aura / buff / debuff VFX

**Code:** `artifacts/animator/src/three/fx/StatusFx.ts`  
**Types:** `StatusId` in `three/types.ts`  
**HUD:** status chips via `StatusController.views()`  
**Apply:** `Studio.applyStatus(id, aoe?)` → ability lifecycle → `applyStatusScoped`

## Reference look

Inspired by commercial itch-style **body aura packs** (translucent silhouettes, swirl energy, elemental shells — e.g. fire/ice/electric/shield/sleep/absorb loops) plus BinbunVFX-style ground footprints.

No external GLB required — fully procedural three.js.

## Visual layers (per active status)

| Layer | Role |
| --- | --- |
| **Body shell** | Capsule + head + outer rim, additive tint, breathing scale |
| **Swirl ribbons** | Torus energy loops spinning around torso |
| **Bubble** | Shield / absorb sphere (+ wireframe accent) |
| **Ground rune** | Textured magic circle + soft disc |
| **Particles** | Style-driven: rise / orbit / spark / bubble crawl / vortex / sleep Z |
| **Point light** | Pulsing status color |
| **Cast burst** | Short flash on apply / skill wind-up (`playCastBurst`) |

## Catalog

| Id | Kind | Style | Notes |
| --- | --- | --- | --- |
| `burning` | debuff | rise | Fire staff impact |
| `frozen` | debuff | orbit | Ice staff |
| `poisoned` | debuff | rise | Nature staff |
| `shocked` | debuff | spark | Storm staff |
| `regen` | buff | rise | Heal |
| `empowered` | buff | rise | Power buff |
| `shielded` | buff | bubble | Barrier |
| `haste` | buff | spark | Speed |
| `blessed` | buff | spark | Holy staff self |
| `cursed` | debuff | vortex | Dark drain |
| `sleep` | debuff | sleep | Z-puffs above head |
| `absorb` | buff | bubble | Magenta absorb shell |
| `rage` | buff | rise | Red fury |
| `rooted` | debuff | orbit | Brown bind |

## Runtime API

```ts
status.apply("burning");                    // self / default
status.applyAll("regen", [() => ally.pos]); // multi-target
status.playCastBurst(0xff6a1e, 0.5);        // cast tell only
status.update(dt, playerFeet);
status.views();                             // HUD chips
```

Element themes (`arsenal/elements.ts`) map staff schools → status ids.

## Dock / UI

`STATUS_MENU` feeds the tap-to-apply status dock (buffs/debuffs). New ids appear automatically.
