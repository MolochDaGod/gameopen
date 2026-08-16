# Back slot SSOT (Open)

**Contract:** `content/docs/BACK_SLOT_PREFAB.md`  
**Prefabs:** `content/backs/catalog.json` + `content/backs/bck_*.json`  
**Runtime:** `artifacts/animator/src/three/equipment/backSlotItems.ts`

One Back equip. Items *are* the effects. No second effect radial. No new combat hotkeys.

| Equip | I paperdoll Back · harvest Hold **R** → Back · `equip:back:*` |
| Use (hotkey) | **Space** — jump / flap / glide (Controller already owns Space) |
| Deploy | **Space** on water · **E** get-off (windsurf) |
| Passive | no extra key — aura / waterBuffs / defense while worn |
| Do not steal | Combat **R** (heavy) · Combat **E** (guard, unless on a vehicle) |

See catalog for per-item assets and `useKind`.

Icons: R2 pack (`icons/pack/…`, HEAD 200). Recipes: `rcp_back_*` in `content/harvest/recipes.json` (also `public/content/harvest/recipes.json`). Craft output is unique `itm_back_*` (ledger when signed in).
