# Warlords dungeon catalog — inventory + port design

**Date:** 2026-07-18  
**Scope:** Every dungeon-like surface currently in Open / fleet + uMMORPG map packs + recommended production design (assets, env, navmesh, AI, clear meter 0–100%, boss).

Related: [WARLORDS_PLATFORM_SSOT.md](./WARLORDS_PLATFORM_SSOT.md) · [WARLORDS_PHYSICS_SSOT.md](./WARLORDS_PHYSICS_SSOT.md) · [UMMORPG_ENGINE_PRACTICES.md](./UMMORPG_ENGINE_PRACTICES.md) · [SEED_WORLD_DEPLOY.md](./SEED_WORLD_DEPLOY.md)

---

## 1. What exists today (Open / fleet)

### 1.1 Danger Room door dungeons (GLB + Rapier + navmesh)

| Id | Name | GLB | Status | Notes |
|----|------|-----|--------|-------|
| `default` | **Forge Depths** | `models/minecraft-kit.glb` (~0.6 MB) | **Live** | Tight corridors; auto water column + **sealed boss pit**; surface wave + pit climax |
| `chicken-gun-town` | **Chicken Gun Town** | `models/chicken-gun-town.glb` (~4.0 MB) | **Live** | Open streets; ranged-friendly; same enemy system |

**Code:** `DungeonMaps.ts` · `dungeon/Dungeon.ts` (trimesh colliders + ray navmesh + depths) · `DungeonEnemies.ts` (AI)

**Not yet wired into picker (assets already in `public/models/`):**

| Asset | Size | Recommendation |
|-------|------|----------------|
| `models/dungeon.glb` | ~5.6 MB | Add as **`crypt-halls`** or replace Forge art when cleaned |
| `models/agama-map.glb` | ~15 MB | Island / temple exterior or **Temple of Agama** dungeon |
| `models/arena-war-zone.glb` | (present) | War arena instance, not full dungeon |
| `models/worlds/forest-map.glb` | ~25 MB | Overworld / glowing-forest theme exterior |
| `models/haunting-door.glb` | small | Portal prop, not a map |

### 1.2 Current dungeon combat design (single shared system)

| Layer | Implementation |
|-------|----------------|
| Colliders | Rapier static **trimesh** bake of every mesh (`Dungeon.collectMeshesAndColliders`) |
| Player | Kinematic **capsule KCC** (`CollisionProvider`) |
| Navmesh | XZ grid + downward ray for standable floors (`navmesh.ts`, cell 0.6 m) |
| Surface enemies | 3 melee · 2 ranged · 1 monster; **respawn** ~6–10 s; grudge6 hostile prefabs when load succeeds |
| Pit climax | 6× **elite-ironclad** grudge6 dwarves + map boss (**forge-moloch** on default); **no respawn** |
| Boss kit | **grudge6** race + cool armour + weapon tier + skill tree + player-like attrs — **not** karate-boss GLB (see `docs/DUNGEON_BOSSES_GRUDGE6.md`) |
| AI | A* on nav · aggro range · chase · windup · tree skills · stagger; AI tags `melee_pressure` / kite / caster / hybrid |
| Aggro | Profile `aggroRange` (bosses ~18–24 m); engage by range profile |
| Casting | Ranged bolts + boss skill-cycle (skillLabels / skillTreeNodes) with tier-scaled damage |
| Clear meter | **None** — pit is always populated; surface never “unlocks” boss |

Enemy profiles (`dungeonBossProfiles` + surface PROFILES):

| Kind | Name | HP | Range | Role |
|------|------|-----|-------|------|
| melee | grudge6 warrior/knight (or Skeleton capsule) | 60 | 1.9 m | Pack filler |
| ranged | grudge6 ranger (or Archer capsule) | 45 | 11 m | Keep-away cast |
| monster | Dwarf Ironclad (elite-ironclad) | 320 | 2.4 m | Elite T3 hammer |
| boss | Moloch the Warchief (forge-moloch) | 1600 | 3.2 m | Orc knight greataxe T5 |

### 1.3 Voxel “dungeon” templates (editor / Realms portals)

| Template id | Label | Theme mapping (seed portals) |
|-------------|-------|------------------------------|
| `arena1` | Arena 1 — walled pit, 2 foes | **ruins** |
| `arena2` | Arena 2 — pillars + platforms, 3 foes | **temple** |
| `arena3` | Arena 3 — multi-level + elite boss | **crypt** |
| `challenge1` | Challenge Course 1 | **mine** |
| `challenge2` | Challenge Course 2 | (parkour) |
| `boxingRing` | Boxing Ring | spar only |

