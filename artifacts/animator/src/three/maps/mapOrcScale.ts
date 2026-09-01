/**
 * Map SI scale SSOT for a **2.0 m orc** playable agent.
 *
 * Yardstick (grudge-world-scale + Warlords orc):
 *   - Orc height = 2.0 m (taller than human 1.8 m grudge6)
 *   - Door clear ≥ 2.45 m so an orc walks through without crouch
 *   - 1 storey ≈ 3.8 m; step ≈ 0.4 m
 *
 * Use on every outdoor Danger map before height samplers / colliders bake.
 * Do NOT fit maps to 1.8 m human when the product agent is orc-scale.
 */
import * as THREE from "three";

/** Playable orc agent for all Open outdoor maps. */
export const ORC_AGENT = {
  baseHeightM: 2.0,
  radiusM: 0.52,
  /** Min doorway clear height (m) for a 2 m orc + kit. */
  doorClearM: 2.45,
  stepHeightM: 0.4,
  maxSlopeDeg: 45,
  /** One storey building height relative to orc. */
  storeyHeightM: 3.8,
  /**
   * Miniature Sketchfab village (pirate) — fixed uniform when door auto-fit
   * is unavailable (~1.86 m pack × 4 ≈ orc-playable).
   */
  villageUniformScale: 4.0,
  datePalmScale: 0.01,
  /** Auto-fit clamps (avoid exploding tiny/huge author units). */
  minScale: 0.04,
  maxScale: 100,
  /** Door already SI for orc → keep scale 1. */
  doorOkMinM: 2.05,
  doorOkMaxM: 3.35,
} as const;

export type OrcAgent = typeof ORC_AGENT;

const DOOR_NAME_RE =
  /door|arch|portal|gate|entrance|doorway|frame|lintel|threshold|opening/i;
const STOREY_NAME_RE =
  /hut|house|building|tower|wall|cabin|shack|barn|store|shop|temple|ruin/i;

export type MapScaleReport = {
  scale: number;
  reason: string;
  measuredDoorM: number | null;
  measuredStoreyM: number | null;
  footprintLongestM: number;
  agentHeightM: number;
};

/**
 * Measure vertical size of door-like meshes (world units at current scale).
 */
export function measureDoorHeights(root: THREE.Object3D): number[] {
  root.updateMatrixWorld(true);
  const heights: number[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const name = `${m.name} ${m.parent?.name || ""}`;
    if (!DOOR_NAME_RE.test(name)) return;
    const b = new THREE.Box3().setFromObject(m);
    if (b.isEmpty()) return;
    const h = b.max.y - b.min.y;
    if (h > 0.15 && h < 40) heights.push(h);
  });
  return heights;
}

/**
 * Measure likely 1-storey building heights (for doorless maps).
 */
export function measureStoreyHeights(root: THREE.Object3D): number[] {
  root.updateMatrixWorld(true);
  const heights: number[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const name = `${m.name} ${m.parent?.name || ""}`;
    if (!STOREY_NAME_RE.test(name)) return;
    const b = new THREE.Box3().setFromObject(m);
    if (b.isEmpty()) return;
    const s = b.getSize(new THREE.Vector3());
    // Prefer wall-like uprights, not giant terrain slabs
    if (s.y > 0.8 && s.y < 25 && s.y > s.x * 0.15 && s.y > s.z * 0.15) {
      heights.push(s.y);
    }
  });
  return heights;
}

export function measureFootprintLongest(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root);
  if (b.isEmpty()) return 0;
  const s = b.getSize(new THREE.Vector3());
  return Math.max(s.x, s.z, 1e-4);
}

/**
 * Compute uniform scale so the map plays correctly next to a 2 m orc.
 * Prefer door-clear fit; else storey height; else footprint band.
 */
