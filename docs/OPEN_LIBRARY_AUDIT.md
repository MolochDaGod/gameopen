# Open library audit — individual games, posters, deploy

**Host:** https://open.grudge-studio.com  
**SSOT:** `artifacts/animator/src/game/gameLibrary.ts`  
**UI:** `artifacts/animator/src/components/GameLibrary.tsx`  
**Posters:** `artifacts/animator/public/rooms/{posterKey}-scene.png|jpg`  
**Audited:** 2026-08-09

---

## 1. Problems found (before tighten)

| Issue | Impact |
|-------|--------|
| **Shared posters** | Many maps reused `library-mine` — cards looked identical |
| **Shared danger art** | Vox battle + Arena used danger poster |
| **Shared lobby art** | Multiverse, Angel Island, Armada, Metaverse |
| **No GST tile** | Grudge Islands RTS live at /gst/ missing from library |
| **Thin deploy UI** | Detail panel showed stack only, not operator notes |
| **No per-game player blurb** | Launch unclear (SSO / cabinet / native) |

---

## 2. Tightening applied

### Unique posters (generated → `public/rooms/`)

| posterKey | Games |
|-----------|--------|
| `gst-islands` | Grudge Islands RTS (new) |
| `voxgrudge-battle` | VoxGrudge Battle |
| `forest-map` | Forest Map |
| `sailtest-map` | Sailtest |
| `island-life` | Survival Coast |
| `fabled-main-town` | Town stand-in |
| `bridge-town-docks` | Harbor stand-in |
| `dwarf-main-city` | Dwarf capital |
| `grudge-multiverse` | Multiverse |
| `angel-island` | Angel Island |
| `grim-armada` | Grim Armada |
| `nexus-carrier` | Carrier |
| `grudge-arena` | Grudge Arena |

Legacy era posters retained: `library-*`, `zones`, `worldbuilder`, `dressing`, etc.

### Schema extensions (`GameEntry`)

- `deployNotes?: string[]` — go-live / host rules  
- `playerInfo?: string` — how to play  
- `posterUrl()` prefers **jpg** for individual covers, **png** for legacy keys  

### New library title

- **`gst-islands`** → https://grudge-studio.com/gst/ · featured · Warlords era · deploy notes for go-live.mjs  

### UI

- Detail: **How to play** + **Deploy notes** + **Fleet deploy best practices** panel  

---

## 3. Production games checklist (visibility)

| Id | Status | Unique art | Deploy notes | Notes |
|----|--------|------------|--------------|-------|
| account-hub | live | library-account | yes | Platform |
| mine-loader-realms | live | library-mine | yes | World SSOT |
| danger-room | live | library-danger | yes | Native |
| **gst-islands** | live | **gst-islands** | yes | **NEW** |
| voxgrudge | live | library-voxworld | — | Full world |
| warlords | live | zones | — | Flagship client |
| warlord-genesis | live | library-genesis | — | Warstrat |
| hero-command | live | library-rts | yes | play.grudge |
| grudge-multiverse | live | **grudge-multiverse** | yes | |
| grim-armada | live | **grim-armada** | yes | |
| nexus-carrier | live | **nexus-carrier** | yes | WS only |
| grudge-arena | live | **grudge-arena** | yes | |
| grudox-games | live | zones | yes | Brand fence |
| pirate-islands etc. | live | lobby | — | **hidden** warlordsInGameOnly |

---

## 4. Game deployment best practices (Open)

1. **One production URL** per library id — never Desktop HTML forks as tiles.  
2. **Era first** — voxel | warlords | nexus | armada | account.  
3. **Unique poster** — `public/rooms/{id}-scene.jpg` 16:9, no text.  
4. **Live 200** before `status: "live"` / `featured: true`.  
5. **Fill** `deployNotes` + `playerInfo` on every new row.  
6. **SSO** — Grudge ID + Railway characters; handoff tokens documented.  
7. **Mine-Loader** — 1 Railway replica · Vercel SPA · CF edge · no Replit.  
8. **Brand fences** — GRUDOX cabinets → grudox.* · Warlords worlds → client only · Open Danger ≠ arcade.  
9. **Packages** — `docs/OPEN_PACKAGE_SSOT.md` before new three/rapier deps.  
10. **Smoke** — `npm run smoke:prod:open` after deploy.  

Full deploy map: `docs/GAME_LIBRARY_AND_DEPLOY.md` · `DEPLOY.md` · skill `grudge-live-servers`.

---

## 5. Adding the next game (agents)

```ts
// gameLibrary.ts
{
  id: "my-game",
  title: "…",
  short: "…",
  blurb: "…",
  category: "voxel", // era
  tags: […],
  tone: "#…",
  posterKey: "my-game", // rooms/my-game-scene.jpg
  engines: ["three"],
  launch: "external",
  url: "https://….vercel.app/",
  deploy: { client: "vercel", server: "railway" },
  deployNotes: ["…"],
  playerInfo: "…",
  sources: ["…"],
  status: "live",
  featured: false,
}
```

1. Generate/export 16:9 cover → `public/rooms/my-game-scene.jpg`  
2. Wire `GameEntry`  
3. CORS / CF domain if new host  
4. Smoke live URL + Open library card  

---

## 6. Still open (not this pass)

- Convert stand-in maps to full CDN meshes (island_life, fabled, bridge_town)  
- Upload library posters to R2 (`assets.grudge-studio.com/gameopen/rooms/`)  
- More unique art for grok-builder / pipeline / asset-rig (still dressing/voxel reuse)  
- Deploy Open SPA after this commit for live open.grudge-studio.com  

---

## 7. Deploy Open with these changes

```bash
cd C:\Users\nugye\Documents\gameopen\artifacts\animator
npm run build
# then vercel deploy dist/public --prod (project gameopen)
# smoke: https://open.grudge-studio.com/?door=library
```
