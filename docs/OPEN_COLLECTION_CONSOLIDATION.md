# Open Collection — Consolidation & Deployment Best Practices

**Canonical hub:** https://open.grudge-studio.com  
**Owned sources:** `gameopen` (hub SPA) · `grudox` (Voxel Arcade + Carrier shell) · `Mine-Loader` (Realms worlds) · satellite games  
**Audience:** Agents and humans merging apps, games, editors, and world servers into one player-facing collection without breaking SSOT.

Related: [OPEN_STACK.md](./OPEN_STACK.md) · [OPEN_SYSTEMS.md](./OPEN_SYSTEMS.md) · [GAME_LIBRARY_AND_DEPLOY.md](./GAME_LIBRARY_AND_DEPLOY.md) · [MINE_LOADER_SSOT.md](./MINE_LOADER_SSOT.md) · [AGENT_WORK_CONTRACT.md](./AGENT_WORK_CONTRACT.md) · [FLEET_MINECRAFT_PATTERNS.md](./FLEET_MINECRAFT_PATTERNS.md)

---

## 0. Product thesis

**Open is the Steam-like collection shell** for Grudge Studio (see [OPEN_PRODUCT.md](./OPEN_PRODUCT.md)):

Library · in-app canvas · games · accounts · character saves · editors · Mine-Loader Realms · Warlord Genesis · GRUDOX arcade — **one origin** (`open.grudge-studio.com`).

| Open owns | Open does **not** own |
|-----------|------------------------|
| Library UI, Account, SSO handoff, saveData.open | Mine-Loader world authority (seed + blocks) |
| Danger Room / Dressing / native Brawl / in-app canvas policy | Full Voxel Velocity implementation (lives in GRUDOX build) |
| URL catalog + launch policy (T0 / T1 / T2) | GrudgeBuilder character Postgres schema |
| Same-origin edge mounts (`/arcade/*`, `/realms` collection surface) | Multi-replica world sim |

**GRUDOX is first-party** (`F:\GitHub\grudox` / `grudox.grudge-studio.com`):

- Builds **Voxel Arcade** (`/arcade/play/*`: racer = Velocity, zombie, z-brawl, …)
- Hosts **Carrier** shell and voxel pack pipelines (R2 / D1 seed scripts)
- Is **not** a third-party black box — we set headers, paths, and deploy

**Consolidation goal:** Players live on **one origin** (`open.grudge-studio.com`) for browse → play → account, while each heavy system keeps **one deploy artifact and one authority** (no forked servers).

---

## 1. Three integration tiers (pick one per title)

Never invent a fourth way per game.

| Tier | Name | When | How player reaches it | Deploy |
|------|------|------|----------------------|--------|
| **T0** | **Native Open mode** | Engine already in `gameopen` `App.tsx` | `navigate("danger"\|"brawl"\|"voxel"…)` same SPA | Vercel gameopen only |
| **T1** | **Same-origin edge mount** | Separate SPA we own (GRUDOX arcade, optionally Realms) | Path under open (`/arcade/*`, future `/realms/*`) via CF Worker proxy | Deploy **source** app to its Vercel project; **edge** routes path → that origin |
| **T2** | **In-app canvas / pop-out** | Cross-origin production SPA (DCQ, water island, genesis) that we may not frame | `InAppGameCanvas` with rewrite; **pop-out** if `X-Frame-Options` / CSP blocks | Own deploy + SSO query handoff |

### Decision tree

```
Does Open already run this engine in-process?
  YES → T0 native mode (slug in openRoutes + App branch)
  NO → Do we own the SPA and can we reverse-proxy it under open.*?
         YES → T1 edge mount (/prefix/* → project origin; strip frame-blockers if embedding)
         NO  → T2 embed if frame-friendly, else pop-out + deep link
```

### GRUDOX specifically (owned)

| Today | Target practice |
|-------|-----------------|
| `grudox.grudge-studio.com` still valid **origin of truth** for arcade build | Keep deploying arcade from **grudox** repo |
| Open CF Worker: `/arcade/*` → grudox host | **Keep** — player URL is `open.grudge-studio.com/arcade/play/<id>` |
| Strip `X-Frame-Options` on proxied arcade | **Keep** — enables in-app canvas under open origin |
| Absolute links to `grudox.grudge-studio.com` inside Open UI | **Prefer same-origin `/arcade/...`** so collection feels one site |