Seed worlds (`content/worlds/seed-deployments.json`) generate portals with themes  
`ruins · crypt · mine · temple` → those templates (procedural / voxel, not GLB art).

### 1.4 Other fleet dungeon-adjacent surfaces

| Surface | Dungeon role |
|---------|----------------|
| GRUDOX / DCQ (`dcq.grudge-studio.com`) | Full voxel RPG dungeon product (separate) |
| Mine-Loader Realms | Portal → dungeon-spec / genDungeon authority |
| Danger Room sparring | Not a dungeon (open arena) |
| Brawler | Ruins brawl arena |
| uMMORPG code layer in Open | Skills/sockets/prefabs only — **no map port yet** |

---

## 2. uMMORPG source inventory

**Root:** `C:\Users\nugye\Documents\ummorpgdev`

| Path | Content |
|------|---------|
| `GenesisGrudge/Assets/Characters/Characters/!MAP Assets/` | **Intended** environment packs (folder structure present) |
| `assets/voxelhandoff/` | Zips + one FBX character; not dungeon maps |
| `assets/!MAP Assets/` | Empty shell (duplicate label) |

### 2.1 MAP packs found (structure names = design intent)

**Important:** On this machine the pack **directories exist but contain no FBX/prefab/scene files** (empty shells / not fully copied). Treat names as **source list to re-acquire from Unity packages / Asset Store / backup**, then convert via grudge-convert → R2.

| Pack folder | Intended env | Best Warlords use |
|-------------|--------------|-------------------|
| **Low Poly Castle Siege Pack** | Walls, towers, siege props | **Ruins / Castle Siege** dungeon + props |
| **Santuary** (Sanctuary) | Sacred / temple architecture | **Temple** dungeons |
| **SkythianCat / Glowing_Forest** | Lush glowing forest | Forest overworld ring + **Nature Ruin** dungeon exterior |
| **The Work Buildings** | Industrial / work structures | **Mine / Foundry** dungeon props |
| **Nature Pack** | Trees, rocks, ground | All outdoor transitions + mine approaches |
| **Scenes / Low_Poly_Survival** | Survival scene layout | Reference layout for open survival island, not a crypt |
| **KriptoFX / Realistic Effects** | VFX only | Combat FX, not collision mesh |
| **Particle Dissolve…** | Shaders | Skip for colliders |
| **_Assets** | Misc | Audit when populated |

### 2.2 uMMORPG already adopted in Open (non-map)

| Concept | Web module |
|---------|------------|
| Entity / Monster prefab | `three/ummorpg/prefabProfile.ts` |
| Aggro + combat style | `EntityPrefab.aggro`, `WEAPON_COMBAT` ranges |
| Skills / cast gates | `scriptableSkills.ts` + master-weaponSkills |
| Animation director | `animationDirector.ts` |
| Hostile kits | `listHostilePrefabs()` / warlordsRoles |

**Gap:** Prefabs exist; **dungeon enemy AI does not yet spawn grudge6 kits** — it still uses capsule “Skeleton / Archer / Brute” meshes. Port path = swap `makeEnemy` body for `EntityPrefab` + GrudgeAvatar.

---

## 3. Recommended production dungeon roster

Unify **four theme pillars** (seed portals) with **GLB + prop kits + clear rules**.  
Each entry: art source · env · clear meter · boss · AI.

### Shared systems (every dungeon)

```
DungeonDefinition (JSON)
  id, name, theme, mapGlb, propKits[]
  physics: trimesh + PLAYER_CAPSULE KCC (@workspace/grudge-physics)
  nav: grid 0.6 m OR baked nav mesh from convert pipeline
  clear: ClearMeterConfig
  waves: EnemyWave[]
  boss: BossConfig
  relics?: RelicObjective[]
  zones?: ZoneClear[]
```

**Clear meter 0–100%** (new — replace “always-on pit”):

| Source | Points | Cap contribution |
|--------|--------|------------------|
| Kill surface trash | +weight by kind | usually 50–70% |
| Kill elites | higher weight | |
| Collect relics | fixed % each | 10–30% |
| Clear marked zones | fixed % each | 0–25% |
| Optional: no-death bonus | small | |

At **100%** → open boss gate / drop to pit / spawn boss wave.  
Boss **does not** contribute to meter (or only after 100%).

**AI stack (uniform):**

| Behavior | Rule |
|----------|------|
| Aggro radius | prefab-driven (melee ~8–12 m, ranged ~18–24 m, caster ~16–22 m) |
| Drop aggro | > 1.5× radius or line-of-sight lost N s |
| Path | navmesh A* (existing) |
| Melee | close to `combat.range`, windup → hit window |
| Ranged / cast | hold preferred band, cast ScriptableSkill when `canCastSkill` |
| Elite / boss | phase HP thresholds + telegraphs |
| Prefab mesh | grudge6 race kit from `listHostilePrefabs()` |

