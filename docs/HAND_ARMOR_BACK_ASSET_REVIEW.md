# Hand / Armor / Back asset inventory & scale review

Generated: 2026-07-29T07:52:08.240Z

## Scale math (SSOT)

| Rule | Value |
|------|-------|
| World units | 1 unit = **1 metre** |
| Human yardstick | **1.8 m** average height |
| Character convert | target height **~1.7 m**, `--cm-to-m` if authored in cm |
| Weapon convert | **no** height normalize; max dim **0.05–5 m** |
| 100× bug | mesh height > ~50 → almost certainly cm left as metres |

### Expected weapon lengths (metres)

| Family | Min | Max |
|--------|-----|-----|
| dagger | 0.2 | 0.45 |
| 1h_sword | 0.7 | 1.1 |
| 2h_sword_greatsword | 1.2 | 1.8 |
| 1h_axe | 0.5 | 0.9 |
| greataxe | 1.1 | 1.7 |
| spear_javelin | 1.8 | 2.8 |
| bow | 1 | 1.5 |
| staff_cane | 1.4 | 2 |
| hammer_1h | 0.5 | 0.9 |
| hammer_2h | 1 | 1.6 |
| shield | 0.5 | 1 |
| pistol | 0.2 | 0.4 |
| rifle | 0.9 | 1.3 |
| tool_pick | 0.7 | 1.2 |

## Layer summary

| Layer | Count | 3D mesh? | Notes |
|-------|------:|----------|-------|
| Design weapons (info weapons.json) | 139 | **0 model fields** | stats + icons |
| Design armor (info armor.json materials) | 168 | sparse/null | slots include **back** |
| Open content weapon prefabs | 18 | path+readiness | `content/weapons/*.json` |
| Local runtime weapon GLBs | 57 | yes | `public/models/weapons/*` |
| Open WeaponId runtime roster | 28 | via arsenal+GLB | Danger Room equip |

## Design weapons by category (hands)

| Category | Count | Kind |
|----------|------:|------|
| arcaneStaves | 20 | mainhand_weapon |
| swords | 6 | mainhand_weapon |
| axes1h | 6 | mainhand_weapon |
| daggers | 6 | mainhand_weapon |
| greatswords | 6 | mainhand_weapon |
| greataxes | 6 | mainhand_weapon |
| hammers1h | 6 | mainhand_weapon |
| hammers2h | 6 | mainhand_weapon |
| spears | 6 | mainhand_weapon |
| bows | 6 | mainhand_weapon |
| crossbows | 6 | mainhand_weapon |
| guns | 6 | mainhand_weapon |
| fireStaves | 6 | mainhand_weapon |
| frostStaves | 6 | mainhand_weapon |
| holyStaves | 6 | mainhand_weapon |
| natureStaves | 6 | mainhand_weapon |
| tools | 6 | hand_tool |
| shields | 6 | offhand_shield |
| lightningStaves | 5 | mainhand_weapon |
| fireTomes | 2 | mainhand_weapon |
| frostTomes | 2 | mainhand_weapon |
| natureTomes | 2 | mainhand_weapon |
| holyTomes | 2 | mainhand_weapon |
| arcaneTomes | 2 | mainhand_weapon |
| lightningTomes | 2 | mainhand_weapon |

## Design armor / back / accessories

**Materials:** `{"cloth":54,"leather":54,"metal":54,"gem":6}`

**Slots:** `{"helm":18,"shoulder":18,"chest":18,"hands":24,"feet":18,"unknown":18,"ring":18,"necklace":18,"relic":18}`

**Kinds:** `{"armor_head":18,"armor_shoulders":18,"armor_body":18,"armor_hands":24,"armor_feet":18,"armor":18,"accessory":36,"offhand_gem":18}`

| Kind | Count | Role |
|------|------:|------|
| armor_head | 18 | body armor |
| armor_shoulders | 18 | body armor |
| armor_body | 18 | body armor |
| armor_hands | 24 | body armor |
| armor_feet | 18 | body armor |
| accessory | 36 | accessory/offhand |
| offhand_gem | 18 | accessory/offhand |
| armor | 18 | body armor |

## Open content weapon prefabs (mesh readiness)

