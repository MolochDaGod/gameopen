# Grudge Open — Game Library & Deploy Best Practices

**Launcher:** https://open.grudge-studio.com  
**Role:** Steam-like game library + Roblox-like create/deploy shell + fleet SSO hub  
**World engine (voxel Realms):** Mine-Loader (`D:\GitHub\minegrudge\Mine-Loader`)  
**Macro stack / D1 / AI:** [OPEN_STACK.md](OPEN_STACK.md)

---

## Architecture (consolidation target)

```
open.grudge-studio.com          (gameopen / animator)
  ├── Library (default home)    Steam-style catalog, launch, filters
  ├── Account                   charactersgrudox races, wallet, credits, treaty
  ├── Native modes              Danger, Brawl, Genesis, VoxGrudge, Voxel Editor…
  ├── External deep-links       Warlords, RTS, DCQ, Island, Metaverse…
  └── Mine-Loader handoff       mineloader.grudge-studio.com (+ mine. edge)
         ├── Vercel SPA         static client
         ├── Railway API        world authority + Postgres (1 replica only)
         └── Cloudflare Worker  edge domain
```

### Never again
- Production **Replit Publish** for Mine-Loader / Realms  
- Multi-replica world servers (in-memory authority splits)  
- Ad-hoc character scale (use `fitCharacterHeight`)  
- Relative UI PNG paths without absolute/CDN fallbacks  

---

## Inventory sources (migration map)

| Cluster | Paths | Action |
|---------|--------|--------|
| **Open launcher** | `D:\GitHub\gameopen` | SSOT for library + native sandboxes |
| **Mine-Loader** | `D:\GitHub\minegrudge\Mine-Loader` (+ F mirror) | World server + voxel Realms |
| **VoxGrudge** | `D:\GitHub\voxgrudge` | HTML open world → prefer Realms for MP |
| **Warlords** | `D:\GitHub\GrudgeWarlords`, `F:\GitHub\GrudgeBuilder` | Flagship external |
| **RTS / Forge** | `Documents\GRUDGE_RTS`, `GrudgeSpaceRTS`, Forge | External + forge editor |
| **DCQ** | `D:\GitHub\Dungeon-Crawler-Quest` | External survival/dungeon |
| **Desktop/Docs kits** | craftpix, voxel packs, Game-Studio-Tool | Assets only → R2 / charactersgrudox |
| **charactersgrudox** | Fantasy-Scene-Creator `artifacts/charactersgrudox` | Race GLB roster |

Catalog code: `artifacts/animator/src/game/gameLibrary.ts`  
UI: `artifacts/animator/src/components/GameLibrary.tsx`  
Posters: `public/rooms/{posterKey}-scene.jpg` (screenshot-style covers; `posterUrl()` → `.jpg`)  
Regenerated 2026-08: danger · mine · brawl · rts · genesis · voxworld · gst-islands · voxgrudge-battle · forest-map · worldbuilder (+ PNG→JPG fallbacks for lobby/dressing/mimic/voxel)

---

## Steam / Roblox patterns we adopt

| Pattern | Steam / Roblox | Grudge Open |
|---------|----------------|-------------|
| Library grid + detail | Store app | `GameLibrary` featured + list + hero |
| One identity | Steam ID | Grudge ID + SSO handoff |
| Characters travel | Roblox avatars | Fleet characters + race GLBs |
| Create tab | Roblox Studio | Voxel Editor + Dressing Room + Forge |
| Deploy | Publish place | Mine-Loader fleet (Vercel/Railway/CF) |
| Social / parties | Groups/chat | Treaty tab + GRUDOX zones |
| Soft currency | Robux/wallet | Credits + Crossmint wallet |

---

## Mine-Loader world contract (editors must honor)

1. **Worlds are server-authoritative** — client never owns block truth.  
2. **One API replica** — memory world + Postgres flush.  
3. **Deploy path** — local tree or GitHub → **not** Replit.  
4. **Same-origin `/api/*`** on the SPA rewrite to Railway.  
5. **SSO** — open every Realms launch with `grudge_token` / `characterId` / `open=1`.  
6. **Docs** — `Mine-Loader/docs/FLEET_DEPLOY.md`.

Voxel Editor maps in gameopen should eventually **push** to Mine-Loader world APIs (blocks, sites, parties) rather than only local `mapStore`.

---

## Adding a game to the library

1. Add a `GameEntry` in `gameLibrary.ts` (unique `posterKey`, engines, launch, sources, deploy).  
2. Drop **unique** `public/rooms/<id>-scene.jpg` (or `.png`) 16:9 marketing art — **no shared mine poster for five maps**.  
3. Fill `playerInfo` + `deployNotes` (shown on library detail).  
4. Prefer `icon` from `public/icons/`.  
5. If native: wire `nativeMode` + App mode.  
6. If external: URL + fleet query params via `gameLaunchUrl()`.  
7. If world: `launch: "mine-loader"` + `engines: ["mine-loader"]`.  
8. Register domain CORS / vercel rewrites per grudge-fleet skill.  
9. Audit: `docs/OPEN_LIBRARY_AUDIT.md` · era rules: `docs/ERA_LIBRARY.md`.

### Warlords worlds — never Open standalone tiles

Set `warlordsInGameOnly: true` for content that lives **inside** the Warlords client only:

| Id | Role |
|----|------|
| `pirate-islands` | Chicken Gun pirate lobby = **opening map + tutorial map**. Not GRUDOX, not Explorer. |
| `water-island` / `grudox-island` | Home / lobby island destinations |

Launch: `gameLaunchUrl()` → `client.grudge-studio.com` (pirate lobby uses `/island-3d?mode=lobby&map=pirate-islands`). Tests: `gameLibrary.warlords.test.ts`.

### Fleet tools / development asset apps

| Tool | Open library id | Live URL |
|------|-----------------|----------|
| **Asset Rig Editor** | `asset-rig-editor` | https://asset-rig-editor.vercel.app/ |
| Studio Forge | `forge-editor` | https://forge.grudge-studio.com/ |
| Dressing Room | `dressing-room` | native Open editor |
| Worldbuilder | `voxel-editor` | native Open voxel |

**Asset Rig Editor** is registered as an **app + tool + dev asset pipeline** (tags: Tool, App, Dev, Assets, Rig). Launch = external / in-app embed (`asset-rig-editor.vercel.app` is on `EMBED_FRIENDLY_HOSTS`).

---

## Poster / icon generation checklist

- 16:9 hero, no logos/text (UI overlays title).  
- Mood matches category (combat red, worlds teal, RTS blue HUD).  
- Export PNG to `public/rooms/`.  
- Optional: upload to R2 `assets.grudge-studio.com/gameopen/rooms/` with `VITE_USE_R2=true`.  
- Icons: Kenney / CraftPix 64–128px, monochrome-friendly.

---

## Deep links

| URL | Surface |
|-----|---------|
| `/?door=library` | Game library (default) |
| `/?door=account` | Account hub |
| `/?door=doors` | Classic door grid |
| `/?door=danger` | Danger Room |
| `/?door=voxel` | Voxel editor |
| `mineloader.grudge-studio.com` | Mine-Loader Realms |

---

## Next migrations (recommended order)

1. Finish Mine-Loader Railway hostname → vercel rewrite → CF `mine.` live.  
2. Wire Voxel Editor export → Mine-Loader world push.  
3. Collapse duplicate vox HTML clients into library → Realms.  
4. Upload library posters to R2 for CDN.  
5. Treaty rooms → Railway chat channel (replace localStorage).  
6. Library “Install / Deploy” button for operators (Railway status badge).
