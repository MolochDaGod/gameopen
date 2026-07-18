# Witch Hut projectiles (arrow / missile / disk)

**Source:** `C:\Users\nugye\Documents\witch_hut_in_a_swamp.glb`  
(User path `float_hut_in_a_swamp.glb` → same file on disk.)

**CDN**
- VFX pack: `https://assets.grudge-studio.com/models/vfx/witch_hut_in_a_swamp.glb`
- World / legion island: `https://assets.grudge-studio.com/models/worlds/witch_hut_in_a_swamp.glb`

**Code**
- `three/fx/witchHutProjectiles.ts` — load, scale variants, material anim
- `three/Vfx.ts` — `castWitchArrow` / `castWitchMissile` / `castWitchDisk`
- Catalog: `content/vfx/witch-hut-projectiles.json`

## Authored transforms (Unity/Blender placement)

| Variant | Scale | Role |
| --- | --- | --- |
| **Arrow** | `0.1276 · 2.0858 · 0.1011` | Long thin projectile (also **legion island** stretch) |
| **Missile** | `0.22 · 1.4 · 0.18` | Spinning spell bolt (homing) |
| **Disk** | `3.9617 · 0.1837 · 3.3952` | Spinning AOE path disc |

Position/rotation default to origin; flight orients `align [0,1,0]` to travel for arrow/missile.

## Material animations

Hut textures are kept; per-spawn materials animate:

| Anim | Effect |
| --- | --- |
| `emberScroll` | UV scroll + hot emissive pulse (arrow) |
| `arcanePulse` | UV rotate + purple emissive (missile) |
| `swampGlow` | Soft UV drift + green emissive (disk) |

## Skill kinds

| SkillKind | Vfx |
| --- | --- |
| `witchArrow` | Scaled arrow flight + trail |
| `witchMissile` | Homing spinning missile |
| `witchDisk` | Ground-seeking spinning AOE + shockwave |

Also: default `bolt` skills use witch arrow mesh when the pack loads.

## Weapon skill wiring (selected)

| Kit | Skills → |
| --- | --- |
| **Ranger** | Aimed Shot / Piercing Arrow → `witchArrow` |
| **Mage** | Elemental Blast / Bolt → `witchMissile`; Cataclysm / Arcane Nova → `witchDisk` |

## D1

`asset_registry` row for `models/vfx/witch_hut_in_a_swamp.glb` with `animation_packs` JSON:
`skillKinds`, `variants`, `weaponSkillBindings`, `legionIsland` scale.

## Legion island

Place world mesh with scale `[0.1276, 2.0858, 0.1011]` at origin for elongated island silhouette (same transform as arrow).