---

### D1 — Forge Depths (default · **ship first polish**)

| Field | Design |
|-------|--------|
| **Id** | `forge-depths` (alias `default`) |
| **Map** | `minecraft-kit.glb` → later `dungeon.glb` if better art |
| **Env** | Industrial stone / forge corridors; water sink → sealed pit |
| **Props** | Work Buildings kit (when recovered) + destructible boxes from voxelhandoff |
| **Clear meter** | Kills only: 6 surface foes = 100% (monster = 30%, ranged = 15%, melee = 10% each, scaled) |
| **Boss unlock** | At 100%: pit seal opens / player may drop; **Moloch Da God** already in pit OR spawn only after meter |
| **Boss** | Moloch Da God (1600 HP) + 9 brutes **or** brutes = mid-elite wave before boss alone |
| **AI** | Surface respawn **off** after first clear of cell; pit no-respawn |
| **Relics** | Optional forge core (1 relic = 20% meter) |

---

### D2 — Chicken Gun Town (ranged test · **keep as training dungeon**)

| Field | Design |
|-------|--------|
| **Id** | `chicken-gun-town` |
| **Map** | `chicken-gun-town.glb` |
| **Env** | Streets + buildings; no water pit (disable `buildDepths` for this map) |
| **Clear meter** | Kills 70% + **zone clear** (3 street districts) 30% |
| **Boss** | “Sheriff” elite rifle/orc kit mid-town plaza at 100% |
| **AI** | Heavy ranged; snipers on roofs if nav allows |
| **Role** | Skill-shot / kiting lab, not story dungeon |

---

### D3 — Crypt Halls (theme: **crypt**)

| Field | Design |
|-------|--------|
| **Id** | `crypt-halls` |
| **Map** | Register **`dungeon.glb`** (already in public) after scale/collider audit |
| **Env** | Catacombs, low light, fog; undead kits |
| **uMMORPG art** | Sanctuary props (altars) + castle siege interior pieces |
| **Clear meter** | Kills 50% + **2 relics** (crypt urns) 25% each |
| **Boss** | Undead warlord / skeleton commander (use `skeleton-warrior.glb` or undead race kit) |
| **AI** | Melee packs + magic casters (staff/tome prefabs); reanimate once if meter < 100% |
| **Seed portal** | `theme: crypt` → prefer this GLB over voxel `arena3` when available |

---

### D4 — Temple of Agama (theme: **temple**)

| Field | Design |
|-------|--------|
| **Id** | `temple-agama` |
| **Map** | **`agama-map.glb`** |
| **Env** | Open ritual courts + inner sanctum |
| **uMMORPG art** | Sanctuary pack + Nature Pack approaches |
| **Clear meter** | **3 zone clears** (courtyard / halls / sanctum) 25% each + kills 25% |
| **Boss** | Temple guardian (heavy melee + shield) at sanctum when meter 100% |
| **AI** | Patrol loops; casters in sanctum; aggro on relic touch |
| **Seed portal** | `theme: temple` |

---

### D5 — Castle Ruins (theme: **ruins**)

| Field | Design |
|-------|--------|
| **Id** | `castle-ruins` |
| **Map** | Bake from **Low Poly Castle Siege Pack** (when assets recovered) + siege props |
| **Env** | Broken walls, towers, courtyard |
| **Clear meter** | Kills 60% + **hold tower zone** 40% (stand in capture volume 20 s) |
| **Boss** | Siege captain (greataxe elite) on throne platform |
| **AI** | Melee rush + archer towers (static ranged nodes) |
| **Seed portal** | `theme: ruins` |

---

### D6 — Drowned Mine / Foundry (theme: **mine**)

| Field | Design |
|-------|--------|
| **Id** | `drowned-mine` |
| **Map** | Work Buildings + Nature rock props; optional water band like Forge Depths |
| **Env** | Shafts, scaffolds, ore props; vertical drops |
| **Clear meter** | Kills 40% + **ore relics × 4** (15% each) |
| **Boss** | Forge Brute variant / “Cave Ogre” (`ogre.glb` / orc kit) after relics |
| **AI** | Narrow corridors; few casters; trap telegraphs later |
| **Seed portal** | `theme: mine` |

---

### D7 — Glowing Forest Ruin (theme: hybrid **ruins/nature** · optional)