| Id | Family | Slot | Mesh path | Mesh status | Ship |
|----|--------|------|-----------|-------------|------|
| wpn_axe_iron_01 | axe | mainHand | `—` | missing | false |
| wpn_axe_master | axe | mainHand | `models/weapons/axe.glb` | ready | true |
| wpn_bow_master | bow | mainHand | `models/weapons/bow.glb` | ready | true |
| wpn_crossbow_master | crossbow | mainHand | `models/weapons/rifle.glb` | ready | true |
| wpn_dagger_master | dagger | mainHand | `models/weapons/dagger.glb` | ready | true |
| wpn_greataxe_master | greataxe | mainHand | `models/weapons/axe.glb` | ready | true |
| wpn_greatsword_master | greatsword | mainHand | `models/weapons/greatsword.glb` | ready | true |
| wpn_gun_master | gun | mainHand | `models/weapons/pistol.glb` | ready | true |
| wpn_hammer_master | hammer | mainHand | `models/weapons/hammer.glb` | ready | true |
| wpn_mace_master | mace | mainHand | `models/weapons/mace.glb` | ready | true |
| wpn_scythe_master | scythe | mainHand | `models/weapons/war-spear.glb` | ready | true |
| wpn_shield_master | shield | offHand | `models/weapons/shield.glb` | ready | true |
| wpn_spear_master | spear | mainHand | `models/weapons/spear.glb` | ready | true |
| wpn_staff_master | staff | mainHand | `models/weapons/staff.glb` | ready | true |
| wpn_sword_iron_01 | sword | mainHand | `models/weapons/voxel/00.obj` | placeholder | true |
| wpn_sword_master | sword | mainHand | `models/weapons/sword.glb` | ready | true |
| wpn_tome_master | tome | offHand | `models/weapons/shield.glb` | ready | true |
| wpn_wand_master | wand | mainHand | `models/weapons/staff.glb` | ready | true |

## Mesh CDN / Open probes (prefab paths)

| URL | Status | Type | Len |
|-----|--------|------|-----|
| https://assets.grudge-studio.com/models/weapons/axe.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/axe.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/bow.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/bow.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/rifle.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/rifle.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/dagger.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/dagger.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/greatsword.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/greatsword.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/pistol.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/pistol.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/hammer.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/hammer.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/mace.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/mace.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/war-spear.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/war-spear.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/shield.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/shield.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/spear.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/spear.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/staff.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/staff.glb | 200 | model/gltf-binary |  |
| https://assets.grudge-studio.com/models/weapons/voxel/00.obj | 404 | text/plain;charset=UTF-8 |  |
| https://open.grudge-studio.com/models/weapons/voxel/00.obj | 404 | text/plain;charset=UTF-8 |  |
| https://assets.grudge-studio.com/models/weapons/sword.glb | 200 | model/gltf-binary |  |
| https://open.grudge-studio.com/models/weapons/sword.glb | 200 | model/gltf-binary |  |

## Local weapon meshes

