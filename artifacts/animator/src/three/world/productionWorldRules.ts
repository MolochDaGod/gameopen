/**
 * Production game-world rules — the only patterns we train AI and deploy against.
 *
 * HARD RULE: Do not invent sandbox-only worlds for "final" QA.
 * Test on deployed Open / CDN / sector surfaces with fleet assets.
 *
 * Layers:
 *  1. Shell mesh (terrain look) — R2 GLB, meshopt, no clutter
 *  2. Archetype kit (what can spawn) — trees/ore/animals/NPCs/bosses
 *  3. Seed (deterministic placement)
 *  4. Runtime systems (water, nav, AI, physics layers)
 *
 * Yardstick: HUMAN_HEIGHT_M = 1.8 (SI metres, Y-up, XZ ground).
 */

import { HUMAN_HEIGHT_M } from "../boss/volcanoBossCatalog";
import {
  HELLMAW_WORLD_NODES,
  validateWorldMeshNode,
  type WorldMeshNode,
  WORLD_PHYSICS_LAYERS,
} from "./worldMeshDeploy";

export { HUMAN_HEIGHT_M, WORLD_PHYSICS_LAYERS };

/** Live URLs we treat as production test surfaces. */
export const PRODUCTION_TEST_SURFACES = {
  open: "https://open.grudge-studio.com",
  openPlay: "https://open.grudge-studio.com/play",
  openDanger: "https://open.grudge-studio.com/danger",
  assetsCdn: "https://assets.grudge-studio.com",
  d1Assets: "https://api.grudge-studio.com/assets",
  gameData: "https://grudge-api-production-0d46.up.railway.app",
  warlords: "https://grudgewarlords.com",
} as const;

/** Island / sector archetypes that may host full production content. */
export const PRODUCTION_ARCHETYPES = [
  "home",
  "mountain",
  "volcanic",
  "tropical",
  "plains",
  "boss",
  "event",
  "hellmaw",
] as const;

export type ProductionArchetype = (typeof PRODUCTION_ARCHETYPES)[number];

// ── Terrain rules ──────────────────────────────────────────────────

/**
 * Terrain must be walkable SI geometry relative to 1.8 m humans.
 * Agents: never place props without ground + collider contract.
 */
export const TERRAIN_RULES = {
  /** 1 unit = 1 metre */
  metersPerUnit: 1,
  humanHeightM: HUMAN_HEIGHT_M,
  /** Slope: walkable if rise/run under this (approx) */
  maxWalkableSlopeDeg: 45,
  /** Step height characters can auto-step (Rapier KCC) */
  stepHeightM: 0.4,
  /** Snap build / placeables to this grid */
  buildGridM: 1,
  /** Physics layer for ground / rock / roads */
  layer: "Terrain" as const,
  /** Prefer heightfield for large islands; trimesh only for caves/overhangs */
  colliderPreference: ["heightfield", "trimesh", "box"] as const,
  /** Shell GLB target after bake */
  shellMaxMb: 6,
  notes: [
    "Shell = looks only; never bake NPCs/harvest into shell GLB",
    "Feet ground via skinned body min.y for characters; props via bottom AABB",
    "Navmesh bake over Terrain layer only",
  ],
} as const;

// ── Water rules ────────────────────────────────────────────────────

/**
 * Water is a playable system, not decoration-only.
 * Patterns from dungeon water + island water columns.
 */
export const WATER_RULES = {
  layer: "Water" as const,
  /** Surface kind for spatial queries / swim */
  surface: "Swim" as const,
  /** Min depth for fish / swim (m) */
  minDepthM: 0.6,
  /** Max safe wade without swim (m) relative to human */
  wadeDepthM: 0.9,
  /** Boats need water under keel — column must be water full height */
  requireFullWaterColumnForBoats: true,
  /** Fish / swim AI only sample valid water columns */
  aiOnlyValidWater: true,
  notes: [
    "isValidWaterColumn before spawnFish / boat path",
    "Sensor/trigger water OK for buoyancy zones",
    "Do not path human navmesh through deep water without swim surface",
  ],
} as const;

// ── AI placement patterns (trainable) ──────────────────────────────

/**
 * Patterns the AI must learn for a playable world — not random scatter.
 */
export const AI_WORLD_PATTERNS = {
  /** Density caps per 100 m² */
  density: {
    harvestNode: 0.8,
    ambientWildlife: 0.15,
    hostilePatrol: 0.08,
    elite: 0.02,
    worldBoss: 0.001,
  },
  /** Keep player approach lanes open */
  minCorridorWidthM: 2.5,
  /** Boss arena: clear radius around pin */
  bossArenaClearRadiusM: 14,
  /** Spawns face approach / player corridor when possible */
  faceApproachLane: true,
  /** Aggro rings must not stack on spawn */
  minSpawnSeparationM: 3.5,
  roles: {
    harvest: ["Terrain", "prop"],
    wildlife: ["NPC"],
    patrol: ["NPC"],
    world_boss: ["NPC"],
    ship: ["Default", "Water"],
  },
  notes: [
    "Place content via seed + kit, not unique one-off code per island",
    "World bosses only on volcanic/hellmaw/boss_event allow-gates",
    "Train AI on production URLs after CDN verify — never on missing mesh stubs",
  ],
} as const;

// ── Deployment gates (must pass before "production ready") ─────────

export type DeployGateId =
  | "cdn_mesh"
  | "physics_layer"
  | "collider"
  | "uuid_or_id"
  | "location"
  | "scale_vs_human"
  | "allow_gate"
  | "water_if_needed"
  | "nav_if_walkable";

export type DeployGateResult = {
  id: DeployGateId;
  ok: boolean;
  detail: string;
};

