# Weapon → live baked animations

**SSOT:** `content/anims/weapon-live-packs.json`  
**Integrity:** `npm run anims:verify:write` → `content/manifests/anims.integrity.json` + `weapon-live-anims.json`  
**API:** `liveAnimPackForWeapon` / `liveBakeRelsForWeapon` in `src/three/anim/weaponLivePacks.ts`

## Best practice

| Rule | Detail |
|------|--------|
| **One live pack per equip** | Equipping `greatsword` loads **twohand** (or **polearm** fallback), not all packs |
| **SHA-256 integrity** | Every shipped `anims/baked/**/*.json` is hashed; CI can fail on drift |
| **Mixamo skill SHAs** | Declared `mixamoSources` per weapon are hashed when FBX present (`mixamoDeclaredByWeapons`) |
| **Complete live set** | Every equip must resolve **idle/walk/run/attack** (ready or explicit degraded fallback) — never half-wired |
| **liveWhenIncomplete** | Preferred pack missing → named fallbacks that **exist** in bake (e.g. polearm idle/attack) |
| **inheritsFrom** | Aliases (dagger→sword, javelin→spear) inherit roles + incomplete map |
| **Mixamo is authoring** | `public/anim/**/*.fbx` verified when present; **not** live on Vercel (`.vercelignore`) |
| **Baked is production** | Same-origin `/anims/baked/{rel}.json` first |
| **Strip position tracks** | Always on grounded Bip001 kits |
| **Banned loco** | Never `locomotion/running` (run-to-roll) |
| **Shared traversal** | jump/dodge always load with any weapon |

### Live resolution priority (when equipping `"weapon name"`)

1. `liveRoles[role]` if baked JSON exists (status **ready**)
2. `liveWhenIncomplete[role]` if baked (status **fallback** / degraded)
3. Convention `{fallbackPack}/{role}` if baked
4. Shared loco aliases (`magic/Standing Walk Forward`, `polearm/idle|attack`, torch run, …)
5. Else **incomplete** — `anims:verify:strict` fails CI

## Equip contract

```
equip weaponId
  → liveAnimPackForWeapon(weaponId)     // e.g. "polearm"
  → liveBakeRelsForWeapon(weaponId)     // idle/walk/run/attack + skills + traversal
  → loadBakedClip each bakeRel (SHA known from integrity manifest)
  → AnimationDirector / mixer roles
```

### Example: spear

| Role | Live bake rel |
|------|----------------|
| idle | `polearm/idle` |
| walk | `polearm/walk` |
| run | `polearm/run` |
| attack | `polearm/attack` |
| skill1–4 | `polearm/skill1` … |
| jump/dodge | shared traversal |

### Example: greatsword (bake incomplete)

| Role | Preferred | Live now |
|------|-----------|----------|
| idle | `twohand/idle` | **fallback** `polearm/idle` |
| attack | `twohand/attack` | **fallback** `polearm/attack` |

Status in verify report: **degraded** until twohand bake ships.

## Commands

```bash
# Hash all baked JSON + per-weapon live matrix
npm run anims:verify:write

# One weapon
node scripts/verify-anim-integrity.mjs --weapon greatsword

# Fail CI if any weapon missing required idle/walk/run/attack
npm run anims:verify:strict

# After editing weapon-live-packs.json
npm run anims:sync
```

## Integrity manifest fields

```json
{
  "algorithm": "sha256",
  "baked": [{ "bakeRel": "polearm/idle", "sha256": "...", "bytes": 12345 }],
  "mixamoSources": [{ "sourceRel": "anim/sword/....fbx", "sha256": "..." }],
  "summary": { "weaponsReady": N, "weaponsDegraded": N, "weaponsIncomplete": N }
}
```

Remote check (optional):

```bash
node scripts/verify-anim-integrity.mjs --base https://open.grudge-studio.com --write
```

Compares local SHA vs production JSON body (detects stale CDN/deploy).

## Weapon quick map

| weaponId | Live pack | Fallback |
|----------|-----------|----------|
| none | unarmed | — |
| sword, axe, dagger, mace, hammer, shield | sword_shield | magic / unarmed |
| spear, javelin | **polearm** | — |
| greatsword, greataxe, hammer2h, scythe | twohand | **polearm** |
| bow, longbow | longbow | magic |
| crossbow | crossbow | **longbow** |
| staff*, wand, tome | magic | — |
| rifle, hunter-rifle, shotgun, pistol | rifle | **unarmed** |

## Organization of folders

```
content/anims/
  database.json           # full clip DB + surfaces (swim/climb/harvest)
  states.json             # state machine
  weapon-live-packs.json  # THIS FILE — equip → live roles
  explosive-warrior-map.json

public/anims/baked/       # PRODUCTION live (hashed)
public/anim/              # Mixamo author sources (local only)

content/manifests/
  anims.integrity.json    # generated SHAs
  weapon-live-anims.json  # generated per-weapon live snapshot
```
