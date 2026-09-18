# Codex ↔ prefab / item / buildable wiring (Open)

Package: `@workspace/voxel-canonical` · `src/codexWiring.ts`

Mine-Loader owns the **250-block Codex**. ObjectStore owns **ITEM-\***, **MATL-\***, **BLDG-\***, and **118 buildable prefabs**. This package is the interchange so Open `/voxel`, VoxGrudge `/world`, and GRUDOX never invent a third id space.

```ts
import {
  fetchBlockCatalog,
  fetchCodexBridge,
  resolvePlaceType,
  resolveBuildingProp,
  buildableToSceneProp,
  isForbiddenVoxelWeaponType,
} from "@workspace/voxel-canonical";
```

| Want | Call |
|------|------|
| Cell type for brush / harvest drop | `resolvePlaceType(id, bridge)` |
| Station GLB for a BLDG-* | `resolveBuildingProp(name)` |
| Fortress / plaza prefab | `buildableToSceneProp(prefab, pos)` → `scene.props` |
| Codex RPG block | `fetchBlockCatalog()` then `cat:${slug}` |

Bridge JSON (ObjectStore): `/api/v1/voxel-codex-bridge.json`

Related: [VOXEL_CANONICAL.md](./VOXEL_CANONICAL.md) · [MINE_LOADER_SSOT.md](./MINE_LOADER_SSOT.md)
