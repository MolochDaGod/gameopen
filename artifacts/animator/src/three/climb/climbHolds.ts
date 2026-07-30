/**
 * Climb hold graph + IK limb rules for Danger Room climbing walls.
 *
 * Holds are extracted from spaced "shard" / peg meshes on climbingwall.glb.
 * The visual climb mesh is invisible; holds drive hand/foot IK and AI pathing.
 *
 * Rules (skill build):
 *  - Hands stay above feet (strict Y + margin).
 *  - Hands can "drag" feet up toward the current hand holds.
 *  - After a hand move, each foot picks the next realistic hold under/near hands.
 *  - Reach limits and wall normal keep poses grounded on the face.
 */

export type LimbId = "leftHand" | "rightHand" | "leftFoot" | "rightFoot";

export type ClimbHold = {
  id: string;
  /** World position (m). */
  x: number;
  y: number;
  z: number;
  /** Wall outward normal (points into room). */
  nx: number;
  ny: number;
  nz: number;
  /** Source mesh name for debug. */
  source: string;
  /** Wall face tag: opposite | left | right */
  wall: "opposite" | "left" | "right";
};

export type ClimbLimbState = {
  leftHand: string | null;
  rightHand: string | null;
  leftFoot: string | null;
  rightFoot: string | null;
};

export type ClimbIkConfig = {
  /** Max hand reach between consecutive holds (m). */
  handReach: number;
  /** Max foot reach between holds (m). */
  footReach: number;
  /** Hands must stay this many metres above feet (Y). */
  handAboveFootMargin: number;
  /** Prefer next hand hold this much higher than current (m). */
  handStepUp: number;
  /** Max hand step up (m). */
  handStepUpMax: number;
  /** When dragging feet, max Y below lower hand (m). */
  footUnderHand: number;
  /** Lateral separation preference for L/R limbs (m). */
  sideSeparation: number;
};

export const DEFAULT_CLIMB_IK: ClimbIkConfig = {
  handReach: 1.05,
  footReach: 0.95,
  handAboveFootMargin: 0.35,
  handStepUp: 0.28,
  handStepUpMax: 0.85,
  footUnderHand: 1.35,
  sideSeparation: 0.28,
};

function dist(a: ClimbHold, b: ClimbHold): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

function holdById(holds: ClimbHold[], id: string | null): ClimbHold | null {
  if (!id) return null;
  return holds.find((h) => h.id === id) ?? null;
}

/**
 * Build undirected graph: edge if distance ≤ maxReach (use max of hand/foot).
 * Used by AI pathfinding (peg → peg).
 */
export function buildHoldGraph(
  holds: ClimbHold[],
  maxReach = Math.max(DEFAULT_CLIMB_IK.handReach, DEFAULT_CLIMB_IK.footReach),
): Map<string, string[]> {
  const g = new Map<string, string[]>();
  for (const h of holds) g.set(h.id, []);
  for (let i = 0; i < holds.length; i++) {
    for (let j = i + 1; j < holds.length; j++) {
      const a = holds[i];
      const b = holds[j];
      if (a.wall !== b.wall) continue;
      if (dist(a, b) <= maxReach) {
        g.get(a.id)!.push(b.id);
        g.get(b.id)!.push(a.id);
      }
    }
  }
  return g;
}

/** BFS shortest path on hold graph (ids). */
export function pathHolds(
  graph: Map<string, string[]>,
  fromId: string,
  toId: string,
): string[] | null {
  if (fromId === toId) return [fromId];
  const q: string[] = [fromId];
  const prev = new Map<string, string | null>([[fromId, null]]);
  while (q.length) {
    const cur = q.shift()!;
    for (const n of graph.get(cur) ?? []) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (n === toId) {
        const path = [toId];
        let p: string | null = toId;
        while (p && p !== fromId) {
          p = prev.get(p) ?? null;
          if (p) path.push(p);
        }
        path.reverse();
        return path;
      }
      q.push(n);
    }
  }
  return null;
}

