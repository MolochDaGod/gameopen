# water.grudge-studio.com — skills review (grudge6 · sail · assets · seeds)

**Reviewed:** 2026-07-22  
**Source:** `F:\GitHub\Tactical-Infinity` (live product = **water.grudge-studio.com only**)  
**Skills:** `grudge-warlords-assets` · `grudge6-modular-characters` · `grudge-production-world` · local `islands-and-terrain` · `character-animation`

### Live probes

| Check | Result |
|-------|--------|
| `water.grudge-studio.com/island` | 200 HTML |
| `water.grudge-studio.com/api/health` | 200 JSON |
| `water.grudge-studio.com/api/characters` | 401 (auth gate — expected) |
| CDN `WK_Characters.fbx` | 200 binary |
| CDN `WK_Standard_Units.webp` | 200 image/webp |
| CDN nature_vegetation + ore_nodes | 200 glTF |

---

## Scorecard

| Area | Status | Notes |
|------|--------|--------|
| **grudge6 race FBX + webp** | **Green** | All 6 races + atlases on CDN; CharacterBuilder + toonRTSAssets |
| **Bip001 / retarget / clips** | **Yellow** | Solid biped retarget; some Mixamo/legacy melee clips remain |
| **No Meshy / capsules (prod)** | **Red** | Captain path is grudge6, but Meshy still on boarding, world map, hooks, `/api/meshy` |
| **Fleet `/api/characters`** | **Green** | Vercel → Railway; `grudgeCharacterSync` marks grudge6 |
| **Open water + wind** | **Green** | Polar sail, weather wind, ship physics, world-map sailing |
| **Boat boarding character** | **Red** | Hardcoded Meshy orc FBX |
| **CDN nature + meshName** | **Green** | warlordsNatureCDN + loadIsolatedMesh |
| **Canonical island seeds** | **Green** | islandsCanonical pipeline (heightmap → scatter → harvest) |
| **Production home island seeds** | **Yellow** | ProductionIsland not fully on canonical builder; Math.random scatter |
| **Fleet shell seeds JSON** | **Red** | `island_fleet_seeds.json` present but unused |
| **Deploy rewrites** | **Green** | Auth, CDN, characters, island, objectstore aligned |

---

## 1. grudge6 characters

### Already excellent

- Race FBX SSOT: `client/src/lib/warlordsNatureCDN.ts` → `assets.grudge-studio.com/models/grudge6/races/*`
- Webp atlases: `GRUDGE6_TEX_REL` + R2 force in `CharacterBuilder` (`?v=20260710r2`)
- Production captain: `ProductionIsland.tsx` uses `CharacterBuilder` (not capsule forever)
- Clips: `grudgeClips.ts` locomotion/magic under `/animations/grudge6/`
- Fleet persist: `grudgeCharacterSync` + same-origin `/api/characters`
- Asset registry tags `grudge6` for WK + orc (extend to all 6)

### Gaps (skills violation)

| Severity | Issue | Where |
|----------|--------|--------|
| **P0** | Boarding captain is **Meshy** | `BoatBoardingSystem.ts` L25 `Meshy_AI_Orc_Warlord_…fbx` |
| **P0/P1** | Meshy product surface still live | `useMeshyModels.ts`, WorldMapScene Meshy ships/chars, CaptainCreation, `/api/meshy` rewrite |
| **P1** | Capsules in battle/intro paths | BattleGrounds, IslandBattlePage, intro fallbacks |
| **P1** | Incomplete per-race equipment | `toonRTSAssets` dwarf/others thin |
| **P2** | Hand attach not using `R_hand_container` | CharacterBuilder name heuristics |

**Skill target:** board/sail/world-map player = same CharacterBuilder + fleet race as island captain.

---

## 2. Open water sailing + wind (world map)

### Already excellent

- **Sailing is on the world map** (`App.tsx`: dedicated sailing page retired; `WorldMapPage` owns open water)
- **Wind:** `weatherSystem.ts` — `windDirection`, `windStrength`, weather presets, shader uniforms
- **Physics:** `shipPhysics.ts` — wave roll/pitch/heave + wind heel + keel + capsize
- **Sail polar:** `shared/gameDefinitions/sailing.ts` — polar speed vs wind angle; yard trim
- **Audio:** sail wind loops via `shipAudio.ts`
- **Boats:** `boatAssetLoader` / `boatRegistry` / captain build boat id
- **Sectors:** water engagement 9-sector ladder + world map data

### Gaps