| Field | Design |
|-------|--------|
| **Id** | `glowing-forest-ruin` |
| **Map** | `worlds/forest-map.glb` shell + SkythianCat Glowing_Forest when recovered |
| **Env** | Outdoor dungeon ring; bioluminescent VFX (KriptoFX carefully, performance) |
| **Clear meter** | Kills 70% + 1 shrine relic 30% |
| **Boss** | Forest spirit caster (staff/magic race kit) |
| **AI** | Wide aggro; kiting space |

---

## 4. Clear-meter / boss flow (product)

```
ENTER dungeon (WorldLocation kind=dungeon, inst_*)
  → spawn waves from DungeonDefinition
  → HUD: Clear 0–100%

ON kill / relic / zone event
  → meter += points (clamped)
  → if meter >= 100 and !bossUnlocked:
       bossUnlocked = true
       open gate / VFX / path to boss arena
       spawn boss (or unpause pit)

BOSS DEFEAT
  → rewards / exit portal / return to parent location
```

**Per-dungeon tuning table (defaults):**

| Dungeon | Kill share | Relic share | Zone share | Boss at |
|---------|------------|-------------|------------|---------|
| Forge Depths | 100% | 0% | 0% | 100% |
| Chicken Gun Town | 70% | 0% | 30% | 100% |
| Crypt Halls | 50% | 50% | 0% | 100% |
| Temple Agama | 25% | 0% | 75% | 100% |
| Castle Ruins | 60% | 0% | 40% (hold) | 100% |
| Drowned Mine | 40% | 60% | 0% | 100% |
| Glowing Forest | 70% | 30% | 0% | 100% |

---

## 5. Asset pipeline (port steps)

1. **Recover** full Unity packages into `ummorpgdev/.../!MAP Assets` (or ObjectStore raw/).  
2. **Export** per dungeon: environment FBX/GLB + collision mesh (or full mesh for trimesh bake).  
3. **`grudge-convert`** → production GLB (scale to human 1.8 m, WebP textures).  
4. Upload R2 / `public/models/dungeons/<id>.glb`.  
5. Register in `DungeonMaps.ts` + `content/dungeons/<id>.json` (clear meter, waves, boss).  
6. Props: separate small GLBs for relics/gates (interact + `ScriptRunner`).  
7. Enemies: prefer `EntityPrefab` hostile kits over capsules.

**Do not** ship raw Unity `.unity` / large unconverted packs to the browser.

---

## 6. Implementation priority

| P | Work |
|---|------|
| **P0** | `ClearMeter` module + HUD; Forge Depths unlocks pit boss at 100% kills |
| **P0** | Register `dungeon.glb` + `agama-map.glb` in `DungeonMaps` after collider smoke |
| **P1** | Per-map flag `hasPit` / `hasWater` (town = false) |
| **P1** | Spawn enemies from `listHostilePrefabs()` + aggro ranges from prefab |
| **P2** | Ranged AI → ScriptableSkill cast (not only bolts) |
| **P2** | Recover Castle / Sanctuary / Work Buildings packs → bake D5/D6 |
| **P3** | Seed portal themes point to GLB defs when present, else voxel templates |
| **P3** | Zone hold volumes + relic props via `ScriptRunner` |

---

## 7. Quick reference — “all dungeons” list

### Live today
1. Forge Depths (`default` / minecraft-kit)  
2. Chicken Gun Town  

### Assets ready, not in picker
3. Crypt candidate (`dungeon.glb`)  
4. Temple candidate (`agama-map.glb`)  
5. Forest shell (`worlds/forest-map.glb`)  

### Procedural / voxel (seed portals)
6–9. Ruins / Crypt / Mine / Temple → arena1 / arena3 / challenge1 / arena2  

### uMMORPG packs to port (when files recovered)
10. Castle Siege (ruins)  
11. Sanctuary (temple props)  
12. Work Buildings (mine/foundry)  
13. Glowing Forest (nature)  
14. Low_Poly_Survival (layout reference only)  

### External products
15. DCQ full game  
16. Mine-Loader genDungeon instances  

---

## 8. Decision summary

| Question | Answer |
|----------|--------|
| How many real GLB dungeons in Open? | **2 live** + **3 unregistered maps** |
| uMMORPG maps ready to copy? | **Structure only** — re-acquire package contents |
| Shared design? | **Theme pillars** ruins/crypt/mine/temple + Forge special |
| Boss timing? | **Clear meter 0–100%** then boss (not always-on pit forever) |
| AI? | Prefab aggro + nav A* + scriptable cast; boss phases later |
| Physics? | Existing dungeon trimesh + KCC (`@workspace/grudge-physics`) |

Next engineering step when you say go: **P0 ClearMeter on Forge Depths + register dungeon.glb / agama-map.glb**.
