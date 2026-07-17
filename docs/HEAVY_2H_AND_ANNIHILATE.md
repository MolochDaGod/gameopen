# Heavy 2H + Annihilate greatsword patterns

## Shared Madarame clips (polearm bake)

| Stage | Clip | Use |
|-------|------|-----|
| 1 | `attack` (1_1) | Base |
| 2 | `attack2` (1_2) | Second |
| 3 | `attack4` (1_4) | Drive-in **+MM** |
| 4 | `attack3` (1_3) | Finisher |

Per-weapon **MM scale · intensity · timeScale** in `combat/heavyWeaponCombat.ts`:

| Weapon | MM | Intensity | Speed | Notes |
|--------|-----|-----------|-------|--------|
| **Greataxe** | 1.15× | 1.25× | 0.88 | Heavier cleaves, bigger AoE |
| **Hammer 2H** | 1.05× | 1.35× | 0.82 | Slowest, hardest hits, largest Pop |
| **Greatsword** | 1.25× | 1.20× | 0.95 | Longest gap-close + slash projectiles |

## Annihilate → Open mapping

| Annihilate | Open |
|------------|------|
| `dash` → `dashAttack` | Controller.dash + afterimage + `great-sword-slide-attack` / `skill2` |
| `SwordBlaster` (3 angles) | `Vfx.castSlashBlasters` / skill op `slashBlaster` |
| `Pop` AoE | `Vfx.popAoE` + blast |
| Air attack / jump smash | hop + `great-sword-jump-attack` (FBX) or `attack5` |
| Charge slash projectile | blasters on GS drive-in / slide finisher |

## Greatsword skills (1–4)

1. **GS Combo** — multi-part Madarame chain  
2. **Jump Smash** — jump attack + AoE  
3. **Slide Dash** — long slide → **3 slash blasters** + Pop  
4. **Whirlwind AoE** — spin/special + blasters + Pop  

## Slash projectile improvements

- Tall additive slab (SwordBlaster proportions)  
- 1 or 3 lanes (±π/5 yaw)  
- Trail + fade; center lane carries gameplay hit  
- Composable via skill VFX recipes (`slashBlaster`, `popAoE`)  

## Files

- `three/combat/heavyWeaponCombat.ts`  
- `three/Vfx.ts` — `slashBlaster`, `castSlashBlasters`, `popAoE`  
- `three/skillCombos.ts` — GS / greataxe / hammer2h multi-parts  
- `Studio.doHeavy2hSignature` + LMB 4-hit for 2H  
