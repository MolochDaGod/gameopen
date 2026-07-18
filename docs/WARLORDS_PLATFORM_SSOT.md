# Warlords platform SSOT

**One uniform stack** for every Warlords-era playable surface:

Danger Room · dungeons · islands · zones · instances · voxel arenas · brawler · lobbies · realms shells

| Layer | Package | Responsibility |
|-------|---------|----------------|
| **Physics / colliders** | `@workspace/grudge-physics` | Rapier 0.19, KCC capsule, probes, aim rays, mesh-bvh, swept capsules |
| **Runtime** | `@workspace/grudge-runtime` | Grudge UUIDs, WorldLocation, declarative scripts, asset URLs, scene host |
| **Umbrella** | `@workspace/grudge-warlords` | Re-exports both (preferred single import) |
| **Anim clips** | `@workspace/animator` + Open clipCatalog | Locomotion / skills (no physics wasm) |
| **Combat timing** | `@workspace/epicfight` | Parry/block/defense windows |
| **Voxel schema** | `@workspace/voxel-canonical` | Blocks / seed worlds |
| **Bundled models** | `@workspace/assets` | Vite-resolved catalog (optional) |

Pinned deps: see `WARLORDS_STACK` in `@workspace/grudge-runtime` and [`WARLORDS_PHYSICS_SSOT.md`](./WARLORDS_PHYSICS_SSOT.md).

---

## 1. Dependencies (wired)

### Node / browser (Open app)

```
artifacts/animator/package.json
  three@^0.184
  @dimforge/rapier3d-compat@^0.19.3
  three-mesh-bvh@^0.8.3
  yuka@^0.7.8

vite.config.ts aliases
  @workspace/grudge-physics  → lib/grudge-physics/src
  @workspace/grudge-runtime  → lib/grudge-runtime/src
  @workspace/grudge-warlords → lib/grudge-warlords/src
  @workspace/epicfight | animator | assets | voxel-canonical | *-net
```

### Bootstrap every scene the same way

```ts
import {
  createScenePhysics,
  dangerRoomLocation,
  LocationBag,
  ScriptRunner,
  physicsDefaultsFor,
  resolveAssetUrlPreferLocal,
  WARLORDS_STACK,
} from "@workspace/grudge-warlords";

const kind = "danger-room";
const phys = physicsDefaultsFor(kind);
const { physics, playerKcc } = await createScenePhysics({
  kind,
  ground: phys.ground,
  player: { x: 0, y: 0, z: 0 },
  meshBvh: phys.meshBvh,
  gravityY: phys.gravityY,
});

const location = new LocationBag(dangerRoomLocation());
const scripts = new ScriptRunner();
// register handlers, load JSON scripts, setCollision(playerKcc)…
```

### Other repos (Builder, RTS, Mine-Loader clients)

1. Depend on / path-alias the Open `lib/grudge-*` packages (or publish later).  
2. Align `three` / `rapier` / `mesh-bvh` to `WARLORDS_STACK`.  
3. **No** Cannon/Ammo for new Warlords 3D combat hosts.  
4. Use `newGrudgeId` / `char_` / `encodeWirePlayerName` for multiplayer identity.

---

## 2. Shared assets (Node + browser)

| Source | Use |
|--------|-----|
| Open `public/anim`, `public/models` | Same-origin SSOT for Open deploy |
| `assets.grudge-studio.com` | CDN / D1 registry production packs |
| `@workspace/assets` | Vite-bundled curated models |
| Convert pipeline | `scripts/asset-pipeline` / grudge-convert → R2 |

```ts
import { resolveAssetUrlPreferLocal, animPath, modelPath, assetBaseFromEnv } from "@workspace/grudge-runtime";

// Browser Open: local first
const url = resolveAssetUrlPreferLocal(animPath("sword/slash-advance.fbx"));

// Node bake job: CDN
const cdn = assetBaseFromEnv(process.env);
const hero = resolveAssetUrl("models/grudge/wk_warrior.glb", { cdnBase: cdn });
```

---

## 3. Grudge UUID / identity (uniform)

