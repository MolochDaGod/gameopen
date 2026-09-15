# Pro Melee Axe + Male Injured — deployment SSOT

## Sources

| Pack | Zip | Extracted |
|------|-----|-----------|
| Pro Melee Axe | `Documents/_extracted/Pro Melee Axe Pack.zip` | `public/anim/pro-melee-axe/` (47 FBX) |
| Male Injured | `Documents/_extracted/Male Injured Pack.zip` | `public/anim/male-injured/` (20 FBX) |

Skeleton: **Mixamo** (`mixamorig*`) → bake **Bip001** rotation-only.

```bash
cd artifacts/animator
node scripts/bake-pro-melee-axe-injured.mjs
```

Outputs:

| Pack | Path | Use |
|------|------|-----|
| `pro_melee_axe` | `anims/baked/pro_melee_axe/` | 1H axe main-hand, loco, attacks |
| `pro_melee_axe_mirror` | `anims/baked/pro_melee_axe_mirror/` | **Off-hand** warrior (mirrored) |
| `male_injured` | `anims/baked/male_injured/` | **Slowed / wounded** loco |

Code SSOT: `src/three/anim/proMeleeAxeInjuredSsot.ts`

## Best practices

1. **Use every clip** — role map covers all 47 + 20 files (see bake ROLE maps).  
2. **Loco vs attack** — loop walk/run/idle; one-shot combos/attacks/hits.  
3. **Injured ≠ default** — only when `slowed`, `wounded`, or HP &lt; ~35%.  
4. **Off-hand** — never reuse right-hand bake raw; use `pro_melee_axe_mirror` (L/R swap + quat mirror).  
5. **Hip** — position tracks stripped; controller owns Y/XZ.  
6. **One mixer** — register clips on existing avatar mixer only.

## Melee attack chain (axe)

| Role | Clip | Input |
|------|------|--------|
| combo_1 → combo_2 → combo_3 | LMB chain | sequential |
| attack (horizontal) | light follow | LMB finisher |
| attack_down | overhead | skill / heavy |
| attack_backhand | backhand | skill |
| attack_360_high / low | spin | special |
| attack_kick_1 / 2 | kick | utility |
| jump_attack | run jump attack | air / gap close |

Off-hand: same roles under `pro_melee_axe_mirror/`.

## Locomotion (axe armed)

| Role | Clip |
|------|------|
| idle, idle_look_1/2 | standing idle* |
| walk, walk_back, walk_left, walk_right | standing walk* |
| run, run_back | standing run* |
| jump, turn_left/right | standing jump/turn |
| crouch_idle, crouch_stand | crouch* |

Unarmed subset (sheathed): `unarmed_*` roles in same pack.

## Slowed / wounded (Male Injured)

| State | Use pack | Notes |
|-------|----------|--------|
| Status **slow** | `male_injured` loco | walk/run slower feel |
| **Wounded** low HP | `male_injured` | hurt_idle / stumble_idle |
| Healthy combat | `pro_melee_axe` | full speed |

All 20 injured clips mapped: idle variants, walk/run + turns, backpedal, jumps.

## Mirror off-hand (warrior)

```ts
import { offhandAxeAttackRel, PRO_MELEE_AXE_ATTACK_ROLES } from "./anim/proMeleeAxeInjuredSsot";

// main hand
play("pro_melee_axe/combo_1");
// off hand
play(offhandAxeAttackRel("combo_1")); // → pro_melee_axe_mirror/combo_1
```

Bake mirrors L↔R arms/legs and negates quat x/w for Y-up characters.

## Fleet wiring

| Surface | Hook |
|---------|------|
| Explorer `clipCatalog` axe | `EXPLORER_AXE_CLIP_MAP` → load baked via bake paths |
| grudge6 axe weaponId | map idle/walk/run/attack to `pro_melee_axe/*` |
| Status slow | `selectLocoPack({ slowed: true })` → male_injured |
| Dual wield warrior | main `pro_melee_axe`, off `pro_melee_axe_mirror` |

## Deploy

Copy bakes into Open public (animator public ships on Vercel):

`anims/baked/pro_melee_axe/**`  
`anims/baked/pro_melee_axe_mirror/**`  
`anims/baked/male_injured/**`

## Verify

1. Bake: 47 + 20 (+ 47 mirror) JSON, tracks ≥ 14 each  
2. Axe equip: idle/walk use pro_melee_axe not sword  
3. LMB plays combo_1 → 2 → 3  
4. Apply slow: walk becomes injured walk  
5. Off-hand attack reads mirrored (not T-pose)  
