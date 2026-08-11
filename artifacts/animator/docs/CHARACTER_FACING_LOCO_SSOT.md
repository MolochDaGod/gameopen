# Character facing + locomotion SSOT (GRUDOX Animator)

**Host:** https://grudox.grudge-studio.com/animator/  
**Code:** `artifacts/animator` (Open monorepo)

## Facing (art-forward)

| Rule | Value |
|------|--------|
| Controller forward | `+Z` when `root.rotation.y = 0` |
| Model art | local **+Z** after deploy |
| grudge6 Toon GLB / Heroes of Grudge class kits | **`modelYaw: 0`** |
| grudge6 FBX atlas path | `facePlusZ` → **π/2** once (`loadCharacter` / `characterDeploy`) |
| **Banned** | `modelYaw: Math.PI + Math.PI/2` (faces camera / moonwalks) |

Heroes of Grudge (`grudge-{race}-{class}`) ships 24 GLBs under `public/models/grudge/` with embedded short clip names. Catalog previously set `modelYaw: π+π/2` → **180° wrong** (looking at camera). Fixed to **0**.

## Clip library → roles

Embedded clips (verified on class GLBs):

`idle` · `walk` · `run` · `sprint` · `attack` · `jump` · `strafe_*` · `harvest` · weapon variants

`Character.autoMapClips`:

1. Exact name prefer (`idle`, `walk`, `run`, `sprint`, `attack`, …)
2. Fuzzy keywords (never map roll/dodge as loco)
3. Cross-fill walk↔run; sprint aliases run if missing

## Locomotion blend

`LocomotionBlend` weights by speed:

| Band | Speed | Clips |
|------|-------|--------|
| Idle | ≤0.04 | idle |
| Walk | →0.38 | idle↔walk |
| Run | →0.72 | walk↔run |
| Sprint | →0.92+ | run↔**sprint** (if distinct) |

Controller calls `setLocomotion(speed, sprinting)` so Shift reaches the sprint band.

## Weapons

Class kits declare `loadout` + `handBone: "Hand"`. Grip remains arsenal holdStyle SSOT — do not invent a second attach system.

## Confirmation

```
[ ] Kingdom Knight walks away from camera (not facing player)
[ ] Shift uses sprint clip when present
[ ] Idle → walk → run blend is continuous (no pop)
[ ] Attack role plays sword_attack_c / attack, not roll
```
