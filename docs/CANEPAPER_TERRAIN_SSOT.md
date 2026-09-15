# Canepaper / CodePen terrain SSOT (voxel era)

## Source (reference only)

| Item | URL |
|------|-----|
| CodePen | https://codepen.io/Canesugar/pen/NPRNwxo |
| GitHub | https://github.com/Canepaper/MinecraftWorldGenerator |
| Local study copy | `gameopen/_ref/MinecraftWorldGenerator/` (dev only) |

**License:** personal / educational / non-commercial. **Do not paste app.js into production.**  
We **match knobs + math structure** in fleet code (`js/terrain-collider.js` → `VoxTerrain`), not ship their UI/HTML.

## What the pen gets right (gameplay)

1. **Seeded** Simplex/Perlin + **FBM** (octaves, lacunarity, persistence)  
2. **Ridge layer** for sharp peaks (`(1-|2n-1|)^2`)  
3. **Base mix + exponent** for flat plains + rare tall mountains  
4. **Water level** as absolute Y (blocks); beach band above water  
5. **Altitude zones** for trees: sand / all / pine / sparse / snow  
6. **Column store + tiled mesh** (64² tiles streamed spiral from centre)  
7. **Nearest-filter** block textures, day/night sky  

## Defaults (pen)

```js
// CHUNK default index 5 → 256 (or random small idx in fork)
waterLvl: 36, maxHeight: 128,
noiseType: 'simplex',
scale: 0.2, oct: 3, lac: 2.15, gain: 0.60,
dscale: 3.0, dmix: 0,
rscale: 0.35, rmix: 0.52,
basemix: 0.54, exp: 1.96,
snowPct: 59, treeline: 52, pineline: 41, sandPct: 108,
tSpacing: 4, sparseDens: 20,
// trees per chunk: oak 40, pine 35, autumn 12, mystic 6, golden 6
```

### Height formula (normalized → block Y)

```
base   = fbm(nx * scale, nz * scale, oct, lac, gain)
detail = fbm(nx * dscale, …) * dmix
ridge  = pow(1 - abs(fbm(nx * rscale, …)*2 - 1), 2) * rmix
h      = base * basemix + detail + ridge
h      = pow(max(0,h), exp)
y      = clamp(round(h * (maxHeight-2) + 2), 1, maxHeight)
```

`nx,nz` are **0…1** over the chunk (`x/CHUNK`).

## Fleet mapping (SI meters, continuous mesh)

| Pen | Vox / openworld |
|-----|-----------------|
| Block column world | `VoxTerrain` heightfield mesh (SI, 1 unit = 1 m) |
| Chunk 256 | World size ~1400 m + `world-engine` CHUNK 96 for props |
| waterLvl 36 / maxH 128 | Sea ≈ `0` + beach; peaks from biome amp (not 128 m giants) |
| Tree zones | Nature nodes in `world-engine` + altitude culls on height sample |
| Tiled stream | Engine already chunks prop loads; terrain is one heightfield (or split later) |
| Day/night | `grudge-vox-cloud` / sky TOD (existing) |

### `VoxTerrain` profile `canepaper`

Pass `noiseProfile: 'canepaper'` (default) so height uses the pen’s **lac/gain/ridge/basemix/exp** in SI:

- World-scale UV: `nx = (x+half)/size` (0…1 over map)  
- `scale, oct, lac, gain, rscale, rmix, basemix, exp` from pen defaults  
- Output meters: `y = (h - waterFrac) * peakMeters` so water sits near **y = 0** for swim volumes  

## Gameplay rules (keep)

| Rule | Value |
|------|--------|
| Seed | `_voxWorldSeed` / URL — same seed → same land |
| Ground sample | `terrain.sampleHeight` / `heightAt` only — one height field |
| Feet | Character Y from same sampler (foot IK / controller) |
| Physics | Rapier heightfield or mesh collider from terrain — no second height |
| SI | No 100× block giants; peak amp ~8–20 m unless zone says mountains |

## What we intentionally do not copy

- Their commercial-restricted `app.js` wholesale  
- Orbit-only viewer as play camera (we use fleet TPS / explorer)  
- Pure Minecraft cube mesher (unless a dedicated voxel block mode is product-requested)

## Verify

1. Openworld: change seed → hills move; same seed → stable  
2. Walk: feet stay on mesh; water volume still ≥0.6 m swim  
3. No T-pose / double ground (controller + terrain only)

## Related

- `js/terrain-collider.js` — `VoxTerrain.build`  
- `js/world-engine.js` — chunk props / biomes  
- Skill `threejs-voxel-games` — heightmap / Rapier map  