**Do not** reimplement Voxel Velocity inside Danger Room (see AGENT_WORK_CONTRACT).

---

## 2. Path ownership on `open.grudge-studio.com`

Single browser origin; **path prefix = product owner**.

| Path prefix | Upstream | Product |
|-------------|---------|---------|
| `/`, `/danger`, `/brawl`, `/voxel`, `/dressing`, `/zones`, `/account`, … | `gameopen.vercel.app` | Open hub + native engines |
| `/arcade/*` | `grudox.grudge-studio.com` | GRUDOX Voxel Arcade |
| `/api/auth/*`, `/login` | `id.grudge-studio.com` | Grudge ID |
| `/api/characters*`, `/api/account*`, `/api/wallet*` | Builder Railway | Characters / account (wallet may 404 until provisioned) |
| `/api/brawl`, `/api/carrier`, `/api/space` | GRUDOX room Railway | Live multiplayer rooms |
| `/api/blocks` (target) | Mine-Loader Railway | Codex / block catalog |
| `/anims/baked/*`, `/cdn/assets/characters/*` | Arena / R2 rewrites | grudge6 combat assets |
| Future `/realms/*` | Mine-Loader Vercel | Optional T1 mount of Realms SPA |

**Rule:** Add a new collection title → claim a **path prefix** or a **native mode**, document it in OPEN_SYSTEMS + this file, then wire edge or App.

Edge implementation: `infra/cloudflare/open` (`gameopen-open-proxy`).

---

## 3. Deployment matrix (apps / games / editors / servers)

### 3.1 Frontends (SPA)

| Product | Repo | Deploy | Open integration |
|---------|------|--------|------------------|
| **Open hub** | `gameopen` | Vercel → `gameopen.vercel.app` · edge `open.` | T0 self |
| **GRUDOX arcade** | `grudox` | Vercel → `grudox.grudge-studio.com` | T1 `/arcade/*` |
| **Mine-Loader Realms** | `Mine-Loader` | Vercel SPA + Railway API **1 replica** | T1 future `/realms/*` or T2 embed + SSO |
| **Warlord Genesis** | `warlord-genesis` | Own Vercel | T2 canvas / pop-out |
| **DCQ / water / RTS** | respective | Own Vercel/CF | T2 + library card |
| **Forge** | RTS-Grudge studio | forge.grudge-studio.com | Library link (editor external) |

**Practices:**

1. **One Vercel project per deployable SPA** — do not merge all builds into one mega-output unless true monorepo package (keeps CI independent).  
2. **Edge is the merger** — CF Worker unifies hostname; repos stay separate.  
3. **SPA catch-all** only on that app’s paths (gameopen catch-all must not steal `/arcade/*` — edge routes first).  
4. **Never Replit** for production Realms / Open / GRUDOX.  
5. **Smoke both hosts** after arcade change:  
   - `https://grudox.grudge-studio.com/arcade/play/racer`  
   - `https://open.grudge-studio.com/arcade/play/racer`

### 3.2 Multiplayer / world servers

| Server | Role | Deploy | Client connection practice |
|--------|------|--------|----------------------------|
| **Mine-Loader api-server** | WorldRoom, blocks, lobby | Railway, **replicas = 1**, Postgres | Same-origin `/api` on Realms SPA or open rewrite |
| **GRUDOX room** (`voxgrudge-grudox-room`) | Brawl / carrier / space WS | Railway | Open rewrites `/api/brawl|carrier|space` |
| **gameopen-production** | Open API helpers | Railway | `/api/*` fallback |
| **GrudgeBuilder** | Characters, island, Colyseus | Railway | `/api/characters` etc. |
| **Carrier co-located** | Easy PvP on game process | Same HTTP process | `wss://host/api/carrier` |

**Practices:**

