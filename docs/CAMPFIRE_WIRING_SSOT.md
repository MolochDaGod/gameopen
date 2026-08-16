# Campfire entry + fleet wiring SSOT

**Surface:** `open.grudge-studio.com/characters` · `/lobby` · `?door=characters`  
**UI:** `CampfireLobby` + `CampfireLobbyScene` (TVS farm props)  
**Entry:** `lib/entryCatch.ts` · `lib/openRoutes.ts` · `auth/characterHubLaunch.ts`  
**Assets:** `lib/productionSystemsPattern.CAMPFIRE_TVS` → `assets.grudge-studio.com/models/campfire-lobby/tvs/*`  
**Voxel backdrop:** Encament Fruzer bake (`ENCAMPMENT_BACKDROP`) sits **behind** the fire. Play start = Open **Enter Encament** / **Starting Lobby Town** with the selected campfire explorer (`ExplorerCharacter` + `voxelLook`).

Do **not** invent a second roster hub. Extend this wiring only.

---

## Entry (must land on campfire)

| URL | Mode |
|-----|------|
| `/characters` | CampfireLobby |
| `/lobby` | CampfireLobby (same 4 seats) |
| `?door=characters` / `campfire` / `charactersgrudox` | CampfireLobby |
| Create-hero `returnTo` | **`/characters`** (not account) |
| Account equip | `/account` |

**Bug fixed 2026-08:** `from=charactersgrudox` used to force **account** and stole `door=characters`. Explicit campfire paths now win.

---

## Connection matrix (campfire → systems)

| Destination | How | Host / mode |
|-------------|-----|-------------|
| Danger Room | local `danger` + hero | open `/danger` |
| Harvestables | external handoff | open `/danger?activity=harvest` |
| Deployables / blocks | local `voxel` | open `/voxel` Worldbuilder |
| World map · POIs | external + characterId | client `/island-3d?mode=lobby` |
| Home island · bag | external | client `/home-island` |
| Zones catalog | local `zones` | open zones |
| Mine-Loader Realms | local `realms` / minegrudge | open + mineloader |
| Arcade cabinets | same-origin `/arcade/*` | open → GRUDOX edge |
| **Grudges Encament** | local VoxelArena + explorer | Open play · `grudges_encampment` + seed |
| **Starting lobby town** | local VoxelArena + explorer | Open play · `animal_company_lobby` + seed |
| Warlords full | external | grudgewarlords / client |
| Assets CDN | link only | assets.grudge-studio.com |
| Avatar / dressing | local avatar / editor | open |
| Create hero | Foundry return `/characters` | character.grudge-studio.com |

Railway remains **player** SSOT (characters, bag, island claim).  
CDN/R2 remains **mesh** SSOT. D1 is **asset index** only.

**Voxel seats:** `GET /api/characters?era=voxel` → `buildVoxelCampfireHeroes` → Explorer `createAnimatedCharacter` sit/idle on chairs. Do **not** put Warlords grudge6 bodies in these seats.

---

## Scene assets

CDN first (Vercel bans `.glb` in SPA):

```
https://assets.grudge-studio.com/models/campfire-lobby/tvs/{campfire,chair,fence,tree,…}.glb
```

Smoke: `npm run smoke:prod:open` · HEAD critical TVS files.

---

## Agent rules

1. Launch handoffs via `HUB_DESTINATIONS` / `launchHubDestination` or `CampfireLobby` `MenuDest` — not ad-hoc hosts.  
2. Never map campfire Create → AccountPanel.  
3. Map load on Warlords rebinds terrain only — keep character/session (fleet hard rules).  
4. Extend `entryCatch` for new loops; do not add a parallel router.
