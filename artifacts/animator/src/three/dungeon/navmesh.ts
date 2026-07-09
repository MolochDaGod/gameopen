/**
 * navmesh.ts — pure grid navmesh + A* pathfinding for the dungeon.
 *
 * The dungeon floor is sampled (elsewhere, via downward raycasts against the
 * trimesh) into a regular XZ grid of walkable cells, each carrying a floor
 * height. This module is intentionally pure-data: it has NO three.js / DOM
 * dependency beyond plain number math, so it is deterministic and unit-testable
 * in plain node. The grid *building* (raycasting) lives in Dungeon.ts; the
 * search and coordinate math live here.
 */

/** A walkable grid over the dungeon floor. `walkable[r*cols + c]` is 1/0. */
export interface NavGrid {
  cols: number;
  rows: number;
  /** World size (metres) of one square cell. */
  cell: number;
  /** World X of the CENTRE of cell column 0. */
  originX: number;
  /** World Z of the CENTRE of cell row 0. */
  originZ: number;
  walkable: Uint8Array;
  /** Floor world-Y per cell (only meaningful where walkable). */
  height: Float32Array;
}

/** Allocate an all-unwalkable grid. */
export function makeGrid(
  cols: number,
  rows: number,
  cell: number,
  originX: number,
  originZ: number,
): NavGrid {
  return {
    cols,
    rows,
    cell,
    originX,
    originZ,
    walkable: new Uint8Array(cols * rows),
    height: new Float32Array(cols * rows),
  };
}

export function idx(g: NavGrid, c: number, r: number): number {
  return r * g.cols + c;
}

export function inBounds(g: NavGrid, c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < g.cols && r < g.rows;
}

export function isWalkable(g: NavGrid, c: number, r: number): boolean {
  return inBounds(g, c, r) && g.walkable[idx(g, c, r)] === 1;
}

/** World (x,z) → nearest cell coordinates (may be out of bounds). */
export function worldToCell(g: NavGrid, x: number, z: number): { c: number; r: number } {
  return {
    c: Math.round((x - g.originX) / g.cell),
    r: Math.round((z - g.originZ) / g.cell),
  };
}

/** Cell coordinates → world centre (x,z). */
export function cellCenter(g: NavGrid, c: number, r: number): { x: number; z: number } {
  return { x: g.originX + c * g.cell, z: g.originZ + r * g.cell };
}

/** Floor height at a world (x,z), or `fallback` if the cell isn't walkable. */
export function heightAt(g: NavGrid, x: number, z: number, fallback = 0): number {
  const { c, r } = worldToCell(g, x, z);
  if (!isWalkable(g, c, r)) return fallback;
  return g.height[idx(g, c, r)];
}

/** Find the nearest walkable cell to (c,r) within `maxRing` rings (BFS-ish). */
export function nearestWalkable(
  g: NavGrid,
  c: number,
  r: number,
  maxRing = 6,
): { c: number; r: number } | null {
  if (isWalkable(g, c, r)) return { c, r };
  for (let ring = 1; ring <= maxRing; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        if (isWalkable(g, c + dc, r + dr)) return { c: c + dc, r: r + dr };
      }
    }
  }
  return null;
}

interface PQItem {
  i: number;
  f: number;
}

/** Tiny binary min-heap keyed on `f` (good enough for dungeon-sized grids). */
class MinHeap {
  private a: PQItem[] = [];
  get size(): number {
    return this.a.length;
  }
  push(item: PQItem): void {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): PQItem | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let s = i;
        if (l < a.length && a[l].f < a[s].f) s = l;
        if (r < a.length && a[r].f < a[s].f) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]];
        i = s;
      }
    }
    return top;
  }
}

const NEIGHBORS: { dc: number; dr: number; cost: number }[] = [
  { dc: 1, dr: 0, cost: 1 },
  { dc: -1, dr: 0, cost: 1 },
  { dc: 0, dr: 1, cost: 1 },
  { dc: 0, dr: -1, cost: 1 },
  { dc: 1, dr: 1, cost: Math.SQRT2 },
  { dc: 1, dr: -1, cost: Math.SQRT2 },
  { dc: -1, dr: 1, cost: Math.SQRT2 },
  { dc: -1, dr: -1, cost: Math.SQRT2 },
];

/** Octile heuristic between two cells. */
function octile(c0: number, r0: number, c1: number, r1: number): number {
  const dc = Math.abs(c0 - c1);
  const dr = Math.abs(r0 - r1);
  return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr);
}

/** A waypoint in world space (floor centre + its height). */
export interface NavWaypoint {
  x: number;
  z: number;
  y: number;
}

/**
 * A* from world (startX,startZ) to (goalX,goalZ). Start/goal snap to the nearest
 * walkable cell. Diagonal moves are forbidden when they'd cut a blocked corner.
 * Returns an ordered list of world waypoints (cell centres) from start→goal, or
 * an empty array if no path exists. The first cell (start) is omitted so the
 * caller steps toward the next cell immediately.
 */
export function findPath(
  g: NavGrid,
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
): NavWaypoint[] {
  const s0 = worldToCell(g, startX, startZ);
  const g0 = worldToCell(g, goalX, goalZ);
  const start = nearestWalkable(g, s0.c, s0.r);
  const goal = nearestWalkable(g, g0.c, g0.r);
  if (!start || !goal) return [];
  const startI = idx(g, start.c, start.r);
  const goalI = idx(g, goal.c, goal.r);
  if (startI === goalI) return [];

  const n = g.cols * g.rows;
  const gScore = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  gScore[startI] = 0;

  const open = new MinHeap();
  open.push({ i: startI, f: octile(start.c, start.r, goal.c, goal.r) });

  while (open.size > 0) {
    const cur = open.pop()!;
    if (closed[cur.i]) continue;
    closed[cur.i] = 1;
    if (cur.i === goalI) break;
    const cc = cur.i % g.cols;
    const cr = (cur.i - cc) / g.cols;
    for (const nb of NEIGHBORS) {
      const nc = cc + nb.dc;
      const nr = cr + nb.dr;
      if (!isWalkable(g, nc, nr)) continue;
      // Disallow squeezing diagonally past a blocked corner.
      if (nb.dc !== 0 && nb.dr !== 0) {
        if (!isWalkable(g, cc + nb.dc, cr) || !isWalkable(g, cc, cr + nb.dr)) continue;
      }
      const ni = idx(g, nc, nr);
      if (closed[ni]) continue;
      const tentative = gScore[cur.i] + nb.cost;
      if (tentative < gScore[ni]) {
        gScore[ni] = tentative;
        came[ni] = cur.i;
        open.push({ i: ni, f: tentative + octile(nc, nr, goal.c, goal.r) });
      }
    }
  }

  if (came[goalI] === -1 && goalI !== startI) return [];

  // Reconstruct, then drop the start cell.
  const cells: number[] = [];
  let i = goalI;
  while (i !== -1) {
    cells.push(i);
    if (i === startI) break;
    i = came[i];
  }
  cells.reverse();
  const out: NavWaypoint[] = [];
  for (let k = 1; k < cells.length; k++) {
    const ci = cells[k];
    const c = ci % g.cols;
    const r = (ci - c) / g.cols;
    const ctr = cellCenter(g, c, r);
    out.push({ x: ctr.x, z: ctr.z, y: g.height[ci] });
  }
  return out;
}