1. **Authority never splits** — one replica for in-memory worlds.  
2. **Browser talks same-origin first** — Vercel/CF rewrite → Railway (cookies, no CORS pain).  
3. **JWT on every WS** — Grudge ID; bind `playerId` for persistence.  
4. **Room server ≠ hub SPA** — do not host world tick inside Vercel serverless.

### 3.3 Assets & definitions

| Kind | SSOT | Open access |
|------|------|-------------|
| Race / grudge6 GLB + baked anims | R2 + Arena | Vercel rewrites `/cdn`, `/anims/baked` |
| Icons / posters | Open `public/` + R2 | `assetUrl()` |
| Block Codex | Mine-Loader catalog + `/api/blocks` | Proxy + voxel-canonical |
| Weapon skill JSON | ObjectStore D1 | `/api/objectstore/*` |
| GRUDOX voxel packs | grudox scripts → R2 / D1 | Arcade runtime on grudox build |

**Practice:** Upload once to R2; every app resolves multi-host (`resolveAssetCandidates` / `VITE_ASSET_BASE_URL`). No Meshy / capsule as shipped heroes.

### 3.4 Auth

| Practice | Detail |
|----------|--------|
| **Primary** | Grudge ID (`id.grudge-studio.com`) |
| **Clerk** | Optional only (`VITE_CLERK_ENABLED=true` + healthy FAPI) — never dead `clerk.*.vercel.app` |
| **Handoff** | `grudge_token` / `sso_token` + `characterId` + `open=1` + `from=` |
| **No second character DB** on Realms or GRUDOX |

---

## 4. Collection UX (how it feels like one app)

### 4.1 Library card → launch

```
GameEntry / Zone card
  → T0: navigate(mode)
  → T1: location = /arcade/play/id  or  /realms/...
  → T2: InAppGameCanvas(url)  else pop-out
```

Code SSOT: `gameLibrary.ts`, `grudoxZones.ts`, `inAppLaunch.ts`, `InAppGameCanvas.tsx`.

### 4.2 Zones vs Library

| Surface | Role |
|---------|------|
| **Library** | Full catalog, deploy stack metadata, filters |
| **Zones** | GRUDOX-focused play grid (arcade + Realms + fleet worlds) |
| **Doors** | Classic mode picker for Open natives |

All three must call the **same** launch policy (no one-off `window.open` except pop-out).

### 4.3 Framing rules (owned apps)

| Host | Frame? |
|------|--------|
| `open.grudge-studio.com` paths (incl. proxied `/arcade`) | Yes — collection canvas |
| Bare `grudox.grudge-studio.com` | **No** (SAMEORIGIN) — always rewrite to open `/arcade` when launching from Open |
| Third-party / frame-hostile | Pop-out |

When we **own** upstream: prefer setting frame policy at **edge** (strip blockers on open proxy) rather than weakening security on the bare product domain for the whole internet.

---

## 5. Recommended consolidation phases

### Phase A — Collection shell (current + harden)

- [x] Open library + zones + native modes  
- [x] Edge `/arcade/*` → GRUDOX  
- [x] Same-origin arcade deep links from Open  
- [x] Clerk not required  
- [x] Path matrix table in OPEN_SYSTEMS + this file  
- [x] Library + Zones use `inAppLaunch` / `grudoxDeepLink` / native `realms`

### Phase B — Owned mounts under Open

- [x] `/realms` collection surface → Mine-Loader SPA in-app (SSO canvas)  
- [x] Zones minegrudge / mine-loader-live → navigate(`realms`)  
- [x] Library Mine-Loader → native `realms`  
- [x] CollectionHealth strip (blocks, arcade edge, characters, open API)  
- [x] Vercel rewrites `/api/blocks`, `/api/healthz`, `/api/worlds` → Mine-Loader  
- [ ] Optional CF path `/realms/*` asset mount (needs Mine-Loader `base: /realms/`)  
- [ ] Optional `/carrier/*` → GRUDOX carrier-site  
- [ ] Shared design tokens on T1 mounts

### Phase C — Deeper merge (optional, high cost)

