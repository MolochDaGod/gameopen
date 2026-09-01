# Production tools & wiring — Open + Grok Builder

**Owner surfaces:** Toolbox (Open) · Grok Builder · Forge · Foundry  
**Code SSOT:** `artifacts/animator/src/lib/productionTools.ts` · `artifacts/animator/src/lib/fleet.ts`  
**Builder SSOT:** `F:\GitHub\grok-builder\src\lib\fleet.ts` · `productionWiring.ts`

---

## 1. Hard rules (do not break)

| # | Rule |
|---|------|
| 1 | **Auth** = `id.grudge-studio.com` — never apex for `/api/auth` |
| 2 | **Player state** = Railway Postgres (`grudge-api`) — never D1 |
| 3 | **Catalogs** = `info.grudge-studio.com/api/v1` preferred (ObjectStore legacy fallback) |
| 4 | **Binaries** = `assets.grudge-studio.com` (R2) |
| 5 | **SI** metres; human ~1.8 m; no permanent Meshy/capsule heroes |
| 6 | **No dead** `api.grudge-studio.com` for new routes |

---

## 2. Open Toolbox (production tool surface)

Open the toolbox from the shell (any mode). Tabs:

| Tab | Purpose | Wiring |
|-----|---------|--------|
| **Tools** | 25 gold live launchers | Danger / Dressing / HUD / Voxel modes |
| **Three.js** | Systems · scripts · tools · helpers | Grok Builder `?stack=three` |
| **Rapier** | CCT · colliders · queries · debug | Grok Builder `?stack=rapier` |
| **R3F** | Canvas · hooks · drei · perf | Grok Builder / Forge |
| **Create** | Games · modes · edits | Grok Builder modes / agent |
| **Music** | CPT RAC + mixer | in-app |

Registry: `artifacts/animator/src/components/toolbox/tools.ts`  
URL helper: `grokBuilderUrl()` from `productionTools.ts`

### Create tab deep-links

| Label | Query |
|-------|-------|
| Grok Builder | `?panel=modes` |
| New Arena | `?mode=arena&panel=agent` |
| New Parkour | `?mode=parkour&panel=agent` |
| Pirate Lobby | Warlords client only — `/island-3d?mode=lobby&map=pirate-islands` (Chicken Gun opening + tutorial; not GRUDOX/Explorer) |
| Physics Lab | `?mode=physics-lab&physDebug=1` |
| Survival | `?mode=survival&panel=agent` |
| RTS Skirmish | `?mode=rts-skirmish&panel=agent` |
| Sandbox | `?mode=sandbox&panel=agent` |
| Export | `?panel=modes&focus=export` |
| Ask Grok | `?panel=agent` |

---

## 3. Fleet production map (tools)

| Surface | URL | Role |
|---------|-----|------|
| **Open** | https://open.grudge-studio.com | Launcher + Danger + Toolbox |
| **Grok Builder** | https://grok-builder.vercel.app | Agentic game/mode creator |
| **Forge** | https://forge.grudge-studio.com | Full R3F map/scene editor |
| **Foundry** | https://character.grudge-studio.com | Hero create to play handoff |
| **Client** | https://client.grudge-studio.com | Warlords play |
| **Arena** | https://grudge-arena.grudge-studio.com | PvP arena |
| **Warstrat** | https://warlord-genesis.vercel.app | MOBA / genesis |
| **RTS** | https://rts-grudge.vercel.app | RTS + `/character` |
| **WCS** | https://warlord-crafting-suite.vercel.app | Crafting suite |
| **Auth** | https://id.grudge-studio.com | SSO |
| **CDN** | https://assets.grudge-studio.com | R2 binaries |
| **Info** | https://info.grudge-studio.com/api/v1 | Catalogs |
| **AI** | https://ai.grudge-studio.com | Agent hub |
| **Postgres** | Railway `grudge-api-production-0d46` | Characters / bag / island |

---

## 4. Grok Builder production package

Export format: **`grudge-grok-builder-game@1`**

Includes:

- Scene entities + mode + win + scripts + helpers
- `fleet` block (open, forge, auth, CDN, definitions, gameData, ai, builder)
- `stack` required npm versions
- `handoff` links back to Open Danger / toolbox
- Hard rules array

Agent tools:

| Tool | Action |
|------|--------|
| `export_scene_json` | Production package download |
| `import_scene_json` | Restore package |
| `probe_fleet_wiring` | CDN / Open / info / AI / Forge / Railway |
| `get_production_wiring` | Full fleet + stack SSOT |
| `apply_game_mode` | Mode presets |
| `list_best_practices` | Three / Rapier / R3F |

---

## 5. Required 3D game package (checklist)

```
three ^0.185
@react-three/fiber ^9
@react-three/drei ^10
@react-three/rapier ^2
@dimforge/rapier3d-compat ^0.19
zustand ^5
```

Plus: Grudge ID SSO · Railway player state · R2 assets · SI scale.

---

## 6. Deploy

```bash
# Open
cd F:\GitHub\gameopen
npm run deploy:prod

# Grok Builder
cd F:\GitHub\grok-builder
npm run deploy:vercel
```

Smoke:

```bash
curl -sI https://open.grudge-studio.com/
curl -sI https://grok-builder.vercel.app/
curl -sI https://assets.grudge-studio.com/
```

---

## 7. Related docs

- [PRODUCTION_CONNECTIONS.md](./PRODUCTION_CONNECTIONS.md) — topology + secret names
- [PRODUCTION_DEPLOY.md](./PRODUCTION_DEPLOY.md) — deploy steps
- [FLEET_AUTH_WIRING.md](./FLEET_AUTH_WIRING.md) — SSO
- [CANONICAL_DATA_LAYER.md](./CANONICAL_DATA_LAYER.md) — D1 vs Postgres
- Grok Builder `README.md` — modes + agent tools