| File | Bytes | Rough class |
|------|------:|-------------|
| `axe.glb` | 14812 | melee hand |
| `bow-craft-1.glb` | 60588 | bow ~1.0–1.5m |
| `bow-craft-13.glb` | 51860 | bow ~1.0–1.5m |
| `bow-craft-20.glb` | 187312 | bow ~1.0–1.5m |
| `bow-craft-5.glb` | 144576 | bow ~1.0–1.5m |
| `bow-craft-7.glb` | 92732 | bow ~1.0–1.5m |
| `bow.glb` | 11564 | bow ~1.0–1.5m |
| `cane-1.glb` | 20272 | staff/cane ~1.4–2.0m |
| `cane-10.glb` | 55796 | staff/cane ~1.4–2.0m |
| `cane-11.glb` | 87904 | staff/cane ~1.4–2.0m |
| `cane-12.glb` | 62996 | staff/cane ~1.4–2.0m |
| `cane-13.glb` | 19528 | staff/cane ~1.4–2.0m |
| `cane-14.glb` | 28552 | staff/cane ~1.4–2.0m |
| `cane-15.glb` | 52908 | staff/cane ~1.4–2.0m |
| `cane-16.glb` | 33140 | staff/cane ~1.4–2.0m |
| `cane-17.glb` | 56948 | staff/cane ~1.4–2.0m |
| `cane-18.glb` | 39308 | staff/cane ~1.4–2.0m |
| `cane-19.glb` | 62152 | staff/cane ~1.4–2.0m |
| `cane-2.glb` | 40844 | staff/cane ~1.4–2.0m |
| `cane-20.glb` | 120508 | staff/cane ~1.4–2.0m |
| `cane-21.glb` | 63860 | staff/cane ~1.4–2.0m |
| `cane-22.glb` | 48140 | staff/cane ~1.4–2.0m |
| `cane-23.glb` | 130104 | staff/cane ~1.4–2.0m |
| `cane-24.glb` | 79436 | staff/cane ~1.4–2.0m |
| `cane-3.glb` | 82676 | staff/cane ~1.4–2.0m |
| `cane-4.glb` | 53316 | staff/cane ~1.4–2.0m |
| `cane-5.glb` | 35656 | staff/cane ~1.4–2.0m |
| `cane-6.glb` | 57140 | staff/cane ~1.4–2.0m |
| `cane-7.glb` | 75764 | staff/cane ~1.4–2.0m |
| `cane-8.glb` | 101684 | staff/cane ~1.4–2.0m |
| `cane-9.glb` | 101300 | staff/cane ~1.4–2.0m |
| `dagger.glb` | 6680 | dagger ~0.2–0.45m |
| `greatsword.glb` | 7716 | 2H ~1.2–1.8m |
| `gunblade.glb` | 8404 | sidearm ~0.2–0.4m |
| `hammer.glb` | 10552 | melee hand |
| `hunter-rifle.glb` | 4273208 | rifle ~0.9–1.3m |
| `javelin.glb` | 8184 | melee hand |
| `mace.glb` | 570192 | melee hand |
| `pistol.glb` | 34380 | sidearm ~0.2–0.4m |
| `revolver.glb` | 67484 | sidearm ~0.2–0.4m |
| `rifle.glb` | 106996 | rifle ~0.9–1.3m |
| `roman-shield.glb` | 11688868 | shield ~0.5–1.0m |
| `sculk-sword.glb` | 140468 | melee hand |
| `shield.glb` | 8860 | shield ~0.5–1.0m |
| `sickle.glb` | 2650652 | weapon |
| `spear.glb` | 8184 | melee hand |
| `staff.glb` | 8840 | staff/cane ~1.4–2.0m |
| `stone-sword.glb` | 159664 | melee hand |
| `sword.glb` | 8404 | melee hand |
| `wand-arcane.glb` | 45668 | staff/cane ~1.4–2.0m |
| `wand-fire.glb` | 96936 | weapon |
| `wand-frost.glb` | 54236 | weapon |
| `wand-holy.glb` | 37104 | weapon |
| `wand-lightning.glb` | 53076 | weapon |
| `wand-nature.glb` | 41156 | weapon |
| `war-claw.glb` | 167716 | weapon |
| `war-spear.glb` | 915840 | melee hand |

## Attach points (SSOT)

| Role | Bones / containers |
|------|--------------------|
| Main hand | `R_hand_container`, `Bip001 R Hand` |
| Off hand / shield | `L_hand_container`, `L_shield_container`, `Bip001 L Hand` |
| Back (cape/quiver) | `Bip001 Spine/Spine1`, `back_container`, `quiver_container` |
| Armor body | grudge6 modular mesh_ids / child mesh toggles — not Meshy heroes |

## Review findings

- **Strength:** Clear SI pipeline docs for weapon vs character convert flags
- **Strength:** Open content/weapons prefabs map family→mesh path + readiness
- **Strength:** Runtime WeaponId roster + hand containers documented
- **Strength:** Local models/weapons has craft canes/bows + core glbs
- **Gap:** Fleet weapons.json has ZERO 3d model fields — icons only
- **Gap:** Armor catalog is stats/icons by material; weak mesh_ids binding to grudge6
- **Gap:** Back slot defined but few dedicated back meshes in Open public/
- **Gap:** hunter-rifle.glb multi-MB — needs scale/collider + LOD review
- **Gap:** Many cane-* craft weapons may lack grip SSOT in Weapons.ts GRIPS

## Scale QA checklist (per mesh)

1. For each ready mesh: measure AABB max dim in metres
1. Compare to expectedWeaponLengths_m band for family
1. Confirm grip: blade tip not at hand; pommel/hilt at origin
1. Shield: center or rim grip consistent with L_shield_container
1. Armor pieces: no skin, feet ground, height ~1.7-1.9m if full body shell
1. Back: parented to spine container, not R_hand

## Full inventory JSON

Machine-readable dump: `reports/HAND_ARMOR_BACK_INVENTORY.json`
