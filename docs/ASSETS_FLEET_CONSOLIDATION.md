# Fleet asset consolidation (verified)

**Generated:** 2026-07-29T10:03:59.363Z  
**Skeleton SSOT:** `Bip001`  
**Anim bind:** rematchClipToSkeleton + stripPositionTracks  
**Character mesh SSOT:** grudge6 `*_Characters.glb` on R2  

## Stack checks

| Check | OK |
|-------|----|
| grudge6-glb-ssot | ✅ — GRUDGE6_RACE_GLB + slug helper in fleetAssetResolver |
| race-prefers-grudge6 | ✅ — RACE_CHARACTERS use grudge6 path + Bip001 hand bones |
| bip001-rematch-strip | ✅ — skeleton.ts rematch + strip positions |
| race-aliases-unshift | ✅ — pathAliases unshifts grudge6 for models/races/* |
| polearm-complete | ✅ — polearm pack complete (fallback backbone) |
| orbs-not-fireball-scene | ✅ — staff orbs extracted (not whole fireball.glb) |

**Stack consistent:** ✅ YES

## Weapon status (runtime-accurate)

| Status | Count | Meaning |
|--------|------:|---------|
| **green** | 2 | Preferred clips on disk |
| **yellow** | 27 | **Playable** via `liveWhenIncomplete` (polearm / shared loco) |
| **red** | 0 | Not playable even with fallbacks |
| **playable total** | 29 / 29 | green + yellow |

> Yellow is **not broken**. Runtime `pickLiveBakeRel` / `liveBakeRelsForWeapon` already uses incomplete fallbacks. Red means a real gap.

### Yellow (playable fallbacks)

- **none** (unarmed): attack→polearm/attack
- **sword** (sword_shield): idle→polearm/idle, attack→polearm/attack
- **shield** (sword_shield): idle→polearm/idle, attack→polearm/attack
- **axe** (sword_shield): idle→polearm/idle, attack→polearm/attack
- **dagger** (sword_shield): idle→polearm/idle, attack→polearm/attack
- **mace** (sword_shield): idle→polearm/idle, attack→polearm/attack
- **hammer** (sword_shield): idle→polearm/idle, attack→polearm/attack
- **greatsword** (twohand): idle→polearm/idle, walk→polearm/walk, run→polearm/run, attack→polearm/attack
- **greataxe** (twohand): idle→polearm/idle, walk→polearm/walk, run→polearm/run, attack→polearm/attack
- **hammer2h** (twohand): idle→polearm/idle, walk→polearm/walk, run→polearm/run, attack→polearm/attack
- **scythe** (twohand): idle→polearm/idle, walk→polearm/walk, run→polearm/run, attack→polearm/attack
- **bow** (longbow): idle→polearm/idle, attack→polearm/attack
- **longbow** (longbow): idle→polearm/idle, attack→polearm/attack
- **crossbow** (crossbow): idle→polearm/idle, walk→longbow/standing walk forward, run→longbow/standing run forward, attack→polearm/attack
- **staff** (magic): idle→polearm/idle, attack→polearm/attack
- **staffFire** (unarmed): idle→polearm/idle, walk→polearm/walk, run→polearm/run, attack→polearm/attack
- **staffIce** (unarmed): idle→polearm/idle, walk→polearm/walk, run→polearm/run, attack→polearm/attack
- **staffStorm** (unarmed): idle→polearm/idle, walk→polearm/walk, run→polearm/run, attack→polearm/attack
- **staffNature** (unarmed): idle→polearm/idle, walk→polearm/walk, run→polearm/run, attack→polearm/attack
- **staffHoly** (unarmed): idle→polearm/idle, walk→polearm/walk, run→polearm/run, attack→polearm/attack
- **wand** (magic): idle→polearm/idle, attack→polearm/attack
- **tome** (magic): idle→polearm/idle, attack→polearm/attack
- **rifle** (rifle): idle→unarmed/fight_idle, walk→magic/Standing Walk Forward, run→uploads_2026_06/locomotion/torch run forward, attack→polearm/attack
- **hunter-rifle** (rifle): idle→unarmed/fight_idle, walk→magic/Standing Walk Forward, run→uploads_2026_06/locomotion/torch run forward, attack→polearm/attack
- **shotgun** (rifle): idle→unarmed/fight_idle, walk→magic/Standing Walk Forward, run→uploads_2026_06/locomotion/torch run forward, attack→polearm/attack
- **pistol** (rifle): idle→unarmed/fight_idle, walk→magic/Standing Walk Forward, run→uploads_2026_06/locomotion/torch run forward, attack→polearm/attack
- **gunblade** (sword_shield): idle→polearm/idle, attack→polearm/attack

### Red (must fix)

✅ **None** — every weapon is playable on the current stack

## Baked packs on disk

- **locomotion**: 2 files
- **longbow**: 5 files
- **magic**: 2 files
- **polearm**: 35 files
- **sword_shield**: 1 files
- **unarmed**: 1 files
- **uploads_2026_06/locomotion**: 1 files

## Best stack (enforced)

| Layer | System |
|-------|--------|
| Race kit | `models/grudge6/races/{WK,BRB,ELF,DWF,ORC,UD}_Characters.glb` |
| Lab fallback | `models/races/*.glb` only if grudge6 fails |
| Skeleton | Bip001 — unifySkeletons + rematchClipToSkeleton |
| Anim policy | stripPositionTracks on grounded kits |
| Weapon → pack | weapon-live-packs.json |
| Incomplete packs | liveWhenIncomplete → polearm (+ magic/longbow walk where baked) |
| Staff VFX | models/vfx/orbs/orb-*.glb |
| Deploy | characterDeploy facePlusZ auto, feet Box3 |

## Next bake (turn yellow → green)

1. sword_shield: idle + attack (unblocks sword/axe/shield preferred path)
2. magic: standing idle + cast attack
3. longbow: standing idle + aim recoil
4. unarmed: punch/attack
5. Ship anims/baked to Open public + R2

---
*Re-run: `npm run assets:consolidate`*
