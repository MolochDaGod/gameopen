# Explorer character — face, controller, weapons, equipment, skill VFX

**Surface:** Open Danger Room / playtest when avatar id is `explorer`  
**Rig:** Procedural Mixamo box body (`ExplorerCharacter` + `explorer/Animator`)  
**Mine-Loader parallel:** `characterEquipment` tier tints + combat controller feel + hotbar skills  

## What “working correctly” means

| Layer | Behavior |
|-------|----------|
| **Avatar face** | Avatar Edit head on the cube (pixel faces + hair). Seeded default if never saved. |
| **Controller** | Same Danger `Controller` + `InputState` + `productionRuntime` (1.8 m, 60 Hz). |
| **Weapons** | Real arsenal GLB via `mountWeaponModel` on Mixamo hand mounts; anim set swap. |
| **Equipment** | Fleet loadout weapon/off-hand; optional armor tier tints on body (Mine-Loader style). |
| **Skills + VFX** | T0 / `master-weaponSkills` kits → HUD 1–4 + Studio skill VFX kinds. |
| **Skill trees** | Production UI → skill trees includes **Weapon combat** tree. |

## Selection rules (App)

Prefer **Explorer** when:

- `saveData.open.avatarId === "explorer"` or starts with `avatar-`, or  
- `isVoxelCharacter(ch)` (cube-head / voxel pipeline)

Otherwise load **grudge6** race kit (`grudge:race:preset` + mesh_ids).

## Key code

| Piece | Path |
|-------|------|
| Adapter | `three/ExplorerCharacter.ts` |
| Box rig + face | `three/explorer/rig.ts` · `avatar/playerHead.ts` |
| Clips / loco | `three/explorer/Animator.ts` · `clipCatalog.ts` |
| Spawn + weapon | `Studio.spawnCharacter` · `applyWeaponAsync` |
| Skill kits | `arsenal/t0WeaponSkills.ts` · `content/masterWeaponSkills` |
| Trees UI | `content/harvest/skill-trees.json` → HarvestProductionUI |

## Player flow

1. **Avatar Edit** → Save to Character (`avatarHead:saved` event).  
2. **Danger / Play** as explorer → face applies; weapon from loadout.  
3. **1–4 / F** → skill anims + VFX from T0/master kit for current weapon.  
4. **P → Skill trees → Weapon combat** → unlock path for kit progression (local until professions API).  

## Smoke

```
/avatar → save head
/danger → Explorer (or force import explorer from production Characters tab)
  · face painted (not blank cube)
  · walk / jump (Controller)
  · equip sword/staff → mesh on hand + stance
  · 1–4 skills fire VFX
  · P production → Weapon combat tree visible
```