| Severity | Issue |
|----------|--------|
| **P1** | Polar speed hardcodes `'sloop'` instead of player boat id |
| **P0** | Deck captain = Meshy (breaks grudge6 skill) |
| **P1** | World map still has Meshy ship/character toggles |
| **P2** | Dual ocean stacks: open water (`oceanShader` + weather) vs islands (`SeascapeOcean` + IslandSky) — wind look diverges |

---

## 3. Updated assets (CDN, isolation)

### Already excellent

- `warlordsNatureCDN.ts` — full nature / harvest / shells / events on R2
- Hard rule: never place whole multipack; `STYLIZED_VARIANTS` + isolate
- `islandAssetLoader` pack detection + `userData.meshName`
- `vercel.json`: `VITE_USE_ASSETS_CDN`, `/models` `/textures` rewrites, cache headers
- CDN probe: nature + ore + grudge6 binaries OK

### Gaps

| Severity | Issue |
|----------|--------|
| **P1** | ProductionIsland primitive/Dodecahedron fallbacks still reachable |
| **P1** | `/api/meshy` rewrite still in production vercel.json |
| **P2** | Some animals/mountains still local-only paths |

---

## 4. Canonical islands + node seed systems

### Already excellent — `client/src/lib/islandsCanonical/`

| Module | Role |
|--------|------|
| `IslandHeightmap` | Seeded heightfield |
| `LandScatter` | Deterministic mulberry32 scatter |
| `HarvestNodeSystem` | CDN ore meshes, HP, chip, respawn |
| `IslandSceneBuilder` | Full orchestrator + layers |
| `WaterNodes` / harbours / sea creatures | Water gameplay nodes |
| `metricSizing` | 1 unit = 1 m, human yardstick |

Local skill `islands-and-terrain` matches this pipeline.  
`pages/Islands.tsx` is the intended consumer of `buildIslandScene`.

### Split brain (P1)

**`ProductionIsland.tsx` (home island product path)** does **not** fully use `buildIslandScene`:

- Own terrain generator + zone scatter
- `Math.random()` for rotations / some mesh picks
- Primitive fallbacks on load failure
- Captain = CharacterBuilder ✓

**`public/models/islands/island_fleet_seeds.json`** — sector/shell seeds exist as data but **no TS consumer** found → not driving world map islands yet.

---

## Priority fix list (implementation order)

### P0 — grudge6 skill compliance

1. **BoatBoardingSystem** — replace `MODEL_PATH` Meshy with CharacterBuilder / fleet race FBX + grudge clips  
2. **Gate or remove** Meshy from default world-map player/ship and captain creation; keep admin-only if needed  
3. Drop or admin-flag `/api/meshy` rewrite in `vercel.json`

### P1 — sailing + seeds + assets

4. Polar: use real boat id, not hardcoded `'sloop'`  
5. ProductionIsland → `buildIslandScene` (or shared seed + LandScatter + HarvestNodeSystem)  
6. Wire `island_fleet_seeds.json` into world-map sector island spawn (or delete if obsolete)  
7. Battle/intro paths: no permanent capsules  

### P2 — polish

8. Full 6-race equipment maps + registry entries  
9. `BONE_CONTAINERS` hand attach  
10. Unify ocean/wind uniforms between open water and island pages  
11. CDN fauna keys for all animals  

---

## What’s already best-in-fleet

1. CDN + Vercel rewrites for water origin (`VITE_APP_ORIGIN=https://water.grudge-studio.com`)  
2. Nature pack isolation discipline  
3. Canonical island pipeline (seeded, layered, harvest nodes)  
4. CharacterBuilder + grudge6 spine on home island  
5. Deep open-water sailing (wind polar, weather, ship physics, world map)  
6. Fleet character API wiring  

---

## Bottom line

**water.grudge-studio.com is largely aligned** with warlords-assets + production deploy skills for **CDN, nature nodes, and open-water wind sailing**.  

**Blockers for “best skills” end-to-end:**

1. **Meshy still on boat boarding (and some map/create paths)** — violates grudge6 hard rule  
2. **Home island not fully on seeded canonical island/node pipeline**  
3. **Fleet island shell seed JSON not driving the world map**  

Fix P0 boarding → grudge6, then seed-unify ProductionIsland + wire fleet seeds, and the water SPA matches canonical skill standards across characters, sail, assets, and island nodes.

**Next step (implement):** say if you want P0 boarding + Meshy gates applied in `F:\GitHub\Tactical-Infinity` and deployed to water.
