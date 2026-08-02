# Animation content SSOT

**Fleet law (rigs · loaders · deploys):** [`docs/ANIMATION_FLEET_SSOT.md`](../../docs/ANIMATION_FLEET_SSOT.md)  
**Runtime router:** `artifacts/animator/src/three/anim/fleetAnimSsot.ts`

| Lane | Skeleton | Production clips |
|------|----------|------------------|
| **bip001-baked** | grudge6 Bip001 | `/anims/baked/{pack}/…` + `prod/anims` |
| **mixamo-explorer** | 25-bone Mixamo | `/anim/animations/…` only |

Do **not** cross-bind. Do **not** add per-game skill/anim tables outside this tree + `grudge/anims.ts`.

| File | Purpose |
|------|---------|
| `database.json` | All clips: packs, roles, bake paths, surfaces, weapons |
| `states.json` | State machine states (loco / combat / harvest / climb / swim) |
| `weapon-live-packs.json` | **Equip weapon name → live baked roles** (+ incomplete fallbacks) |
| `explosive-warrior-map.json` | ExplosiveLLC FREE → bake map |
| `../schemas/anim_*.schema.json` | JSON schemas |
| `../manifests/anims.index.json` | Index |
| `../manifests/anims.integrity.json` | **SHA-256** of baked JSON + declared Mixamo skills (generated) |
| `../manifests/weapon-live-anims.json` | Per-weapon live matrix with SHAs (generated) |

**Edit here, then:**

```bash
npm run anims:sync
npm run anims:verify:write   # refresh SHAs + live matrix
npm run anims:verify:strict  # CI: fail if any weapon missing idle/walk/run/attack
```

Runtime embed: `artifacts/animator/src/three/anim/data/`  
Public: `artifacts/animator/public/content/anims/`  

API docs: `docs/ANIM_DATABASE_AND_API.md` · `docs/WEAPON_LIVE_ANIMS.md`
