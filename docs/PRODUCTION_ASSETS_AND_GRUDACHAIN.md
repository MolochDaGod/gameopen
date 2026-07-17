# Production assets + GRUDACHAIN test library

How Open loads **icons, items, equipment, main panels, and heroes** for full production play and QA.

## SSOT layers (do not invert)

| Layer | Authority | Open access |
|-------|-----------|-------------|
| **Player state** | Railway Postgres | same-origin `/api/characters`, `/api/account` |
| **Definitions** | `info.grudge-studio.com/api/v1` | `fetchCatalogJson()` / `productionMedia` |
| **Binaries** | `assets.grudge-studio.com` (R2) | `fleetAssetResolver`, icon URLs |
| **Asset index** | D1 registry | optional; never inventory SSOT |
| **Worlds** | Mine-Loader Railway | `/api/blocks`, `/api/worlds` |

**Never** use localStorage as sole character/equipment truth.  
**Never** ship Meshy / permanent capsules as production heroes.

## Code modules

| Module | Role |
|--------|------|
| `lib/productionMedia.ts` | Warm master-items/materials/weapons; resolve item icons |
| `lib/gameMedia.ts` | HUD/craft/harvest icons → productionMedia when warm |
| `lib/characterEquipmentMesh.ts` | Account equipment → mesh_ids + slot icons |
| `lib/characterPortrait.ts` | Portrait cascade (DB → open → race×class → CDN) |
| `lib/characterLoadout.ts` | Open save bag (weapon, meshIds) on Railway character |
| `lib/startingEquipment.ts` | Create/repair starter mesh_ids + paperdoll slots |
| `lib/grudachainTestLibrary.ts` | QA library: readiness, repair, deploy targets |
| `lib/fleetSsot.ts` | Catalog host candidates + content fetch |
| Craftpix HUD / ClassSkillTreePanel | Harvest/build + production trees UI |

Boot: `App` calls `bootstrapProductionMedia()` once. Account + Production shell re-warm when opened.

## Icon resolve order

1. Explicit `iconUrl` on equipment / item row  
2. **master-items** (and materials) via `productionItemIconUrl`  
3. R2 pack (`assets…/icons/pack/…`)  
4. Same-origin `public/icons/*`  
5. Glyph fallback (UI only)

## GRUDACHAIN test heroes

**Identity:** sign in with Grudge ID on the **GRUDACHAIN** account (or any fleet account used for QA).  
**Store:** Railway characters with `equipment.mesh_ids` + `saveData.open` loadout.

### Account Hub → **GRUDACHAIN QA** tab

- Lists all roster heroes with portrait, weapon icon, mesh count, readiness score  
- **Repair gear** — PATCH starter class preset (mesh_ids + open loadout)  
- **Repair all incomplete** — batch for heroes score &lt; 70 or missing meshes  
- **Play Danger** — select character + enter Danger Room  

### Production shell (P) → **Characters**

- Prefers GRUDACHAIN cards (score + meshes) above generic fleet list  

### Danger / Explorer

- `App` applies `resolveCharacterEquipmentVisual` → Studio mesh_ids + race kit  
- Portraits via `resolveCharacterPortrait`  

### Readiness score (0–100)

| Points | Check |
|--------|--------|
| 15 | UUID |
| 15 | race |
| 10 | class |
| 25 | ≥3 mesh_ids |
| 10 | equipment source mesh_ids or gear_preset |
| 10 | slot icons |
| 10 | weapon |
| 5 | portrait |

**Production ready** ≈ score ≥ 70 and ≥ 3 mesh_ids.

## Fix / edit / deploy loop

```
1. Sign in (Grudge ID) as GRUDACHAIN
2. Account → Characters → create hero with starting gear
   OR Account → GRUDACHAIN QA → Repair incomplete
3. Verify paperdoll + mesh list on Account
4. Play Danger → textured grudge6 kit + equipped weapon
5. P → Trees (Part 5 skill book) · Characters (import hero)
6. Harvest/Build → Craftpix Part 3 bar (HP/SP, tools, gold)
```

## Platform surfaces (same account)

| Surface | Characters | Icons / items |
|---------|------------|---------------|
| open.grudge-studio.com / gameopen | Railway roster | productionMedia |
| Danger Room | mesh_ids + arsenal | skillIcons + slot icons |
| Production (P) | import + skill trees | gameMedia + craftpix |
| Account paperdoll | equipment bag | production icons |
| Mine-Loader handoff | same characterId + JWT | codex block icons |
| Warlords / crafting Puter | same Railway bag | ObjectStore items |

## Smoke checklist

- [ ] `GET info…/master-items.json` 200  
- [ ] `GET assets…/icons/pack/weapons/Sword_01.png` 200  
- [ ] `GET …/api/health` Railway 200  
- [ ] Sign in → Account GRUDACHAIN QA shows cards  
- [ ] Repair → mesh_ids ≥ 3 after refresh  
- [ ] Danger spawn uses race kit (not yellow untextured capsule)  
- [ ] Craft recipe chips show images after media warm  
- [ ] Harvest mode shows Craftpix bar; Trees shows Part 5 skill panel  

## Related skills

- `grudge-production-wiring`  
- `grudge-warlords-assets`  
- `grudge6-modular-characters`  
- `grudge-d1-r2`  
