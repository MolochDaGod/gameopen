# Ghost Rider (PS2 2007) — Animation Review & Bake

**Source:** `D:\Games\Models\ghost_rider_-_2007_video_game_marvel_ps2.glb`  
**Policy:** **animations only** — discard all Marvel mesh / skin / textures.

## Understanding the pack

| Fact | Detail |
|------|--------|
| Clips | **98** `PC_GR_*` |
| Skeleton | Custom `Bone*` (47 bones), similar layout to dual-wield GR-era rigs |
| Mesh | 8 skinned meshes — **not shipped** |
| Scale “stretch” | `max\|scale−1\| ≈ 0.005` — **not** real weapon stretch |
| How chain extends | Position curves on **chain links** `Bone19–24` (+ alt `Bone91–92`) from **R Hand** `Bone18` |
| Root motion | Rolls move `Bone9999` / hips ~5–6 m — **stripped** (controller owns Y/XZ) |

### Body map (bind pose)

| Region | Source | Bip001 |
|--------|--------|--------|
| Hips | `Bone0_08` | Pelvis |
| Spine | `Bone40 → 38 → 39` | Spine / Spine1 / Spine2 |
| Head | `Bone26 → 27` | Neck / Head |
| L arm | `Bone37 → 36 → 10 → 11` | L Clavicle…Hand |
| R arm | `Bone6 → 7 → 17 → 18` | R Clavicle…Hand |
| Legs | `Bone28–31` L, `Bone32–35` R | Thigh…Toe |

### Chain (FX only — not body retarget)

```
R Hand Bone18
  └─ Bone19 → 20 → 21 → 22 → 23 → 24  (primary hellfire chain, +Z in bind)
  └─ Bone91 → 92                         (secondary whip tip)
```

**Never** scale sword/mace meshes to fake length. Instead:

1. Play body bake (`ghost_rider/megachain_slam.json`, etc.).
2. Load `ghost_rider/fx/<role>_chain_path.json` samples.
3. Emit **hellfire ribbon** along path (`fire_aura` / `fireball` / path particles).
4. Optional: procedural chain links as thin cylinders + flame shader.

Flame recipe (per FX JSON):

```json
{
  "flameRecipe": {
    "effectIds": ["fire_aura", "fireball", "inferno"],
    "mode": "path_ribbon",
    "attach": "Bip001 R Hand",
    "widthM": 0.08,
    "life": 0.35,
    "color": 16736800
  }
}
```

## Priority clips (learned)

| Source | Role | Use |
|--------|------|-----|
| `PC_GR_Rollforward/back/Left/Right` | `locomotion/roll_*`, `dodgeF/B/L/R` | **Fleet-wide dodge** + land roll |
| `PC_GR_Quakesmash_together` (~0.63s) | `combo_finisher` / `quakesmash` | Combo ender on **many** melee & ranged-melee |
| `PC_GR_MegaChainSlamFireQuake` (~1.7s) | `megachain_slam` / ultimate | Chain slam + flame path |
| `PC_GR_ChainThrowCombined` | `chain_throw` | Ranged-melee (ext ~1 m tip) |
| `PC_GR_HyperChainStab` | `chain_stab` | Lunging chain |
| `PC_GR_ChainSpin` | `chain_spin` | Spin control |
| `PC_GR_Fireball` | `fireball` | Cast pose; bolt from hand |

## Bake

```bash
cd artifacts/animator
node scripts/bake-ghost-rider-glb.mjs
# npm run bake:ghost-rider
```

### Outputs

- `public/anims/baked/ghost_rider/*.json` — body, rotation-only Bip001  
- `public/anims/baked/locomotion/roll_*.json` + `dodge_*.json` + `land_roll.json`  
- `public/anims/baked/ghost_rider/fx/*_chain_path.json` — path samples  
- `public/anims/baked/ghost_rider/manifest.json` — bone map + policy  

Copied to `client/public/anims/baked/` for Open deploy.

## Runtime wiring

| System | Behavior |
|--------|----------|
| `TRAVERSAL_CLIPS` | dodge / roll → GR locomotion paths (every grudge6 hero) |
| `GHOST_RIDER_CLIPS` | finishers + chain roles hydrated fleet-wide |
| `MACE_SKILLS` | slots 3–4 = quakesmash + firequake |
| `CHAIN_RANGED_MELEE_SKILLS` | throw / stab / spin / megachain |
| `SHARED_FINISHER_SKILLS` | reusable quake + megachain defs |

## What we refuse

- Ghost Rider character mesh / face / coat  
- Scaling weapon meshes to “reach”  
- Using run-to-roll uploads as sprint (unchanged ban list)  

## Related sources (not baked here)

- `vengeance_-_ghost_rider_2007_video_game_ps2.glb`  
- `blackout_-_ghost_rider_2007_video_game_ps2.glb`  

Bake those next with the same script + `GHOST_RIDER_GLB=…` if more clips are needed.
