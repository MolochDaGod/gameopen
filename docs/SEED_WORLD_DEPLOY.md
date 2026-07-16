# Seed worlds, portals & dungeon deployments

**Status:** Contract + Open production UI (2026-07)  
**Related:** [FLEET_MINECRAFT_PATTERNS.md](./FLEET_MINECRAFT_PATTERNS.md) · [MINE_LOADER_SSOT.md](./MINE_LOADER_SSOT.md) · [VOXEL_CANONICAL.md](./VOXEL_CANONICAL.md)

---

## Goal

Ship **Minecraft-like game maps**:

1. **Open world** regenerated from a **seed** (+ `chunkIdx`).  
2. **Dungeons are not free menu picks** in production play — they are reached by **finding portals** in that seed overworld.  
3. **Deployments** are shareable (Mine-Loader world share code or seed query handoff).

Same seed ⇒ same portal positions and same dungeon instance seeds.

---

## Player journey

```
Library / Production Maps / Lobby
  → Deploy or join seed world (seed + chunkIdx + deploymentId)
  → Explore overworld (Mine-Loader terrain from seed)
  → Discover portal beacon (diamond + exclamation / trigger radius)
  → Enter portal → dungeon instance (dungeonSeed = mix(worldSeed, portalId))
  → Exit dungeon → return near overworld portal
```

---

## Data contract (`grudge.seed-world.v1`)

**Package:** `@workspace/voxel-canonical` → `seedWorld.ts`  
**Catalog:** `content/worlds/seed-deployments.json` (mirrored under `public/content/worlds/`)

| Field | Role |
|-------|------|
| `world.seed` / `seedNumber` | Human seed label + 32-bit hash |
| `world.chunkIdx` | **0..7 only** → Mine-Loader `CHUNK_SIZES` `[16,32,64,96,128,256,512,1024]` (clamped via `clampChunkIdx`) |
| `world.biome` | UI / gen hint |
| `portals[]` | Discoverable overworld gates |
| `portals[].dungeon` | Destination dungeon id, seed, template/theme, return flag |
| `scene` (derived) | `triggers.kind = "portal"` + marker blockEdits |

### API connections (fleet)

| Call | Authority |
|------|-----------|
| Blocks / definitions / healthz / worlds | **Railway** `mine-loader-api-production.up.railway.app` |
| Open same-origin | `open.grudge-studio.com/api/{blocks,worlds,…}` → Railway (vercel.json) |
| Realms SPA | `mine.grudge-studio.com` (edge) or `mine-loader.vercel.app` |
| Launch query | `seed`, `chunkIdx`, `deploymentId`, `mode=seed-overworld`, `api=<Railway>` |

Never use Replit for API or SPA. Never send `chunkIdx` ≥ 8 (undefined world size).

### Portal trigger shape (scene)

```json
{
  "id": "portal_seed-grudge-plains_0_ruins",
  "kind": "portal",
  "x": 42, "y": 2, "z": -18,
  "radius": 1.5,
  "target": {
    "type": "dungeon",
    "dungeonId": "dungeon_…",
    "seed": 1234567890,
    "templateId": "arena1",
    "theme": "ruins",
    "difficulty": "easy",
    "returnToPortal": true,
    "returnPosition": { "x": 42, "y": 3, "z": -18 }
  }
}
```

### Determinism

| Input | Output |
|-------|--------|
| `hashSeed(label)` | `seedNumber` |
| `placePortalsFromSeed(seedNumber, plan)` | portal XYZ + names |
| `mixSeed(worldSeed, hashSeed(portalId))` | dungeon seed |

Never use `Date.now()` for production world seeds.

---

## Authority split

| Concern | Owner |
|---------|--------|
| Seed + chunkIdx + block edits | **Mine-Loader** WorldRoom / Postgres |
| Portal trigger enter / dungeon load | Mine-Loader client (consume trigger) |
| Catalog + deploy UI + export JSON | **Open** Production Maps tab |
| Combat lab arenas without seed | Open Danger / voxel templates (authoring) |

Open does **not** become a second world authority. Deployments export scene + seed for Realms.

---

## Open UI

**Production UI → Maps** (`P` in harvest/build):

- Catalog seed deployments  
- Custom seed string → generate portal ring  
- List portals with dungeon destinations  
- **Deploy / play seed world** (Mine-Loader URL + seed query)  
- **Share deploy code** (`POST /api/worlds`) when API up  
- **Export JSON** for promote / CI  
- Jump dungeon (dev only) for portal QA  

Launch query params (Mine-Loader SPA):

- Overworld: `mode=seed-overworld&seed=&deploymentId=&chunkIdx=`  
- Dungeon: `mode=dungeon&dungeonSeed=&dungeonId=&returnSeed=&returnPortal=&returnPos=`

---

## Promote checklist

1. Pick or invent seed in catalog / custom field.  
2. Export JSON or share code.  
3. Mine-Loader lobby: join shared world **or** open play with seed params.  
4. Smoke: same seed twice → same portal coordinates.  
5. Enter portal → dungeon loads; exit returns near portal.  
6. Persist block edits only as diffs (existing WorldRoom rule).

---

## Code index

| Piece | Path |
|-------|------|
| Types + portal gen | `lib/voxel-canonical/src/seedWorld.ts` |
| Catalog | `content/worlds/seed-deployments.json` |
| Open loader / launch | `artifacts/animator/src/game/seedWorlds.ts` |
| Maps UI | `HarvestProductionUI.tsx` (Maps tab) |
| Launch opts | `auth/mineLoaderConfig.ts` (`seed`, `deploymentId`, `worldMode`) |
| Mine-Loader snapshot | `lib/world-protocol` `WorldSnapshot.seed` |
| Dungeon grid SSOT | Mine-Loader `@workspace/dungeon-spec` |

---

## Anti-patterns

| Ban | Why |
|-----|-----|
| Menu-only dungeon list as primary production path | Breaks “find portals in the world” |
| Random portals per session | Breaks multiplayer parity |
| Storing full voxel arrays per seed | Use seed + blockEdits only |
| Dual authority Open + Realms for same room | Split brain |

---

*When Mine-Loader client gains first-class seed-overworld mode, consume this contract; keep generation pure so Open and Realms never drift.*
