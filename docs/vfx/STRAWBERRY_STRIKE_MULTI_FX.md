# Strawberry Strike — multi-effect VFX skill

**Asset:** `models/vfx/strawberry-strike.glb`  
**Source:** `C:\Users\nugye\Documents\gameopen\client\public\models\vfx\strawberry-strike.glb`

## Bounds & scale

| Metric | Value |
|--------|-------|
| Scene size (raw units) | 15.524 × 19.383 × 18.097 |
| Mesh count | 1 |
| Clips | PlaneAction (2s) |

### SI scale factors (apply on spawn)

| Mode | Target max dim | Scale from raw |
|------|----------------|----------------|
| force_impact | 1.2 m | **0.06191** |
| attack_trail | 0.9 m | **0.04643** |
| slash_band | 2.2 m | **0.1135** |
| cool_burst | 1.6 m | **0.08358** |

Formula: `scale = targetMaxM / max(rawSize.x,y,z)`.

## Multi-effect system

One GLB can drive many FX modes by isolating mesh groups + reusing clips + runtime scale/tint/trail.

### `force_impact`
- **Use:** LMB heavy / skill impact pulse
- **Scale:** 0.06191
- **Notes:** Play full clip once; additive materials; dispose after duration

### `attack_trail`
- **Use:** Follow weapon tip during swing
- **Scale:** 0.04643
- **Notes:** Attach to hand/weapon bone; orient along velocity; fade opacity by swing progress

### `slash_band`
- **Use:** Arc slash like Getsuga / light-of-slash
- **Scale:** 0.1135
- **Notes:** Spawn at muzzle; aim along free-aim; one-shot clip

### `cool_burst`
- **Use:** Crit / finish / skill confirm
- **Scale:** 0.08358
- **Notes:** Tint cooler (cyan/violet); stack soft shockwave + Kenney impact SFX


## Runtime hooks (gameopen Vfx)

```
- ensureModel('models/vfx/strawberry-strike.glb', size)
- cloneModelInstance → shared geos, unique mats for tint
- mixer.clipAction(clip).setLoop(THREE.LoopOnce)
- addTrail(obj, color) for projectile-adjacent paths
- onHit → burst + Kenney combat_hit / soft_medium
```

## Avoid

- Do not leave source units (cm/huge bounds) unscaled
- Do not play as looping idle without fade
- Do not parent entire scene without isolating submeshes if multi-mode

## Mesh inventory

| Name | Parent | Verts | Size |
|------|--------|------:|------|
| Plane_0 | Plane | 648 | 15.524×19.383×18.097 |


## Pairing

- Kenney SFX: `combat_hit`, `soft-medium`, `bell` confirm — skill **kenney-audio**
- Staff orbs: `models/vfx/orbs/orb-*.glb` from fireball split (not whole fireball.glb)
