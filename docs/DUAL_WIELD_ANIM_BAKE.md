# Dual-wield pack bake (dual_wieldingandothers.glb)

**Source:** `D:\Games\Models\dual wieldingandothers.glb`  
**Bake:** `npm run anims:bake:dual-wield`  
**Out:** `public/anims/baked/dual_wield/*.json` (Bip001, rotation-only)

## Review

| Item | Finding |
|------|---------|
| Skeleton | Custom `Bone*` hierarchy (45 joints), **not** Mixamo/Bip001 names |
| Anims | 46 clips (`PC_B_*` combat, rolls, flinch, death, loco) |
| Hip motion | SwordLunge hip Y ≈ **0.45–3.01 m** → **must strip** hip/root translation |
| Hands | Mapped to **Bip001 L Hand** / **Bip001 R Hand** (weapon sockets separate) |
| Policy | Quaternion only · controller owns root Y/XZ |

## Bone map (source → Bip001)

| Source | Bip001 |
|--------|--------|
| Bone0_09 | Pelvis |
| Bone40_00 / 38_019 / 39_020 | Spine / Spine1 / Spine2 |
| Bone26_032 / 52_033 | Neck / Head |
| Bone37→36→10→11 | L Clavicle → UpperArm → Forearm → **Hand** |
| Bone6→7→17→18 | R Clavicle → UpperArm → Forearm → **Hand** |
| Bone28→29→30→31 | L Thigh → Calf → Foot → Toe0 |
| Bone32→33→34→35 | R Thigh → Calf → Foot → Toe0 |

## Roles (melee dash / attack / hit)

| Role | Source clip |
|------|-------------|
| sword_dash_attack, dash, skill1, thrust | PC_B_SwordLungeFwd |
| attack, slash | PC_B_SwordSlash |
| attack2, combo | PC_B_SwordSlash2 |
| attack3 / attack4 | PC_B_SwordSlice / Slice2 |
| attack5, overhead | PC_B_SwordUppercut |
| skill2 / 3 / 4 | SliceDice / Windmill / Figure_Eight |
| hurt, flinch | PC_B_Flinch |
| airFlinch | PC_B_AirFlinch |
| hitfly | PC_GR_KnockDown |
| death | PC_B_LargeDeath |
| dodgeF/B/L/R | Rollforward / Rollback / RollLeft / RollRight |
| block | PC_B_BlockStanceLoop |

## Runtime

1. **grudge6** — `TRAVERSAL_CLIPS` + `DUAL_WIELD_CLIPS` via `loadBakedClip` + `rematchClipToSkeleton`  
2. **Character (GLB)** — `fleetAvatarHydrate` loads dual_wield dash/hurt/skills  
3. **Explorer** — same Bip001 JSON rematched to **mixamorig*** via `buildBoneNameLookup` cross-aliases  

## Re-bake

```bash
npm run anims:bake:dual-wield
# or
DUAL_WIELD_GLB="D:/Games/Models/dual wieldingandothers.glb" npm run anims:bake:dual-wield
```
