# Danger Room playable characters

**Live:** https://open.grudge-studio.com/danger

## Goal

Use the same grudge6 combat stack (controller, anims, weapon skills, VFX, equip mesh visibility) for every entry path:

| Source | How |
|--------|-----|
| Fleet account character | Select hero in Account → enter Danger |
| Asset-Rig-Editor bake | **Play Danger** button → `?are=1&race=&class=&name=` |
| Annihilate deep link | `?hero=elf_warrior` or `?hero=wk_mage` |
| Default | WK warrior grudge6 kit |

## Resolver SSOT

`artifacts/animator/src/lib/dangerPlayableCharacter.ts`

```
URL (hero / ARE) → fleet selectedCharacter → wk_warrior default
```

Always spawns **`grudge:<race>:<preset>`** (GrudgeAvatar), never Explorer Mixamo FBX.

## Deep links

```
https://open.grudge-studio.com/danger?hero=brb_warrior
https://open.grudge-studio.com/danger?are=1&race=barbarians&class=warrior&name=my_hero
https://open.grudge-studio.com/danger?race=high-elves&class=mage&are=1
```

## Best practices migrated into Danger

| Domain | Source |
|--------|--------|
| SI scale / feet ground | characterDeploy + fitCharacterHeight |
| Equip | mesh_ids visibility (not body swap) |
| Anim packs | sword_shield / magic / longbow / 2h |
| Weapon skills | weaponSkillPacks + master-weaponSkills |
| Controller | Studio Controller (WASD, LMB, X roll, C parry, F skills) |
| VFX / impact | Vfx + combat FX settings |
| Hand sockets | R_hand_container / L_shield_container |

## Asset-Rig-Editor → Danger

1. Rig Studio: import, place joints, bind (optional for ARE label path)  
2. CUSTOM BAKE: set race + class + custom name  
3. **Play Danger** → opens Open with query  
4. Danger boots grudge6 kit for that race/class + gear preset meshes + skills  

Baked GLB from ARE is for offline/pipeline; live Danger prefers **CDN race kit + mesh_ids** for production correctness.

## Account character path

1. Sign in → Account → select character  
2. Enter Danger (no hero query)  
3. `resolveDangerPlayable` uses fleet character  
4. `applyFleetLoadout` refreshes mesh_ids from equipment bag async  

## Related code

| File | Role |
|------|------|
| `lib/dangerPlayableCharacter.ts` | Resolver + deep links |
| `lib/annihilateHero.ts` | `?hero=` parse |
| `lib/characterEquipmentMesh.ts` | mesh_ids from equipment |
| `three/grudge/weaponSkillPacks.ts` | Skill combat defs |
| `App.tsx` danger mount | Boot playable |
| ARE `BakeCharacterBar.tsx` | Play Danger button |
