# Open library — era taxonomy (no duplicate games)

**open.grudge-studio.com** is the fleet launcher. Games are filed by **production era** so imports/deploys never collide.

| Era | Category id | Meaning |
|-----|-------------|---------|
| **Voxel** | `voxel` | VoxGrudge production, Mine-Loader Realms, DCQ, Z-Brawl, Worldbuilder, voxel arenas |
| **Warlords** | `warlords` | Fantasy flagship, Genesis, islands, Danger Room, dressing, grudge6 |
| **Nexus** | `nexus` | Sci-fi / mech / metaverse / Carrier |
| **Armada** | `armada` | Naval, Grim Armada, sail maps |
| **Account** | `account` | SSO / characters / lobby shell only |

Code SSOT: `artifacts/animator/src/game/gameLibrary.ts` (`ERA_CATEGORIES`, `GAME_LIBRARY`).

---

## Desktop audit — `C:\Users\nugye\Desktop\grudgeproduction\voxgrudge`

### What this folder is
- **Asset + source kit** for the **one** production voxel open world.
- Vercel routes `/` → `grudge-warlords-openworld.html` (`vercel.json`).
- Live hosts (probed 200): **https://voxgrudge.vercel.app/** · GRUDOX **https://grudox.grudge-studio.com/voxgrudge/**

### HTML entry points (do **not** register each as a separate Open game)

| File | Role | Open treatment |
|------|------|----------------|
| `grudge-warlords-openworld.html` | **Production SSOT** entry | **VoxGrudge Full World** only |
| `index.html` / `index.live.html` / `live.html` | Older / mirror builds | **Discard as launchers** (worse/legacy) |
| `grudge-warlords-vox.html` | Smaller fork | **Not listed** |
| `z-brawl.html` | Arena kit | Use fleet **Z-Brawl** URL, not Desktop path |
| `voxel-editor.html` | Thin local editor | Open **Worldbuilder** / VoxGrudge Lab |
| `character-builder.html` / Ultimate Character Builder | Local builders | **Dressing Room** + Account / Foundry |
| `class-selector.html` / `grudge-guide.html` | UX helpers | Not games |

### Assets kept as kit (not games)
- `models/` (kenney, city, creatures, vehicles, anims)
- `js/` (world-engine, kenney-*, vox-*, grudge-*)
- `ui/`, `vfx/`, `branding/`, `_unzipped/` packs
- `asset-audit.json` — 624 models, ~53 referenced; many root GLBs are **props**, not apps

### Sibling `Desktop\grudgeproduction\vox\` (experimental HTML)
`arpgvox`, `boxing`, `cardriving`, `citybuilder`, `fpsshooting`, `rpgbase`, `rts*`, `voxsandbox`, `voxxelworld` — **labs only**. Promote only with a **live Vercel URL** under the correct era; never copy as parallel production.

---

## Production voxel games on Open (required set)

| Library id | Live URL / mode | Status |
|------------|-----------------|--------|
| `voxgrudge` | voxgrudge.vercel.app | live |
| `mine-loader-realms` | mine-loader.vercel.app | live |
| `dungeon-crawler` | dcq.grudge-studio.com | live |
| `z-brawl` | grudox …/arcade/play/z-brawl | live |
| `voxgrudge-battle` | native Open | beta |
| `ruins-brawler` | native Open | live |
| `voxel-editor` (Worldbuilder) | native Open | live |
| `survival-grudges` | grudges.grudge-studio.com | live |
| `angel-island` | angel-island.vercel.app | live |
| `grudox-games` | grudox.grudge-studio.com/games | live |
| `island-life` | native danger map path | beta |

Lab only (not “full game”): `voxgrudge-lab`.

---

## Import rules (agents)

1. **One production title per product.** Desktop HTML forks are sources, not library rows.
2. **Era first.** New content → `category: "voxel" | "warlords" | "nexus" | "armada"`.
3. **Live URL required** before `status: "live"` / `featured: true`.
4. Use **Import Bay** scaffolds (`nexus-slot`, `armada-slot`) only as shelves until a real deploy exists — then **replace** the scaffold, don’t add a second copy.
5. Prefer **native Open** or **in-app embed** over raw `file://` or unlisted Desktop paths.

---

## Probed hosts (2026-07-20)

All returned HTTP 200:

- open.grudge-studio.com  
- voxgrudge.vercel.app  
- mine-loader.vercel.app  
- dcq.grudge-studio.com  
- grudox.grudge-studio.com/arcade/play/z-brawl  
- grim-armada-web.vercel.app  
- grudgewarlords.com  
- warlord-genesis.vercel.app/lobby  
- play.grudge-studio.com  
- grudges.grudge-studio.com  