export function gateWorldNode(node: WorldMeshNode): DeployGateResult[] {
  const v = validateWorldMeshNode(node);
  const gates: DeployGateResult[] = [
    {
      id: "uuid_or_id",
      ok: !!node.id,
      detail: node.grudgeUuid ? `uuid ${node.grudgeUuid}` : `id ${node.id || "MISSING"}`,
    },
    {
      id: "cdn_mesh",
      ok: !!node.meshKey && !node.meshKey.includes("placeholder"),
      detail: node.meshKey || "no meshKey",
    },
    {
      id: "physics_layer",
      ok: (WORLD_PHYSICS_LAYERS as readonly string[]).includes(node.physicsLayer),
      detail: node.physicsLayer,
    },
    {
      id: "collider",
      ok:
        node.kind === "vfx" ||
        (!!node.collider?.kind && node.collider.kind !== "none"),
      detail: node.collider?.kind || "none",
    },
    {
      id: "location",
      ok: !!(node.location?.sectorId || node.location?.archetype || node.location?.pin),
      detail: JSON.stringify(node.location || {}),
    },
    {
      id: "scale_vs_human",
      ok:
        node.sizeHintM == null ||
        (node.sizeHintM > 0.05 && node.sizeHintM < 5000),
      detail:
        node.sizeHintM != null
          ? `${node.sizeHintM} m (${(node.sizeHintM / HUMAN_HEIGHT_M).toFixed(2)}× human)`
          : "author scale",
    },
  ];

  if (node.kind === "world_boss" || node.runtime?.bossId) {
    gates.push({
      id: "allow_gate",
      ok: !!(
        node.location.tags?.some((t) =>
          ["hellmaw", "volcanic", "boss_event", "world_boss"].includes(t),
        ) ||
        node.location.sectorId === "s" ||
        node.location.archetype?.includes("volcan") ||
        node.location.archetype === "boss"
      ),
      detail: "boss must sit on volcanic/hellmaw/boss_event",
    });
  }

  for (const w of v.warnings) {
    gates.push({ id: "cdn_mesh", ok: true, detail: `warn: ${w}` });
  }
  for (const m of v.missing) {
    gates.push({ id: "uuid_or_id", ok: false, detail: `missing ${m}` });
  }

  return gates;
}

export function productionWorldReport(nodes: WorldMeshNode[] = HELLMAW_WORLD_NODES) {
  const rows = nodes.map((n) => {
    const gates = gateWorldNode(n);
    return {
      id: n.id,
      kind: n.kind,
      pass: gates.every((g) => g.ok),
      fails: gates.filter((g) => !g.ok).map((g) => g.detail),
      humans:
        n.sizeHintM != null ? Number((n.sizeHintM / HUMAN_HEIGHT_M).toFixed(2)) : null,
      sector: n.location.sectorId,
      layer: n.physicsLayer,
    };
  });
  return {
    surface: PRODUCTION_TEST_SURFACES.open,
    humanHeightM: HUMAN_HEIGHT_M,
    terrain: TERRAIN_RULES,
    water: WATER_RULES,
    ai: AI_WORLD_PATTERNS,
    nodes: rows,
    allPass: rows.every((r) => r.pass),
  };
}

/**
 * HARD: reject "local-only" QA as production sign-off.
 * Local dev is allowed for implementation; production claim requires CDN + Open URL.
 */
export function isProductionTestContext(opts: {
  href?: string;
  cdnVerified?: boolean;
}): { ok: boolean; reason: string } {
  const href = opts.href || (typeof location !== "undefined" ? location.href : "");
  const prodHost =
    href.includes("open.grudge-studio.com") ||
    href.includes("gameopen.vercel.app") ||
    href.includes("grudgewarlords.com");
  if (!prodHost && !opts.cdnVerified) {
    return {
      ok: false,
      reason:
        "Not a production surface — deploy Open + verify CDN before claiming world QA pass",
    };
  }
  if (opts.cdnVerified === false) {
    return { ok: false, reason: "CDN verify failed — run verify-fleet-assets --cdn-only" };
  }
  return { ok: true, reason: "production context" };
}

/** Agent training prompt fragment — paste into AI worker system context. */
export const AI_WORLD_TRAINING_PROMPT = `
You build ONLY production Grudge game worlds (Open / CDN / sectors).

RULES:
1. 1 unit = 1 metre. Human yardstick = ${HUMAN_HEIGHT_M} m. Report sizes as metres and × human.
2. Never fit buildings/boats/islands/arrows to 1.8 m — only characters.
3. Shell GLB = terrain looks only. Content = seed + kit (NPCs, harvest, bosses).
4. Physics layers: Terrain | Water | Player | NPC | Item | Projectile | Trigger.
5. Every placeable needs: meshKey, layer, collider, location (sector/archetype/tags), id.
6. Water: valid columns only; boats/fish need water; deep water = Swim surface.
7. Terrain: heightfield preferred for large islands; navmesh on Terrain; step ≤ ${TERRAIN_RULES.stepHeightM} m.
8. World bosses (e.g. Shadow Flame Mantis) only on volcanic/hellmaw/boss_event allow-gates.
9. Test claims require open.grudge-studio.com (or vercel prod) + CDN verify — not localhost alone.
10. Assets from assets.grudge-studio.com / D1 registry — no Meshy/capsules as heroes.

PATTERNS:
- Approach corridors ≥ ${AI_WORLD_PATTERNS.minCorridorWidthM} m
- Boss arena clear ≥ ${AI_WORLD_PATTERNS.bossArenaClearRadiusM} m
- Density caps per 100 m² (harvest/wildlife/patrol/elite/boss)
- Deterministic seeds for replayable islands
`.trim();