| Kind | Prefix | Mint |
|------|--------|------|
| Character (DB) | `char_` | Postgres / D1 SSOT |
| Hero pack | `HERO-` | Fleet character API |
| Equipment | `EQIP-` | Item system |
| Item | `ITEM-` | Item system |
| Runtime entity | `ent_` | `newGrudgeId("entity")` |
| Instance | `inst_` | `newInstanceId()` |
| Zone | `zone_` | content / GRUDOX id |
| Portal | `portal_` | seed portals |
| Script | `scr_` | `newScriptId()` |

```ts
import {
  newUuid,
  newGrudgeId,
  newInstanceId,
  encodeWirePlayerName,
  decodeWirePlayerName,
  detectIdKind,
  isCharacterId,
} from "@workspace/grudge-runtime";
```

**Rule:** World **seeds** stay deterministic (hash labels). Entity **ids** are always runtime UUIDs — never seed-derived.

Multiplayer wire (Open already uses this shape):

```
displayName \u001f characterId \u001f fleetId
```

---

## 4. Location (uniform)

```ts
interface WorldLocation {
  kind: SceneKind;       // danger-room | dungeon | island | zone | …
  zoneId: string;        // GRUDOX / cabinet id
  instanceId: string;    // inst_<uuid>
  seed?: string;
  mapId?: string;
  position?: { x, y, z };
  yaw?: number;
  parent?: { kind, zoneId, instanceId, mapId? }; // dungeon under island
}
```

Helpers: `dangerRoomLocation()`, `dungeonLocation()`, `islandLocation()`, `zoneLocation()`, `formatLocation()`, `samePlace()`.

| Surface | kind | zoneId example |
|---------|------|----------------|
| Danger Room | `danger-room` | `danger` |
| Door dungeon | `dungeon` | parent zone or `dungeon` |
| GRUDOX Island | `island` | `lobby-island` |
| Realms | `realms` | `minegrudge` |
| Brawler | `brawler` | `brawler` |
| GRUDOX card | `zone` | cabinet id |

---

## 5. Scripting (uniform, no eval)

Scripts are **JSON documents** + host-registered handlers:

```ts
{
  "id": "scr_portal_crypt",
  "mode": "once",
  "trigger": { "kind": "portal", "targetId": "portal_crypt_1" },
  "actions": [
    { "kind": "load-instance", "location": { "kind": "dungeon", "mapId": "crypt-01" } }
  ]
}
```

| Trigger | Action (examples) |
|---------|-------------------|
| enter-radius | teleport, message, spawn-entity |
| portal / interact | load-instance, exit-instance |
| on-spawn / on-death | set-flag, play-vfx |
| quest-flag | grant-item, open-ui |

`ScriptRunner` dispatches only registered `ScriptActionKind`s — **never** `eval`.

---

## 6. Scene host pattern

Every game implements (or wraps) `WarlordsSceneHost`:

- `meta` — contract version + kind + title  
- `getLocation` / `setLocation`  
- optional `ScriptRunner`  
- physics via `createScenePhysics` + `CollisionProvider` on Controller  

Open Danger Room: `LocationBag` + `dangerRoomLocation` on Studio boot; dungeon enter nests `dungeonLocation({ parent })`.

---

## 7. Migration checklist (any game)

- [ ] Alias / depend `@workspace/grudge-warlords` (or physics + runtime)  
- [ ] Pin three 0.184, rapier 0.19, mesh-bvh ≥0.8  
- [ ] `createScenePhysics` + shared capsule  
- [ ] `WorldLocation` on enter/exit  
- [ ] IDs via `newGrudgeId` / fleet `char_`  
- [ ] Assets via `resolveAssetUrlPreferLocal` or CDN env  
- [ ] Content scripts as JSON + `ScriptRunner`  
- [ ] Remove Cannon / forked PhysicsWorld  

### Order

1. Open (Danger Room, Dungeon, Brawler) — in progress  
2. GrudgeBuilder Island / Lobby  
3. Mine-Loader client pose join payloads  
4. RTS / tactical shells (constants + aim only if not full KCC)  
5. Retire legacy cannon hosts for new work  

---

## 8. File map

| Path | Role |
|------|------|
| `lib/grudge-physics/` | Physics SSOT |
| `lib/grudge-runtime/` | IDs, location, scripts, assets, host |
| `lib/grudge-warlords/` | Umbrella export |
| `docs/WARLORDS_PHYSICS_SSOT.md` | Physics detail |
| `docs/WARLORDS_PLATFORM_SSOT.md` | This document |
| `content/runtime/` | Example script / location JSON (optional) |