- [ ] Monorepo packages for shared net protocols (already partial)  
- [ ] Shared build of arcade **as package** into gameopen only if CI/size allows  
- [ ] Single release train only for path-breaking API changes  

**Default stop at Phase B** — edge unification beats monorepo merge for independent ship cadence.

---

## 6. Adding something to the collection (checklist)

### New native Open game/editor (T0)

1. `AppMode` + `OPEN_SURFACES` row + `App.tsx` branch.  
2. Poster `public/rooms/<key>-scene.png`.  
3. Library `GameEntry` `launch: "native"`.  
4. Smoke: hard load `open.grudge-studio.com/<slug>`.

### New GRUDOX arcade cabinet (T1)

1. Implement cabinet in **grudox** repo arcade build.  
2. Register id in Open `GRUDOX_ZONES` / library (native:false).  
3. Launch URL = same-origin `/arcade/play/<id>?…SSO`.  
4. Smoke **both** grudox host and open host.  
5. Do **not** remap to Danger Room.

### New world / Mine-Loader feature (server)

1. Ship in Mine-Loader api-server + voxelcraft.  
2. Keep **1 replica**.  
3. Expose via Realms SPA; later mount `/realms` on open edge if desired.  
4. Open voxel editor exports via **voxel-canonical** interchange.

### New external fleet title (T2)

1. Library card + `gameLaunchUrl` SSO params.  
2. Try canvas; document if pop-out only.  
3. CORS / auth origins if it calls Builder API.

### New multiplayer room type

1. Protocol package + Railway service.  
2. Open `vercel.json` rewrite `/api/<name>`.  
3. Client derives `wss` from `window.location` when same-origin.

---

## 7. Anti-patterns (collection-breaking)

| Anti-pattern | Why it hurts |
|--------------|--------------|
| Remap racer → Danger Room | Destroys owned Velocity product |
| Iframe bare `grudox.*` from Open | X-Frame-Options SAMEORIGIN fails |
| Multi-replica world API | Split brain edits |
| Second character database | Identity drift |
| Clerk dead FAPI domain required | App boot fails |
| Mega-merge all SPAs into one Vercel build | Blocks independent deploy |
| Edge catch-all that sends `/arcade` to gameopen | 404 / wrong app |
| Replit production | Unstable authority |
| Inventing local fake assets | Breaks fleet SSOT |

---

## 8. Ownership one-liners (for agents)

- **Player collection URL** → Open.  
- **Arcade binary / Velocity** → GRUDOX repo deploy.  
- **World blocks truth** → Mine-Loader API.  
- **Hero rows** → GrudgeBuilder Postgres.  
- **Edge routing** → `gameopen-open-proxy` Worker.  
- **Launch policy** → `inAppLaunch` + `grudoxDeepLink` + library.  

---

## 9. Smoke script (post-deploy)

```text
GET  https://open.grudge-studio.com/                    → 200 Open hub
GET  https://open.grudge-studio.com/danger              → 200
GET  https://open.grudge-studio.com/arcade/play/racer   → 200 GRUDOX Velocity (via edge)
GET  https://grudox.grudge-studio.com/arcade/play/racer → 200 same game origin of truth
GET  https://open.grudge-studio.com/api/health          → 200 or documented upstream
GET  https://open.grudge-studio.com/api/characters      → 401 without token (not 5xx HTML)
```

Console on Open: no `clerk.*.vercel.app` load errors; Grudge ID path works.

---

## 10. Summary recommendation

| Principle | Practice |
|-----------|----------|
| **One player origin** | `open.grudge-studio.com` |
| **Many deployables** | Separate Vercel/Railway projects |
| **Merge at the edge** | CF Worker path mounts for owned SPAs |
| **Native when in-process** | Danger, Brawl, editors |
| **Never fork game identity** | Velocity stays GRUDOX arcade |
| **Worlds are servers** | Mine-Loader 1-replica authority |
| **Auth is fleet** | Grudge ID, optional Clerk only if healthy |
| **Catalog is data** | Library + Zones share launch helpers |

This is the best-practice model for consolidating **apps, games, editors, Mine-Loader servers, and GRUDOX** into Open as one collection while keeping shippable, owned SSOT repos.