/**
 * Pick next hand hold for climb-up locomotion.
 * Prefers holds above current hand, within reach, on same wall, with lateral bias.
 */
export function pickNextHandHold(
  holds: ClimbHold[],
  current: ClimbHold | null,
  limb: "leftHand" | "rightHand",
  bodyY: number,
  cfg: ClimbIkConfig = DEFAULT_CLIMB_IK,
): ClimbHold | null {
  const sideSign = limb === "leftHand" ? -1 : 1;
  const baseY = current?.y ?? bodyY + 1.2;
  const baseX = current?.x ?? 0;
  const wall = current?.wall;
  let best: ClimbHold | null = null;
  let bestScore = -Infinity;
  for (const h of holds) {
    if (wall && h.wall !== wall) continue;
    if (current && h.id === current.id) continue;
    const up = h.y - baseY;
    if (up < -0.15 || up > cfg.handStepUpMax) continue;
    if (current && dist(h, current) > cfg.handReach) continue;
    // Lateral: left hand prefers -X relative, right +X (wall-local approx world X on opposite)
    const side = (h.x - baseX) * sideSign;
    const score =
      up * 2.2 +
      (side > 0 ? side * 0.8 : side * 0.2) -
      Math.abs(h.x - baseX) * 0.15 -
      (current ? dist(h, current) * 0.35 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best;
}

/**
 * After hands move, drag feet toward holds under the hand pair, then pick next.
 * Enforces hands-above-feet margin.
 */
export function pickFootHoldAfterHands(
  holds: ClimbHold[],
  hands: { left: ClimbHold | null; right: ClimbHold | null },
  currentFoot: ClimbHold | null,
  limb: "leftFoot" | "rightFoot",
  cfg: ClimbIkConfig = DEFAULT_CLIMB_IK,
): ClimbHold | null {
  const handYs = [hands.left?.y, hands.right?.y].filter((y): y is number => y != null);
  const minHandY = handYs.length ? Math.min(...handYs) : (currentFoot?.y ?? 1) + 1.2;
  const handXs = [hands.left?.x, hands.right?.x].filter((x): x is number => x != null);
  const midHandX = handXs.length ? handXs.reduce((a, b) => a + b, 0) / handXs.length : 0;
  const wall = hands.left?.wall ?? hands.right?.wall ?? currentFoot?.wall;
  const sideSign = limb === "leftFoot" ? -1 : 1;

  let best: ClimbHold | null = null;
  let bestScore = -Infinity;
  for (const h of holds) {
    if (wall && h.wall !== wall) continue;
    // Feet must stay below hands by margin
    if (h.y > minHandY - cfg.handAboveFootMargin) continue;
    if (minHandY - h.y > cfg.footUnderHand) continue;
    if (currentFoot && dist(h, currentFoot) > cfg.footReach) continue;
    const side = (h.x - midHandX) * sideSign;
    const under = minHandY - h.y;
    const score =
      (side > 0 ? 1.2 : 0.3) * Math.max(0, side) -
      Math.abs(under - 0.75) * 0.9 -
      Math.abs(h.x - midHandX) * 0.25 -
      (currentFoot ? dist(h, currentFoot) * 0.4 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best;
}

/**
 * Validate limb state: both hands above both feet by margin.
 */
export function validateHandAboveFeet(
  holds: ClimbHold[],
  state: ClimbLimbState,
  margin = DEFAULT_CLIMB_IK.handAboveFootMargin,
): boolean {
  const lh = holdById(holds, state.leftHand);
  const rh = holdById(holds, state.rightHand);
  const lf = holdById(holds, state.leftFoot);
  const rf = holdById(holds, state.rightFoot);
  const handMin = Math.min(lh?.y ?? Infinity, rh?.y ?? Infinity);
  const footMax = Math.max(lf?.y ?? -Infinity, rf?.y ?? -Infinity);
  if (!Number.isFinite(handMin) || !Number.isFinite(footMax)) return true;
  return handMin >= footMax + margin;
}

/**
 * Advance one locomotion step: move one hand up, then drag both feet.
 * Returns new limb state (hold ids).
 */
export function stepClimbLocomotion(
  holds: ClimbHold[],
  state: ClimbLimbState,
  preferHand: "leftHand" | "rightHand" = "leftHand",
  bodyY = 1,
  cfg: ClimbIkConfig = DEFAULT_CLIMB_IK,
): ClimbLimbState {
  const next = { ...state };
  const curHand = holdById(holds, preferHand === "leftHand" ? state.leftHand : state.rightHand);
  const picked = pickNextHandHold(holds, curHand, preferHand, bodyY, cfg);
  if (picked) {
    if (preferHand === "leftHand") next.leftHand = picked.id;
    else next.rightHand = picked.id;
  }
  const hands = {
    left: holdById(holds, next.leftHand),
    right: holdById(holds, next.rightHand),
  };
  const lf = pickFootHoldAfterHands(
    holds,
    hands,
    holdById(holds, next.leftFoot),
    "leftFoot",
    cfg,
  );
  const rf = pickFootHoldAfterHands(
    holds,
    hands,
    holdById(holds, next.rightFoot),
    "rightFoot",
    cfg,
  );
  if (lf) next.leftFoot = lf.id;
  if (rf) next.rightFoot = rf.id;
  // If rule violated, pull feet down (clear and re-pick) — already constrained
  if (!validateHandAboveFeet(holds, next, cfg.handAboveFootMargin)) {
    // drop foot ids that violate
    for (const foot of ["leftFoot", "rightFoot"] as const) {
      const f = holdById(holds, next[foot]);
      const minH = Math.min(hands.left?.y ?? 99, hands.right?.y ?? 99);
      if (f && f.y > minH - cfg.handAboveFootMargin) next[foot] = null;
    }
  }
  return next;
}

/** Seed initial four-limb attachment near a start hold / body. */
export function seedClimbPose(
  holds: ClimbHold[],
  wall: ClimbHold["wall"],
  body: { x: number; y: number; z: number },
  cfg: ClimbIkConfig = DEFAULT_CLIMB_IK,
): ClimbLimbState {
  const onWall = holds.filter((h) => h.wall === wall);
  const near = [...onWall].sort(
    (a, b) =>
      Math.hypot(a.x - body.x, a.y - body.y, a.z - body.z) -
      Math.hypot(b.x - body.x, b.y - body.y, b.z - body.z),
  );
  const hands = near.filter((h) => h.y >= body.y + 0.9).slice(0, 8);
  const feet = near.filter((h) => h.y < body.y + 0.9 && h.y > body.y - 0.2).slice(0, 8);
  const leftH = hands.find((h) => h.x <= body.x) ?? hands[0] ?? null;
  const rightH = hands.find((h) => h.x > body.x && h.id !== leftH?.id) ?? hands[1] ?? leftH;
  const leftF = feet.find((h) => h.x <= body.x) ?? feet[0] ?? null;
  const rightF = feet.find((h) => h.x > body.x && h.id !== leftF?.id) ?? feet[1] ?? leftF;
  const state: ClimbLimbState = {
    leftHand: leftH?.id ?? null,
    rightHand: rightH?.id ?? null,
    leftFoot: leftF?.id ?? null,
    rightFoot: rightF?.id ?? null,
  };
  // Ensure margin
  if (!validateHandAboveFeet(onWall, state, cfg.handAboveFootMargin)) {
    const minHand = Math.min(leftH?.y ?? 2, rightH?.y ?? 2);
    for (const f of [leftF, rightF]) {
      if (f && f.y > minHand - cfg.handAboveFootMargin) {
        if (state.leftFoot === f.id) state.leftFoot = null;
        if (state.rightFoot === f.id) state.rightFoot = null;
      }
    }
  }
  return state;
}
