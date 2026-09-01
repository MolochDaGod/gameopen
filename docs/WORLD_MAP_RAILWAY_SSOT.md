# Aethermoor world map · Railway · frontend play (SSOT)

**Goal:** One world map drives sailing, island landing, faction war, trade, and timed event islands — **Railway** holds authoritative player + world session state; **frontend** (Warlords / grudge-world / Open handoff) renders and plays.

**Do not invent a second map brand.** “Aethermoor” is the **in-Warlords** overworld name. Open remains the library launcher. Product brands stay separate.

---

## Concept → fleet mapping (from tactical map sketch)

| Sketch | Meaning | Fleet SSOT |
|--------|---------|------------|
| Yellow / blue / red dots | Crusade · Fabled · Legion islands | `WORLD_ISLANDS` faction + `FACTION_TERRITORIES` |
| Green main island | Permanent hub warfare + trade + GBUX | `waterfall_isle` · `MAIN_ISLAND_ID` · no sink |
| Black lines / stable clusters | Fixed settlements per zone | Permanent islands (`size` capital/medium + ports) |
| “4” event islands | Timed spawns per faction zone | `EVENT_ISLAND_SLOTS` · `previewEventRuntime` |
| Island sinks to ocean | Leave or die when timer ends | `EventIslandRuntime.lethalOnSink` · Railway later |
| Chat alerts | Server announces which zone event is live | `eventAlertMessage` → room chat / Discord webhook |
| Trade cluster | Market / caravan | `gameplayType: trading_post` · `trade_caravan` events |
| Private islands | Player claimable | `isClaimable` · Railway island claim |
| Corner floaters | Content conveyor from void/lava edges | Event slots + Hellmaw south (`sector s`) |
| 9 grid cells | Streamed sailing sectors | `SECTOR_META` 3×3 · `SECTOR_GRID` |

---

## Topology (who owns what)

```
[Browser frontend]
  grudge-world  /  warlord-genesis  /  client.grudge-studio.com
       │
       │  map UX · sail · land · combat client
       ▼
[Railway Postgres + grudge-api]     ← player SSOT (characters, bag, wallet, island claim)
       │
       │  future: world_events, sector presence, event timers
       ▼
[Open open.grudge-studio.com]       ← library / Danger / entry catch (not sector tiles)
[assets.grudge-studio.com]          ← island shells, ships, grudge6
[id.grudge-studio.com]              ← login only
```

| Concern | Host |
|---------|------|
| Login | id.grudge-studio.com |
| Characters / bag / wallet / home island claim | **Railway** |
| Sector sail + island combat UI | Warlords / grudge-world frontend |
| Asset binaries | assets.grudge-studio.com |
| Open library tiles | open.grudge-studio.com (never list 9 sectors as standalone games) |

---

## Code SSOT

| Module | Path |
|--------|------|
| Islands + factions | `lib/world-content/src/aethermoor.ts` |
| 9 sectors | `lib/world-content/src/sectors.ts` |
| Event conveyor | `lib/world-content/src/eventConveyor.ts` |
| Flare → sector content | `lib/world-content/src/flarePort/*` |
| Map hub UI | `artifacts/grudge-world/src/pages/WorldHub.tsx` |
| Sail 3D | `artifacts/grudge-world/src/components/WorldMapScene.tsx` |
| Open labels only | `gameopen/.../warlordsSectors.ts` |

---

## Railway game systems (target, not all live yet)

1. **Player** — existing characters / equipment / wallet.  
2. **Presence** — which sector `(sx,sz)` and island id the character is in.  
3. **world_events** (planned) — row per active conveyor: `slot_id`, `phase`, `phase_ends_at`, `seed`.  
4. **Claims** — private island ownership → `isClaimed` / bag storage (open-camp inventory skill).  
5. **Economy** — GBUX / trade on main + trading_post (wallet SSOT).  
6. **Rooms** — multiplayer sector / main-island PvP via existing room stack when needed.

Client may use `previewEventRuntime(Date.now(), worldSeed)` until Railway owns timers.

---

## Frontend play loop

1. **World map** — pick sector / see event islands.  
2. **Set sail** — `/sail` stream sector water.  
3. **Dock / land** — `/island/:id` on-foot / combat.  
4. **Event** — board rising island; leave before sink.  
5. **Main island** — permanent PvP / RTS / trade hub.  
6. **Return** — home capital via faction capital island.

Auth: Grudge ID → Railway character → same hero across maps (map load rebinds terrain only).

---

## Agent rules

- Extend **world-content** — do not fork `WORLD_ISLANDS2`.  
- Sectors stay **in-Warlords**, not Open Danger tiles.  
- SI: 1 unit = 1 m; use production-world rules for island shells.  
- grudge6 heroes: modular + correctness stack.  
- Event sink is **game rules**, not a second physics engine.

---

## Verify

```bash
cd C:\Users\nugye\Documents\warlord-genesis
pnpm --filter @workspace/world-content run typecheck
pnpm --filter @workspace/grudge-world run typecheck
# Live hubs
curl -sI https://warlord-genesis.vercel.app | head -1
curl -sI https://client.grudge-studio.com | head -1
curl -sI https://open.grudge-studio.com | head -1
```
