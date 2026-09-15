# Grudge Open — product vision

**Canonical origin:** https://open.grudge-studio.com  
**Repo:** `gameopen` · Vercel `gameopen.vercel.app` · CF edge `open.`

Open is the **Steam-like collection shell and launcher** for Grudge Studio: one browser app where players sign in with **the same Grudge ID / Railway account as grudge-studio.com**, pick a character, browse Studio products (games, editors, AI/chat, production tools), and play era games **without leaving the shell** (native engines or in-app canvas).

**Not a second account.** `grudge-studio.com` is the portal / ENGINE index. **Open** is the signed-in launcher + account connector. Player SSOT is Railway (`grudge_id` + character UUIDs).

---

## What Open is

| Pillar | Player experience | Where it lives |
|--------|-------------------|----------------|
| **Library** | Steam-style shelves, search, recently played, store tab | `/` · `DoorSelect` + `GameLibrary` |
| **In-app canvas** | Full-bleed embed of fleet SPAs (SSO + character handoff); pop-out optional | `InAppGameCanvas` · `lib/inAppLaunch.ts` |
| **Games** | Combat, brawler, survival, arcade cabinets, satellite titles | Native `AppMode` or canvas |
| **Accounts** | Grudge ID SSO, profile, treaty | `/account` · `/login` · FleetBar |
| **Saves** | Per-character progress under Railway `saveData.open` | `characterLoadout.ts` · GameSession |
| **Characters** | **Campfire 4-avatar explorer hub** (Railway roster) · equip · enter play | `/characters` · `/lobby` · Account · Equipment |
| **Editors** | Dressing Room, Avatar, Voxel, LED Mask, Vox lab, **Grok Builder**, **Forge**, **ThreeFlow** | `/dressing` `/avatar` `/voxel` `/ledmask` `/world` · library Editors shelf |
| **Content** | Mesh packs · pipeline · maps (not a second CDN) | `docs/OPEN_MESH_PACKS.md` · pipeline.grudge-studio.com · assets CDN |
| **Modular dungeons** | Forge + crawl + **boss arena** | https://grudge-dungeons.vercel.app/ · `?linear=1` for boss path |
| **Mine-Loader worlds** | Realms lobby / play / build (1-replica world authority) | `/realms` · canvas → Mine-Loader SPA + Railway API |
| **Warlord Genesis** | Live MOBA/RTS warcamp with fleet hero | `/genesis` → in-app canvas → `warlord-genesis.vercel.app` |
| **Arcade (GRUDOX)** | Velocity, zombie, z-brawl under one origin | `/arcade/play/*` (edge → grudox) |

**Library chips** (`DELIVERY_SHELVES` in `gameLibrary.ts`): **Account · Games · Editors · Content**, then era (Voxel / Warlords / Nexus / Armada). Hub also shows a **Grudge Studio products** shelf (portal, Legion AI, wallet, Foundry, Forge, ThreeFlow, Coder, **Create UI**). Agents: `startUrlForIntent("account"|"studio"|"ai"|"wallet"|"coder"|"uiStudio"|"uiHotkeys"|"uiAssets"|"danger"|"grokBuilder"|"threeFlow"|"foundryCreate"|"mimic")`.

**UI.* (apply, not embed-only):** Open `/ui` loads `ui.grudge-studio.com` packs. **Apply pack to Open HUD** writes HYDRA comps onto `hudConfig` / `viewGrid` (Danger TightBar). Input Configurator `postMessage` `{ source: 'grudge-ui', type: 'hotkeys' }` fills F1 help. Asset roots: `lib/uiAssets.ts` = CraftPix CSS + `assets.grudge-studio.com` icons (same as `ui-assets-ssot.js`).

---

## Launch tiers (never invent a fourth)

| Tier | Meaning | Examples |
|------|---------|----------|
| **T0 Native** | Engine runs inside Open SPA | Danger Room, Brawl, Voxel editor, Dressing, Avatar |
| **T1 Edge mount** | Same-origin path proxies owned SPA | `/arcade/*` → GRUDOX |
| **T2 In-app canvas** | Iframe (or rewrite) of production fleet URL + SSO | Genesis, Realms SPA, DCQ, water island |

**Rule:** Prefer staying on `open.grudge-studio.com`. New browser tabs only for frame-blocked hosts or explicit **Pop out**.

---

## Identity & saves (SSOT)

```
Grudge ID (id.grudge-studio.com)
  → session JWT on open.grudge-studio.com
  → GameSession.boot()
  → Railway Postgres characters / account / wallet
  → saveData.open  (Open-only progress blob)
```

- **Characters:** Builder Postgres (same Grudge account DB) — **up to 4 campfire explorers** at `/characters` (`CampfireLobbyScene`). Never a parallel puter-only roster.  
- **Not home island:** Warlords **home island** is a separate product (`grudgewarlords.com/home-island`). Open does **not** host voxel “home island.”  
- **Camps:** Claim-flag camps are **account-owned**; camp storage can Send mats → account / home-island bag (see `CAMP_CLAIM_FLAG.md`).  
- **Worlds:** Mine-Loader Railway (seed + block edits) — Open does not own multiplayer world authority.  
- **Genesis:** Character + token query handoff; game state lives in Genesis deploy.

---

## Primary paths

| Path | Surface |
|------|---------|
| `/` | Steam-like library hub |
| `/login` | Grudge ID |
| `/account` | Account hub |
| `/characters` | Campfire roster / GRUDOX handoff |
| `/danger` | Combat sandbox |
| `/dressing` `/avatar` `/ledmask` | Character editors |
| `/voxel` `/world` | Map / voxel labs |
| `/realms` | Mine-Loader worlds (in collection) |
| `/genesis` | Warlord Genesis (in-app canvas) |
| `/brawl` `/survival` `/mimic` | Native play modes |
| `/arcade/play/<id>` | GRUDOX cabinets |
| `/zones` | Zone launcher + canvas |

Deep links: `?door=<mode>` · library cards · fleet posters under `public/rooms/`.

---

## Product thesis (one sentence)

**Open is the home for play, create, and account — a Steam-class launcher that keeps games, editors, Realms, and Genesis inside one origin with fleet characters and saves.**

Related: [OPEN_COLLECTION_CONSOLIDATION.md](./OPEN_COLLECTION_CONSOLIDATION.md) · [SEED_WORLD_DEPLOY.md](./SEED_WORLD_DEPLOY.md) · [OPEN_CONSOLIDATION.md](./OPEN_CONSOLIDATION.md) · [GAME_LIBRARY_AND_DEPLOY.md](./GAME_LIBRARY_AND_DEPLOY.md)

---

## Smoke checklist (Steam-like loop)

1. Open https://open.grudge-studio.com → **Library** loads (not a blank Danger Room).
2. **Sign in** → Grudge ID returns to Open with session.
3. **Account / Characters** → roster from Railway; select hero.
4. **Danger Room** → native combat (T0).
5. **Realms** → Mine-Loader lobby/play in collection (canvas or surface).
6. **Warlord Genesis** → in-app canvas warcamp with `characterId` + token (not a forced new tab).
7. **Dressing / Avatar / Voxel** → editors stay in shell.
8. Equip / progress → `saveData.open` persists on character PATCH.
