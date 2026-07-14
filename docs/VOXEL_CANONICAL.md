# Voxel canonical format (fleet SSOT)

**Codex UI:** https://mine-loader.replit.app/#/defs  
**Catalog API:** https://mine-loader.replit.app/api/blocks  
**Shared package:** `@workspace/voxel-canonical` (`lib/voxel-canonical`)

This is the contract for **GRUDOX**, **gameopen Voxel Editor** (`/voxel`), **VoxGrudge** (`/world`), and any other voxel game on the fleet.

---

## 1. Why this exists

Open used free-form hex colors on blocks (`{ x,y,z,shape,color }`). Voxel Realms (mine-loader) stores **string block type ids** and a 250-entry RPG catalog. Without a shared contract, maps could not move between editors and zone games.

---

## 2. Block type ids

| Kind | Example | Storage |
|------|---------|---------|
| Terrain / place palette | `grass`, `stone`, `woodPlanks` | bare id |
| World-gen only | `deep`, `water`, `lava` | bare id |
| Codex / RPG catalog | slug `alloy-frame` | `cat:alloy-frame` |

Catalog prefix matches mine-loader mesher (`getTexKey`: `e.startsWith("cat:")`).

Terrain place palette (editor brush) mirrors mine-loader `dV`:

`grass` · `dirt` · `stone` · `sand` · `snow` · `log` · `woodPlanks` · `leaves` · `brickRed` · `brickGrey` · `brickDark` · `brickYellow` · `ice` · `diamond` · `coal` · `question` · `exclamation` · `blockSquare` · `blockBlank`

---

## 3. Voxel Realms scene (interchange)

Mine-loader empty scene (`Pl()`):

```json
{
  "version": 1,
  "props": [],
  "npcs": [],
  "colliders": [],
  "triggers": [],
  "paths": [],
  "blockEdits": [{ "x": 0, "y": 1, "z": 0, "type": "stone" }],
  "spawn": { "x": 0, "y": 2, "z": 0 },
  "map": null
}
```

- `blockEdits[].type` is a block type id, or `null` to clear.
- `map` holds arena/dungeon generator config (opaque passthrough).

---

## 4. Open editor map (gameopen)

```json
{
  "version": 2,
  "dungeon": false,
  "blocks": [
    {
      "x": 0, "y": 0, "z": 0,
      "shape": "block",
      "rotation": 0,
      "type": "stone",
      "color": 8947848
    }
  ],
  "deployables": []
}
```

- **v2** requires `type` on write; legacy free-color maps are migrated via nearest terrain match.
- `shape` is an Open-only authoring extension (slab/wall/ramp); Realms export is full cells.

---

## 5. Interchange export

`exportMap` / `exportInterchange` write:

```json
{
  "format": "grudge.voxel.interchange",
  "formatVersion": 1,
  "open": { "...OpenVoxelMap" },
  "scene": { "...VoxelRealmsScene" }
}
```

Importers should accept: Open map · Realms scene · interchange wrapper.

---

## 6. Catalog API

`GET /api/blocks` → `{ blocks, total, categories, roles, rarities }`

Each block includes: `slug`, `stats`, `resources`, `rpg`, `mission`, `editor`, `multiplayer`, `ui.tint`, `customCode`, `tags`.

Fleet routing:

| Surface | `/api/blocks` |
|---------|----------------|
| Vercel (open.grudge-studio.com) | rewrite → mine-loader |
| Railway api-server | proxy route with 5m cache |
| Client fetch | same-origin first, then mine-loader |

Package helper: `fetchBlockCatalog()` from `@workspace/voxel-canonical`.

---

## 7. Consumer checklist

| App | Must |
|-----|------|
| Voxel Editor | Place by `type`; export interchange |
| VoxGrudge / zone server | Apply `blockEdits` with type ids |
| GRUDOX cabinets | Load catalog for UI / loot if needed |
| New voxel game | Depend on `@workspace/voxel-canonical`; do not invent a third format |

---

## 8. Package API (quick)

```ts
import {
  PLACEABLE_TERRAIN,
  colorForBlockType,
  fetchBlockCatalog,
  openMapToRealmsScene,
  realmsSceneToOpenMap,
  parseAnyVoxelDocument,
  exportInterchange,
  ensureBlockTypes,
} from "@workspace/voxel-canonical";
```
