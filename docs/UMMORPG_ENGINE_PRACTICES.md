# uMMORPG → Grudge Open engine practices

Reference: **Unity Grudge Warlords (uMMORPG)** controllers, race prefabs, ScriptableWeapon / ScriptableSkill — adapted for Three.js Danger Room / Open.

## Entity / prefab model

| Unity (uMMORPG) | Web (gameopen) |
|-----------------|----------------|
| `Entity` root + model child | `Avatar.root` + kit model under holder |
| `Player` / `Npc` / `Monster` prefab | `EntityPrefab` (`three/ummorpg/prefabProfile.ts`) |
| EquipmentItem → hand bone | `attachToSocket` / arsenal `mountWeaponModel` |
| Mesh equipment pieces | grudge6 **mesh_ids visibility** |
| `ScriptableSkill` assets | `master-weaponSkills` + `ScriptableSkill` |
| `ScriptableWeapon` | `ScriptableWeapon` + `WEAPON_COMBAT` ranges |
| Animator Controller | `AnimationDirector` + `GrudgeAvatar` mixer |

## Skeleton connections (Bip001)

Required sockets (see `skeletonSockets.ts`):

| Socket | Names |
|--------|--------|
| Root / hips | `Bip001`, `Bip001 Pelvis` |
| Hands | `Bip001_R_Hand`, `Bip001_L_Hand` |
| Weapon mounts | `R_hand_container`, `L_hand_container`, `L_shield_container` |
| Utility | `Quiver_container`, `Bone_bag`, `Bone_wood` |

**Best practices**

1. After Toon RTS FBX load → `unifySkeletons` (duplicate bones per mesh).  
2. Resolve sockets once → cache on `userData.sockets`.  
3. Mount weapons on **containers** when present, else hand bones.  
4. Ground feet with body bbox, not pelvis origin alone.  
5. Validate prefab: hips + R hand required before spawn.

## Root connections

```
scene
 └─ Avatar.root          (world transform / controller target)
     └─ holder           (modelYaw)
         └─ race kit     (FBX/GLB Bip001 + equipment children)
             ├─ Bip001 …
             ├─ R_hand_container → weapon GLB
             └─ equip meshes (visibility from mesh_ids)
```

Controller drives **Avatar.root** only — never scale the kit after height fit.

## Scriptable skills (weapon skills)

Catalog SSOT: `objectstore…/master-weaponSkills.json` (v3.1.x).

| Slot | uMMORPG | Web hotbar |
|------|---------|------------|
| primary | basic attack | skill 1 |
| secondary | skill 2 | skill 2 |
| ability | skill 3 | skill 3 |
| ultimate | skill 4 | skill 4 |

**Cast gate (like Skill.CheckSelf)**

1. Cooldown ready  
2. Mana / stamina  
3. Distance ≤ skill.range (weapon profile)  
4. Play anim one-shot → hit window → apply damage / projectile  

API: `resolveScriptableWeapon(weaponId)`, `canCastSkill`, `hotbarFromWeapon`.

## NPC prefabs

`warlordsRoles` + `prefabFromWarlordsRole`:

- **hostile** — orc / undead / barbarian kits, high aggro  
- **traveler / merchant / guard / quest_npc** — lower aggro, light kits  
- **player** — account mesh_ids + equipment  

Spawn hostiles with `listHostilePrefabs()` instead of capsules / random GLBs.

## Animation director

```text
setGaitTarget(moving, sprint) each frame
update(dt)
requestOneShot("attack") on skill
```

Do not run parallel `crossFade` systems against the director.

## Development checklist

- [ ] Kit loads; sockets validate ok  
- [ ] Atlas rebind (flipY false)  
- [ ] mesh_ids from account or gear preset  
- [ ] ScriptableWeapon kit 4 skills with icons  
- [ ] Attack one-shot returns to loco  
- [ ] Melee damage only inside range + hit window  
- [ ] NPC uses EntityPrefab + same race kits  

## Related modules

| Path | Role |
|------|------|
| `three/ummorpg/*` | This layer |
| `three/grudge/*` | Race kit, equip, atlas |
| `three/content/masterWeaponSkills.ts` | Catalog fetch |
| `lib/characterEquipmentMesh.ts` | Account → mesh_ids |
| `grudge6-combat-runtime` skill | Ranges + director gates |
