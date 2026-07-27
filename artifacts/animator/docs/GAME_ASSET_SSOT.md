# Open / Danger Room — Game Asset SSOT

**This is a completed game.** Assets already ship in `public/` and on R2.  
Agents must **resolve** existing files — never invent Meshy/capsules or leave dead paths.

## Production hosts (probed live)

| Host | Role |
|------|------|
| `open.grudge-studio.com` + `public/` | Full lab pack: models, anims/baked, props, vfx, races, content JSON |
| `assets.grudge-studio.com` | R2 binaries: grudge6 races, props, camp, heroes, icons |
| `open…/cdn/assets/characters/{race}/` | Same-origin arena race GLBs (proxy) |

### Race combat kits (always-right)

```
R2:  assets.grudge-studio.com/models/grudge6/races/{WK|BRB|ELF|DWF|ORC|UD}_Characters.glb
Open: /cdn/assets/characters/{human|barbarian|elf|dwarf|orc|undead}/*_Characters.glb
```

Load order in `grudge6Runtime`: **R2 first** → same-origin arena → never `assets…/cdn/assets/…` (404).

### Heroes / cinema (real GLBs)

`racalvin.glb` · `karate-boss.glb` · `orc.glb` · `skeleton-warrior.glb` · `dungeon.glb` · `dj-booth.glb`

Missing names (`introgamer`, `astrocreeper`) **alias** to the list above.

### Props / camp

`models/props/dying-torch.glb` · `torch.glb` · `torch-burning.glb` · `models/camp/claim-flag.glb`

### Anims

`public/anims/baked/{sword_shield,longbow,magic,polearm,unarmed,locomotion}/`

### Definitions

`public/content/grudge6-gear-presets.json` + in-code `gearPresets.ts`  
Do **not** hit `molochdagod.github.io` (CSP blocked).

## Code contract

1. **Loaders:** `loadGltfFirst` / `resolveAssetCandidates` only — not bare relative `fetch`.
2. **Equip before fit** on modular race kits (`hideEquippable` → mesh_ids → 1.8 m).
3. **Warrior = sword_shield** + sword/shield meshes (sturdy MMO).
4. **Auth:** one `session/exchange` with circuit-breaker — no 429 storms.
5. **401 `/api/auth/me`** when guest = expected.

## Confirm

```
[ ] human_warrior loads WK GLB from R2 or open CDN
[ ] One body + head + sword + shield visible
[ ] Height ~1.8 m, uniform scale
[ ] sword_shield idle plays
[ ] No exchange 429 spam
[ ] doors stage shows racalvin/karate, not infinite 404
```
