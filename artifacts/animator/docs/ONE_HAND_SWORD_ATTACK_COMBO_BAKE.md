# 1H Sword — AttackCombo01 + Attack Combo 2

## Sources (Kassimkot Sketchfab)

| Role | File | Sketchfab |
|------|------|-----------|
| AttackCombo01 (quick) | `public/anim/combo/melee-combo-1.glb` | https://sketchfab.com/3d-models/attackcombo01-578057e0f49e448eaf0a9758676ecf59 |
| Attack Combo 2 (strong) | `public/anim/combo/melee-combo-2.glb` | https://sketchfab.com/3d-models/attack-combo-2-66bbad5ffe1940c088451a2e56c288a1 |

Clip names in GLB: `"Attack Combo"` / (combo-2 primary take). Rig: `mixamorig:<Bone>_<NN>`.

## Bake

```bash
cd artifacts/animator
node scripts/bake-attack-combo-1h-sword.mjs
```

Outputs under `public/anims/baked/sword_shield/`:

| JSON | Meaning |
|------|---------|
| `attack-combo-01.json` | full quick combo (~6.9s) |
| `attack-combo-01-trimmed.json` | same, **1s wind-up stripped** (primary LMB) |
| `attack` / `attack1` | alias of trimmed combo-01 |
| `attack-combo-02.json` | strong combo (~12s) |
| `attack2` / `skill` | alias of combo-02 |

Skeleton: **Bip001** · rotation-only · 22 tracks.

## Runtime

- `ANIM_PACK_CLIPS.sword_shield.attack` → `sword_shield/attack-combo-01-trimmed`
- extras include combo-02 for skill / second hit
- Explorer `clipCatalog` sword: LMB chain `melee-combo-1` → `melee-combo-2`
- Loco still samurai sword stance (idle/walk/run)

## Re-bake

When replacing the GLBs, re-run the bake script. Do not invent alternate 1H sword attack packs.