export function computeMapScaleForOrc(
  root: THREE.Object3D,
  opts?: {
    /** Force a known author scale (skips auto). */
    fixedScale?: number;
    /** Pirate village fixed scale when no doors. */
    preferVillageDefault?: boolean;
    agent?: OrcAgent;
  },
): MapScaleReport {
  const agent = opts?.agent ?? ORC_AGENT;
  const longest0 = measureFootprintLongest(root);

  if (opts?.fixedScale != null && opts.fixedScale > 0) {
    return {
      scale: clampScale(opts.fixedScale, agent),
      reason: "fixed",
      measuredDoorM: null,
      measuredStoreyM: null,
      footprintLongestM: longest0 * opts.fixedScale,
      agentHeightM: agent.baseHeightM,
    };
  }

  // Measure at current scale (usually 1)
  const doors = measureDoorHeights(root);
  const doorM = doors.length ? median(doors) : null;
  const storeys = measureStoreyHeights(root);
  const storeyM = storeys.length ? median(storeys) : null;

  // Already SI for orc doors
  if (doorM != null && doorM >= agent.doorOkMinM && doorM <= agent.doorOkMaxM) {
    return {
      scale: 1,
      reason: `door_si(${doorM.toFixed(2)}m)`,
      measuredDoorM: doorM,
      measuredStoreyM: storeyM,
      footprintLongestM: longest0,
      agentHeightM: agent.baseHeightM,
    };
  }

  // Door auto-fit: clear height for 2 m orc
  if (doorM != null && doorM > 0.05) {
    const s = clampScale(agent.doorClearM / doorM, agent);
    return {
      scale: s,
      reason: `door_fit ${doorM.toFixed(2)}→${agent.doorClearM}m`,
      measuredDoorM: doorM,
      measuredStoreyM: storeyM,
      footprintLongestM: longest0 * s,
      agentHeightM: agent.baseHeightM,
    };
  }

  // Storey height fit
  if (storeyM != null && storeyM > 0.2) {
    // Tiny author storey (<1 m) or huge → rescale
    if (storeyM < 1.2 || storeyM > 8) {
      const s = clampScale(agent.storeyHeightM / storeyM, agent);
      return {
        scale: s,
        reason: `storey_fit ${storeyM.toFixed(2)}→${agent.storeyHeightM}m`,
        measuredDoorM: doorM,
        measuredStoreyM: storeyM,
        footprintLongestM: longest0 * s,
        agentHeightM: agent.baseHeightM,
      };
    }
    return {
      scale: 1,
      reason: `storey_si(${storeyM.toFixed(2)}m)`,
      measuredDoorM: doorM,
      measuredStoreyM: storeyM,
      footprintLongestM: longest0,
      agentHeightM: agent.baseHeightM,
    };
  }

  // Pirate miniature default
  if (opts?.preferVillageDefault) {
    const s = agent.villageUniformScale;
    return {
      scale: s,
      reason: "village_default_x4",
      measuredDoorM: doorM,
      measuredStoreyM: storeyM,
      footprintLongestM: longest0 * s,
      agentHeightM: agent.baseHeightM,
    };
  }

  // Footprint band: playable island ~40–200 m for orc traversal
  if (longest0 < 12) {
    const s = clampScale(80 / longest0, agent);
    return {
      scale: s,
      reason: `footprint_up ${longest0.toFixed(1)}→80m`,
      measuredDoorM: doorM,
      measuredStoreyM: storeyM,
      footprintLongestM: longest0 * s,
      agentHeightM: agent.baseHeightM,
    };
  }
  if (longest0 > 400) {
    const s = clampScale(180 / longest0, agent);
    return {
      scale: s,
      reason: `footprint_down ${longest0.toFixed(1)}→180m`,
      measuredDoorM: doorM,
      measuredStoreyM: storeyM,
      footprintLongestM: longest0 * s,
      agentHeightM: agent.baseHeightM,
    };
  }

  return {
    scale: 1,
    reason: "si_default",
    measuredDoorM: doorM,
    measuredStoreyM: storeyM,
    footprintLongestM: longest0,
    agentHeightM: agent.baseHeightM,
  };
}

function clampScale(s: number, agent: OrcAgent): number {
  if (!Number.isFinite(s) || s <= 0) return 1;
  return Math.min(agent.maxScale, Math.max(agent.minScale, s));
}

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

/**
 * Apply uniform scale for orc playability, re-ground y=0, center XZ.
 * Call once on the map root before height samplers.
 */
export function applyMapScaleForOrc(
  root: THREE.Object3D,
  opts?: {
    fixedScale?: number;
    preferVillageDefault?: boolean;
    agent?: OrcAgent;
  },
): MapScaleReport {
  // Measure at identity first
  root.updateMatrixWorld(true);
  const report = computeMapScaleForOrc(root, opts);
  if (Math.abs(report.scale - 1) > 1e-4) {
    root.scale.multiplyScalar(report.scale);
    root.updateMatrixWorld(true);
  }

  // Ground + center XZ (SI feet)
  const box = new THREE.Box3().setFromObject(root);
  if (!box.isEmpty()) {
    const c = box.getCenter(new THREE.Vector3());
    root.position.x -= c.x;
    root.position.z -= c.z;
    root.position.y -= box.min.y;
    root.updateMatrixWorld(true);
  }

  root.userData.orcMapScale = report.scale;
  root.userData.orcMapScaleReason = report.reason;
  root.userData.orcAgentHeightM = report.agentHeightM;

  console.info(
    `[mapOrcScale] scale×${report.scale.toFixed(4)} reason=${report.reason} ` +
      `door=${report.measuredDoorM?.toFixed(2) ?? "—"} storey=${report.measuredStoreyM?.toFixed(2) ?? "—"} ` +
      `footprint≈${report.footprintLongestM.toFixed(1)}m agent=${report.agentHeightM}m`,
  );

  return report;
}

/** Nav / capsule agent for pathfinding (slight headroom over 2 m mesh). */
export const ORC_NAV_AGENT = {
  height: ORC_AGENT.baseHeightM + 0.1,
  radius: ORC_AGENT.radiusM,
  doorClear: ORC_AGENT.doorClearM,
  step: ORC_AGENT.stepHeightM,
  maxSlopeDeg: ORC_AGENT.maxSlopeDeg,
  zoneId: "danger-orc",
} as const;

/**
 * Door-clear fit helper (pirate recipe / explicit measured door).
 * Prefer {@link computeMapScaleForOrc} for full auto-fit.
 */
export function villageScaleForOrc(opts?: {
  measuredDoorHeightM?: number;
  doorClearM?: number;
}): number {
  if (opts?.measuredDoorHeightM && opts.measuredDoorHeightM > 0.05) {
    const clear = opts.doorClearM ?? ORC_AGENT.doorClearM;
    return clear / opts.measuredDoorHeightM;
  }
  return ORC_AGENT.villageUniformScale;
}
