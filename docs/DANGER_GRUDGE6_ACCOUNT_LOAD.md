# Danger Room — grudge6 / RTS_TOON account load (correctness)

**Symptom fixed:** signed-in hero loads as cube / wrong scale / yellow kit / T-pose.

## Root causes found (2026-07-31)

| Fault | Effect |
|-------|--------|
| Avatar Edit saved `saveData.open.avatarId: "explorer"` | `preferExplorer` forced **cube body** for Warlords race heroes |
| `isVoxelCharacter` treated modular head / avatarHead as full voxel body | Same Explorer path |
| `playableFromFleetCharacter` ignored account `mesh_ids` | Only class preset meshes; wrong equip visibility |
| `sword_shield` bake incomplete on Open (only run JSON) | Missing idle/attack → broken loco/combat anims |

## Correct load order (SSOT)

```
1. resolveRaceId + resolvePresetId from Railway character
2. resolveCharacterEquipmentVisual → mesh_ids (equipment / gear_preset / class)
3. studioAvatarId = grudge:{race}:{preset}   // NEVER force explorer for grudge6
4. Load race kit GLB (CDN) or FBX atlas kit
5. hideEquippable → show mesh_ids only
6. fitCharacterHeight ~1.8 m + deployCharacterModel (feet y=0, +Z art-forward)
7. ensureGrudge6Materials (Toon RTS atlas if map coverage poor)
8. Baked Bip001 packs under /anims/baked/ (rotation-only rematch)
9. AnimationDirector idle gait + one-shot attacks
```

## Do / don't

**Do**

- Equipment = **child mesh visibility** on modular race kit  
- Textures = race atlas (sRGB, flipY=false on FBX path) or restored GLB maps  
- Scale = SI human ~1.8 m after equip  
- Anims = Bip001 packs (`sword_shield`, `longbow`, `magic`, …) not Mixamo on grudge6  

**Don't**

- Set `avatarId: "explorer"` when saving modular **head** look  
- Equip by swapping whole body GLBs  
- Play Mixamo tracks on Bip001 without rematch  
- Fit weapons to 1.8 m height  

## Related code

- `lib/dangerPlayableCharacter.ts` — fleet → playable  
- `lib/characterEquipmentMesh.ts` — mesh_ids  
- `lib/characterPortrait.ts` — `isVoxelCharacter`  
- `three/grudge/grudge6Runtime.ts` — load + atlas + anims  
- `three/characterDeploy.ts` — scale / facing / feet  

Skill: `grudge-character-correctness`
