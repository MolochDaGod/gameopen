# grudge6 character meshes on Open

## Production kits (modular race)

`https://assets.grudge-studio.com/models/grudge6/races/{WK|BRB|ELF|DWF|ORC|UD}_Characters.glb`

## Outline / look multipack (ALLOWED — owner admin 2026-08)

| Asset | Path |
|-------|------|
| **30characters.glb** | `D:\Games\Models\_anim_packs\30characters.glb` (best game-ready grudge6 **outline**) |
| Weapon anim packs | `D:\Games\Models\_anim_packs\sword_shield`, `longbow`, `magic_spell`, `rifle`, `pistol`, `greatsword`, `locomotion`, … |

**Rules when using 30characters:**

1. Isolate the hero mesh by name / mesh_ids — do not show the entire multipack fused.  
2. SI feet ground (Box3 min.y), art-forward +Z for grudge6.  
3. Combat / loco clips from `_anim_packs` (or CDN baked Bip001 JSON) — strip hip/root position tracks.  
4. Prefer race CDN kits when modular equip is required; 30characters is outline + portrait quality SSOT.

## Still banned

- Random **Meshy** / grey **capsule** placeholders as production heroes  
- Secondary arena host as character SSOT  

Danger Room default: grudge6 combat rig (`loadGrudge6CombatRig`) and/or 30characters outline + pack clips — **not** Meshy.
