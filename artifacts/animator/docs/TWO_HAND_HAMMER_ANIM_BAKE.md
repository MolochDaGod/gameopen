# 2H Hammer / Mace Animation Bake

Retarget `D:\Games\Models\2hweaponhammerretarget.glb` (Soulcalibur-style `SC_SC_*` clips) onto fleet skeletons for **two-hand mace and war-hammer** combat.

## Source

| Item | Value |
|------|--------|
| GLB | `2hweaponhammerretarget.glb` (~2.8 MB) |
| Clips | 14 `SC_SC_*` (idle, jab, charge, 180° sweep, flinch, steps, jump, summon, …) |
| Rig | Custom `Bone*` — hips `Bone4_03`, spine/head `Bone5–8`, L/R arms & legs; **weapon chain skipped** |

## Bake

```bash
# Prefer Character-Animator-two viewer (has BRB Bip001 target + three):
cd artifacts/character-viewer
node tools/bake-2h-hammer-glb.mjs --target=both

# Or from gameopen animator (needs BIP_TARGET / MIXAMO_TARGET env if FBX missing):
cd artifacts/animator
npm run bake:2h-hammer
# HAMMER_GLB=D:/Games/Models/2hweaponhammerretarget.glb
```

### Outputs

| Pack | Skeleton | Path |
|------|----------|------|
| `twohand_hammer` | Bip001 (grudge6) | `/anims/baked/twohand_hammer/*.json` |
| `twohand_hammer_mixamo` | mixamorig (Explorer) | `/anims/baked/twohand_hammer_mixamo/*.json` |

Role aliases (flat):

- `idle` / `fight_idle` ← `SC_SC_Idle`
- `attack` / `attack1` / `jab` ← `SC_SC_Jab`
- `attack-charge` / `attack2` / `charge` ← `SC_SC_ChargeStrike`
- `attack-sweep` / `attack3` / `sweep` / `skill` ← `SC_SC_180x2Sweep`
- `hit`, `walk`, `step-*`, `backstep`, `jump`, `land`, `fall`
- `skill-summon` / `skill2` ← `SC_SC_SummonCrows`

## Runtime wiring (gameopen)

| Surface | Behavior |
|---------|----------|
| `AnimPack` | `"hammer"` → `ANIM_PACK_CLIPS.hammer` |
| `animPackForWeapon` | `hammer`, `hammer2h`, `mace`, `maul`, … → `"hammer"` |
| `WeaponFamily` `mace` | `MACE_SKILLS` (jab / charge / sweep / crow burst) |
| `familyFromAnimPack("hammer")` | `"mace"` |
| Fleet equip aliases | `mace` / `maul` → weapon id `hammer2h` |
| grudge6 hydrate | loads `HAMMER_EXTRA_CLIPS` one-shots when pack is hammer |

## Not swords

Greatsword / greataxe / samurai 2H stay on their own packs. This bake is **blunt 2H only**.
