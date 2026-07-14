import {
  colorForBlockType,
  DEFAULT_BLOCK_TYPE,
  nearestTerrainType,
} from "./terrain";
import type {
  BlockEdit,
  OpenVoxelBlock,
  OpenVoxelDeployable,
  OpenVoxelMap,
  VoxelRealmsScene,
} from "./types";
import { OPEN_VOXEL_MAP_VERSION, VOXEL_REALMS_SCENE_VERSION } from "./types";

/** Empty Voxel Realms scene (mine-loader `Pl()`). */
export function emptyVoxelRealmsScene(): VoxelRealmsScene {
  return {
    version: VOXEL_REALMS_SCENE_VERSION,
    props: [],
    npcs: [],
    colliders: [],
    triggers: [],
    paths: [],
    blockEdits: [],
    spawn: null,
    map: null,
  };
}

/** Normalize unknown JSON into a Voxel Realms scene (mine-loader `xo()`). */
export function normalizeVoxelRealmsScene(raw: unknown): VoxelRealmsScene {
  const base = emptyVoxelRealmsScene();
  if (!raw || typeof raw !== "object") return base;
  const t = raw as Record<string, unknown>;
  return {
    version: typeof t.version === "number" ? t.version : VOXEL_REALMS_SCENE_VERSION,
    props: Array.isArray(t.props) ? (t.props as VoxelRealmsScene["props"]) : [],
    npcs: Array.isArray(t.npcs) ? (t.npcs as VoxelRealmsScene["npcs"]) : [],
    colliders: Array.isArray(t.colliders) ? (t.colliders as VoxelRealmsScene["colliders"]) : [],
    triggers: Array.isArray(t.triggers) ? (t.triggers as VoxelRealmsScene["triggers"]) : [],
    paths: Array.isArray(t.paths) ? (t.paths as VoxelRealmsScene["paths"]) : [],
    blockEdits: Array.isArray(t.blockEdits)
      ? (t.blockEdits as BlockEdit[]).map(normalizeBlockEdit).filter(Boolean) as BlockEdit[]
      : [],
    spawn: isVec3(t.spawn) ? { x: t.spawn.x, y: t.spawn.y, z: t.spawn.z } : null,
    map: t.map ?? null,
  };
}

function isVec3(v: unknown): v is { x: number; y: number; z: number } {
  return (
    !!v &&
    typeof v === "object" &&
    Number.isFinite((v as { x: number }).x) &&
    Number.isFinite((v as { y: number }).y) &&
    Number.isFinite((v as { z: number }).z)
  );
}

function normalizeBlockEdit(e: unknown): BlockEdit | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  if (![o.x, o.y, o.z].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const type =
    o.type === null
      ? null
      : typeof o.type === "string"
        ? o.type
        : typeof o.type === "number"
          ? String(o.type)
          : DEFAULT_BLOCK_TYPE;
  return {
    x: Math.trunc(o.x as number),
    y: Math.trunc(o.y as number),
    z: Math.trunc(o.z as number),
    type,
  };
}

export function isVoxelRealmsScene(v: unknown): v is VoxelRealmsScene {
  return !!v && typeof v === "object" && Array.isArray((v as VoxelRealmsScene).blockEdits);
}

export function isOpenVoxelMap(v: unknown): v is OpenVoxelMap {
  return !!v && typeof v === "object" && Array.isArray((v as OpenVoxelMap).blocks);
}

/**
 * Open editor map → Voxel Realms scene.
 * Shapes other than full blocks still export as solid cells (type only);
 * shape metadata is preserved only on the Open side.
 */
export function openMapToRealmsScene(map: OpenVoxelMap): VoxelRealmsScene {
  const scene = emptyVoxelRealmsScene();
  scene.blockEdits = (map.blocks ?? []).map((b) => ({
    x: b.x,
    y: b.y,
    z: b.z,
    type: b.type ?? nearestTerrainType(b.color ?? 0x888888),
  }));

  for (const d of map.deployables ?? []) {
    if (d.kind === "start") {
      scene.spawn = { x: d.x, y: d.y, z: d.z };
      continue;
    }
    if (d.kind === "npc") {
      scene.npcs.push({
        id: d.id,
        model: d.weapon ?? "default",
        x: d.x,
        y: d.y,
        z: d.z,
        rotation: d.rotation,
        difficulty: d.difficulty,
        weapon: d.weapon,
      });
      continue;
    }
    if (d.kind === "prop") {
      scene.props.push({
        id: d.id,
        kind: "prop",
        model: d.prop,
        x: d.x,
        y: d.y,
        z: d.z,
        rotation: d.rotation,
      });
      continue;
    }
    // bags / misc → colliders as a conservative shared representation
    scene.colliders.push({
      id: d.id,
      kind: d.kind,
      x: d.x,
      y: d.y,
      z: d.z,
      rotation: d.rotation,
    });
  }

  if (map.dungeon) {
    scene.map = { kind: "dungeon", source: "gameopen", openVersion: map.version };
  }
  return scene;
}

