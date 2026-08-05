# Games-framework → Grudge fleet runtime

**Source of patterns:** [benvanik/games-framework](https://github.com/benvanik/games-framework) (GF)  
**What we did *not* do:** Vendor Closure, anvil-build, or GF as a second engine.  
**SSOT package:** `@workspace/grudge-runtime` (`lib/grudge-runtime`)

## Mapping

| GF module | Fleet SSOT | Notes |
|-----------|------------|--------|
| `gf.Game` fixed timestep + focus | `FleetGameLoop` | `fixedDt≈1/60`, max wall 0.25s, pause when `document.hidden` |
| `gf.input.InputManager` | `InputActionMap` + `FLEET_DEFAULT_BINDINGS` | Named actions, not raw key sprawl |
| Mouse lock | `requestPointerLock` / existing `pointerPresence` | Physics package still owns combat pointer UX |
| Audio banks | Kenney + existing audio skills | Later pass — do not invent a second bank |
| Asset pipeline | `grudge-asset-config` / CDN / convert skills | GF content pipeline ≠ our R2/D1 |

## Contract version

`GRUDGE_RUNTIME_CONTRACT = 1.1.0` — adds game loop + input actions.

## Per-host wire status

| Host | Loop | Input map |
|------|------|-----------|
| **Open** `@workspace/grudge-runtime` | Exported + BrawlerScene fixed 1/60 | Package ready; InputState remains Danger combat SSOT |
| **VoxGrudge** openworld | `js/fleet-game-runtime.js` → `fleetLoop` | `fleetInput` + `keyIs` bridge |
| **Mine-Loader** voxelcraft | Fixed 1/60 in `voxelEngine.animate` | `src/lib/fleetGameRuntime.ts` available |
| **z-brawl** | Script loaded; animate can opt-in | Same JS global |
| **Other fleet hosts** | Import `createGameLoop` from `@workspace/grudge-runtime` or copy `fleet-game-runtime.js` | Prefer package in TS apps |

## How to adopt on a new game

### TypeScript monorepo (gameopen / Mine-Loader style)

```ts
import { createGameLoop, createInputActionMap } from "@workspace/grudge-runtime";

const input = createInputActionMap();
const loop = createGameLoop({
  fixedDt: 1 / 60,
  shouldUpdate: () => !paused,
  onUpdate: (f) => sim.step(f.dt),
  onRender: () => renderer.render(scene, camera),
});
loop.start();
```

### Static HTML (Vox / arcade)

```html
<script src="js/fleet-game-runtime.js"></script>
<script>
  const input = FleetGameRuntime.createInputActionMap();
  const loop = FleetGameRuntime.createGameLoop({
    onUpdate: (f) => tick(f.dt),
    onRender: () => renderer.render(scene, camera),
  });
  loop.start();
</script>
```

## Anti-fork rules

- Do **not** add a parallel `GameLoop2` or second physics step owner.
- Do **not** rebind combat residuals to free hotkeys (fleet combat SSOT).
- Keep Three.js + Rapier as gameplay/render/physics; this module only owns **clock + action names**.

## Verify

```bash
cd lib/grudge-runtime && npm test
# Vox live: hard-refresh voxgrudge.vercel.app — console FleetGameRuntime.version === "1.1.0"
```
