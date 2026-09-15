# Foot aura SSOT — CraftPix Magic Buff Effects (top-down)

## Pack

| Item | Value |
|------|--------|
| Zip | `Documents/craftpix-net-207889-magic-buff-effects-pack-for-top-down-games.zip` |
| Preview | https://img.craftpix.net/2026/07/Magic-Buff-Effects-Pack-for-Top-Down-Games2.webp |
| License | https://craftpix.net/file-licenses/ |
| Runtime | `public/vfx/craftpix-magic-buff/` (animator artifact) |
| Code | `@workspace/vfx` → `footAura.ts` + `footAuraCatalog.ts` |

## Effects

| Id | Frames | Kind | Icon |
|----|--------|------|------|
| `strength` | 12 | buff | Icons_Strength_Buff |
| `debuff` | 16 | debuff | Icons_Debuff |
| `immunity` | 16 | buff | Icons_Immunity |
| `life` | 12 | heal | Icons_Life_Recovery |
| `mana` | 12 | heal | Icons_Mana_Recovery |
| `revival` | 16 | utility | Icons_Revival |

Frames: **640×800** PNG sequence (`*_Frame_01…N.png`) — painted **ground ring + upright FX** for top-down.

## Correct angle (3D SI)

| Mode | Transform | Use when |
|------|-----------|----------|
| **`ground`** (default) | `mesh.rotation.x = -Math.PI / 2` on XZ at feet | Under-feet ring; elevated TPS / top-down |
| **`yBillboard`** | Upright plane, yaw → camera | Low camera; need painted spikes readable |
| **`hybrid`** | Ground full + softer vertical billboard | Best of both |

Also:

- **Y lift** `+0.03 m` (avoid terrain z-fight)
- **depthWrite: false**, **AdditiveBlending**, `renderOrder` low so body draws over aura
- **World-yaw lock** (default): counter-rotate so ring doesn’t spin with hero turns
- Diameter **~1.5–1.7 m** (SI human ~1.8 m)

Do **not** use full camera billboard for under-feet rings (stands vertical, leaves feet).

## Deploy (gameopen / Open)

1. **SSOT public tree (Vite / Vercel build):**  
   `artifacts/animator/public/vfx/craftpix-magic-buff/`  
   Served same-origin as `/vfx/craftpix-magic-buff/...` on open.grudge-studio.com.
2. Build path: `scripts/vercel-build.mjs` → animator Vite → `dist/public` includes that folder.
3. Status FX integration (warlords **and** voxel explorer):  
   `StatusController` / `StatusAura` in `src/three/fx/StatusFx.ts` + `craftpixFootRing.ts`.  
   Any buff applied via `studio.status.apply(id)` draws the CraftPix ring under the
   character root (GrudgeAvatar, Character GLB, ExplorerCharacter / voxel).

### Status → foot aura map

| StatusId | CraftPix id |
|----------|-------------|
| empowered, rage | strength |
| burning, poisoned, cursed, frozen, shocked, rooted, sleep | debuff |
| shielded, absorb | immunity |
| regen, blessed | life |
| haste | mana |

### HUD

`StatusView.iconUrl` → CraftPix Icons; `StatusBar` prefers icon image over glyph.

### Direct FootAuraSystem (optional)

```ts
import { attachFootAuraSystem } from "@workspace/vfx";

const auras = attachFootAuraSystem(characterRoot, {
  assetBase: "", // same-origin
  orient: "ground", // or "hybrid" for TPS
});
await auras.preload();
await auras.apply({ id: "strength", duration: 12 });
auras.update(dt, camera);
```

## Re-extract

```powershell
# PNG only from zip → artifacts/animator/public/vfx/craftpix-magic-buff
```

Do not invent alternate aura sprite packs; extend this catalog.