/**
 * Voxel Realms scene → Open editor map.
 * Catalog/terrain types become colored full blocks; spawn → start deployable.
 */
export function realmsSceneToOpenMap(scene: VoxelRealmsScene): OpenVoxelMap {
  const blocks: OpenVoxelBlock[] = [];
  for (const e of scene.blockEdits ?? []) {
    if (e.type == null) continue;
    blocks.push({
      x: e.x,
      y: e.y,
      z: e.z,
      shape: "block",
      rotation: 0,
      type: e.type,
      color: colorForBlockType(e.type),
    });
  }

  const deployables: OpenVoxelDeployable[] = [];
  if (scene.spawn) {
    deployables.push({
      id: "start_imported",
      kind: "start",
      x: scene.spawn.x,
      y: scene.spawn.y,
      z: scene.spawn.z,
      rotation: 0,
    });
  }
  for (const n of scene.npcs ?? []) {
    deployables.push({
      id: String(n.id ?? `npc_${deployables.length}`),
      kind: "npc",
      x: Math.trunc(Number(n.x) || 0),
      y: Math.trunc(Number(n.y) || 0),
      z: Math.trunc(Number(n.z) || 0),
      rotation: Math.trunc(Number(n.rotation) || 0),
      weapon: typeof n.weapon === "string" ? n.weapon : undefined,
      difficulty: typeof n.difficulty === "string" ? n.difficulty : undefined,
    });
  }
  for (const p of scene.props ?? []) {
    deployables.push({
      id: String(p.id ?? `prop_${deployables.length}`),
      kind: "prop",
      x: Math.trunc(Number(p.x) || 0),
      y: Math.trunc(Number(p.y) || 0),
      z: Math.trunc(Number(p.z) || 0),
      rotation: Math.trunc(Number(p.rotation) || 0),
      prop: typeof p.model === "string" ? p.model : undefined,
    });
  }

  const dungeon =
    !!scene.map &&
    typeof scene.map === "object" &&
    (scene.map as { kind?: string }).kind === "dungeon";

  return {
    version: OPEN_VOXEL_MAP_VERSION,
    dungeon,
    blocks,
    deployables,
  };
}

/** Ensure every block has a canonical `type` (migrate free-color maps). */
export function ensureBlockTypes(map: OpenVoxelMap): OpenVoxelMap {
  return {
    ...map,
    version: Math.max(map.version || 1, OPEN_VOXEL_MAP_VERSION),
    blocks: (map.blocks ?? []).map((b) => {
      const type = b.type ?? nearestTerrainType(b.color ?? 0x888888);
      return {
        ...b,
        type,
        color: b.color ?? colorForBlockType(type),
      };
    }),
  };
}

/**
 * Parse JSON that may be either format. Returns Open map for the editor.
 */
export function parseAnyVoxelDocument(json: string): OpenVoxelMap | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (isOpenVoxelMap(parsed)) return ensureBlockTypes(parsed);
    if (isVoxelRealmsScene(parsed)) return realmsSceneToOpenMap(normalizeVoxelRealmsScene(parsed));
    // Wrapped export { scene, open }
    if (parsed && typeof parsed === "object") {
      const o = parsed as Record<string, unknown>;
      if (isOpenVoxelMap(o.open)) return ensureBlockTypes(o.open as OpenVoxelMap);
      if (isVoxelRealmsScene(o.scene)) {
        return realmsSceneToOpenMap(normalizeVoxelRealmsScene(o.scene));
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Dual-format export for sharing across GRUDOX + editors. */
export function exportInterchange(map: OpenVoxelMap): string {
  const open = ensureBlockTypes(map);
  const scene = openMapToRealmsScene(open);
  return JSON.stringify(
    {
      format: "grudge.voxel.interchange",
      formatVersion: 1,
      open,
      scene,
    },
    null,
    2,
  );
}
