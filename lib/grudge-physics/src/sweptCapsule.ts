/**
 * Pure geometry for continuous weapon / body capsule contact.
 * No three.js dependency — unit-testable in node.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CapsuleSeg {
  a: Vec3;
  b: Vec3;
  radius: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function lenSq(a: Vec3): number {
  return dot(a, a);
}

/**
 * Closest points between two segments. Returns squared distance.
 * Real-Time Collision Detection §5.1.9 (Ericson).
 */
export function closestSegmentSegment(
  p1: Vec3,
  q1: Vec3,
  p2: Vec3,
  q2: Vec3,
): { d2: number; c1: Vec3; c2: Vec3 } {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = lenSq(d1);
  const e = lenSq(d2);
  const f = dot(d2, r);
  const EPS = 1e-9;
  let s: number;
  let t: number;

  if (a <= EPS && e <= EPS) {
    s = 0;
    t = 0;
  } else if (a <= EPS) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = dot(d1, r);
    if (e <= EPS) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom > EPS ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }

  const c1 = add(p1, scale(d1, s));
  const c2 = add(p2, scale(d2, t));
  return { d2: lenSq(sub(c1, c2)), c1, c2 };
}

/** True when two capsules overlap (or touch). */
export function capsulesOverlap(a: CapsuleSeg, b: CapsuleSeg): boolean {
  const { d2 } = closestSegmentSegment(a.a, a.b, b.a, b.b);
  const r = a.radius + b.radius;
  return d2 <= r * r;
}

/**
 * Discrete multi-step sweep of edge A from prev→cur vs static capsule B.
 * Returns earliest hit parameter t in [0,1] or null.
 */
export function sweptCapsuleHit(
  prevA: Vec3,
  prevB: Vec3,
  curA: Vec3,
  curB: Vec3,
  edgeRadius: number,
  target: CapsuleSeg,
  steps = 4,
): { t: number; point: Vec3; depth: number } | null {
  const n = Math.max(1, steps);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const a = {
      x: prevA.x + (curA.x - prevA.x) * t,
      y: prevA.y + (curA.y - prevA.y) * t,
      z: prevA.z + (curA.z - prevA.z) * t,
    };
    const b = {
      x: prevB.x + (curB.x - prevB.x) * t,
      y: prevB.y + (curB.y - prevB.y) * t,
      z: prevB.z + (curB.z - prevB.z) * t,
    };
    const { d2, c1, c2 } = closestSegmentSegment(a, b, target.a, target.b);
    const r = edgeRadius + target.radius;
    if (d2 <= r * r) {
      const d = Math.sqrt(Math.max(0, d2));
      return { t, point: c1, depth: r - d };
    }
  }
  return null;
}
