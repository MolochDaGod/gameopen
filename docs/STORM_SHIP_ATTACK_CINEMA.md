# Storm Ship Attack — Production Open · island-3d intro

**Surface:** Landing (`/login`) full-bleed Three.js cinema  
**Code:** `three/cinema/StormShipAttackScene.ts` · `components/StormShipCinema.tsx`  
**Catalog id:** `storm_ship_attack`

## Assets (baked meshopt)

| Role | Source | Production path | Size |
|------|--------|-----------------|------|
| Pirate ship | `D:\Games\Models\stylized_pirate_ship (1).glb` | `public/models/cinema/stylized-pirate-ship.prod.glb` | ~1.6 MB |
| Mutant stingray | `D:\Games\Models\stonewisp_-_mutant_stingray_-rigged_and_animated.glb` | `public/models/creatures/ocean/mutant-stingray.prod.glb` | ~3.1 MB |
| Fallback ship | fleet | `models/pirate/black-tide.glb` | ~1 MB |
| Actors | fleet heroes | introgamer / racalvin / races… | CDN + same-origin |

D1 registry did not return a prior `stylized_pirate_ship` key at bake time; ship is shipped with Open public + optional future R2 put at:

`models/cinema/stylized-pirate-ship.prod.glb`  
`models/creatures/ocean/mutant-stingray.prod.glb`

Re-bake:

```bash
cd artifacts/animator
npx @gltf-transform/cli@4.1.1 optimize public/models/cinema/stylized-pirate-ship.glb public/models/cinema/stylized-pirate-ship.prod.glb --compress meshopt --texture-compress webp --texture-size 1024
npx @gltf-transform/cli@4.1.1 optimize public/models/creatures/ocean/mutant-stingray.glb public/models/creatures/ocean/mutant-stingray.prod.glb --compress meshopt --texture-compress webp --texture-size 1024
```

## Scene craft

- **Storm water:** custom Gerstner multi-wave shader + foam + fresnel (`stormWater.ts`)
- **Storm dome:** procedural cloud bands + lightning flash uniforms
- **Rain:** 4k points with wind drift
- **Ship materials:** wet wood grade via `enhanceShipMaterials`
- **Beast:** wet organic materials + native GLB anim if present
- **Story beats:** approach → deck → stingray rise → hull tear + debris → crew/player leap into sea
- **Post:** mystical pmndrs stack (bloom, grain, vignette, chroma)
- **Camera:** locked cinema keys (~20s)

## Deploy

Ships with gameopen Open SPA:

```bash
cd C:\Users\nugye\Documents\gameopen
git push origin main
# or npm run deploy:prod
```

QA: https://open.grudge-studio.com/login
