# Fireball.glb → 4 staff magic orbs

## Mistake

Loading `models/vfx/fireball.glb` as a **projectile** is wrong.

That file is a **Sketchfab demo scene**:

| Issue | Detail |
|-------|--------|
| Scale | ~80-unit balls on an ~800-unit Z layout (not SI metres) |
| Contents | **4** multi-sphere ball packs + **trail cube** + **ground plane** |
| Clips | One 10s demo animation for the whole layout |

Whole-scene load → giant multi-ball mess, wrong scale, broken tornado/staff FX.

## Fix

Extract each ball pack into SI-sized orbs (~0.45 m diameter):

| Orb | Path | Staff use |
|-----|------|-----------|
| **orb-fire** | `models/vfx/orbs/orb-fire.glb` | Fire staff primary projectile |
| **orb-ember** | `models/vfx/orbs/orb-ember.glb` | Storm / secondary trail seed |
| **orb-core** | `models/vfx/orbs/orb-core.glb` | Ice / Nature / charge core |
| **orb-flare** | `models/vfx/orbs/orb-flare.glb` | Holy impact flash body |

Manifest: `models/vfx/orbs/orb-manifest.json`

### Regenerate

```bash
cd C:\Users\nugye\Documents\gameopen
node scripts/split-fireball-orbs-gt.mjs
```

## Runtime wiring

- `Vfx.MODEL_VFX.orbFire|orbEmber|orbCore|orbFlare`
- `Vfx.castMagicOrb` / `castMagicOrbAt`
- `ELEMENT_THEME` staff projectiles → orbs (not generic sphere bolt, not whole fireball)
- Tornado skill **must not** fall back to `fireball.glb`

## Agent rule

```
if path includes fireball.glb as projectile → FAIL
use models/vfx/orbs/orb-*.glb instead
```
