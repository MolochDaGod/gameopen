/**
 * Graphing math for animation + VFX paths (Open / GRUDOX in-app stages).
 *
 * Pure functions — no Three dependency for unit tests. Use with
 * THREE.CatmullRomCurve3 / TubeGeometry in splineVfx.ts.
 */

export type Vec3 = { x: number; y: number; z: number };

export function v3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** Smoothstep (Hermite). */
export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Smootherstep (Ken Perlin). */
export function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Ease in-out cubic. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Ease out elastic (UI / skill pop). */
export function easeOutElastic(t: number): number {
  const x = clamp01(t);
  if (x === 0 || x === 1) return x;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}

/** Linear interpolate vectors. */
export function lerpV(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/** Cubic Bezier (4 control points). t in [0,1]. */
export function cubicBezier(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    z: uuu * p0.z + 3 * uu * t * p1.z + 3 * u * tt * p2.z + ttt * p3.z,
  };
}

/**
 * Catmull–Rom segment through p1→p2 with neighbors p0,p3 (uniform CR).
 * At t=0 → p1, t=1 → p2.
 */
export function catmullRom(
  p0: Vec3,
  p1: Vec3,
  p2: Vec3,
  p3: Vec3,
  t: number,
  _tension = 0.5,
): Vec3 {
  void _tension;
  const t2 = t * t;
  const t3 = t2 * t;
  const v = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b +
      (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3);
  return {
    x: v(p0.x, p1.x, p2.x, p3.x),
    y: v(p0.y, p1.y, p2.y, p3.y),
    z: v(p0.z, p1.z, p2.z, p3.z),
  };
}

/** Sample a closed or open polyline via Catmull–Rom. */
export function sampleCatmullRomPath(
  points: Vec3[],
  t: number,
  closed = true,
): Vec3 {
  if (points.length === 0) return v3();
  if (points.length === 1) return { ...points[0]! };
  if (points.length === 2) return lerpV(points[0]!, points[1]!, clamp01(t));

  const n = points.length;
  const segs = closed ? n : n - 1;
  const u = clamp01(t) * segs;
  const i = Math.min(Math.floor(u), segs - 1);
  const local = u - i;
  const p0 = points[(i - 1 + n) % n]!;
  const p1 = points[i % n]!;
  const p2 = points[(i + 1) % n]!;
  const p3 = points[(i + 2) % n]!;
  return catmullRom(p0, p1, p2, p3, local);
}

/** Evenly sample N points on a Catmull–Rom path. */
export function resamplePath(points: Vec3[], samples: number, closed = true): Vec3[] {
  const out: Vec3[] = [];
  const m = Math.max(2, samples);
  for (let i = 0; i < m; i++) {
    out.push(sampleCatmullRomPath(points, i / (m - (closed ? 0 : 1)), closed));
  }
  return out;
}

/**
 * Graph layout: place N nodes on a circle (for zone connection graphs).
 * Returns positions in XZ plane, y fixed.
 */
export function circleGraphNodes(count: number, radius: number, y = 0): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    out.push(v3(Math.cos(a) * radius, y, Math.sin(a) * radius));
  }
  return out;
}

/** Chord length of arc between two unit-circle angles (for edge weight UI). */
export function arcWeight(i: number, j: number, n: number): number {
  const d = Math.min(Math.abs(i - j), n - Math.abs(i - j));
  return d / Math.max(1, Math.floor(n / 2));
}

/** Oscillating pulse 0..1 for emissive / bloom drive. */
export function pulse(timeSec: number, hz = 0.35, phase = 0): number {
  return 0.5 + 0.5 * Math.sin(timeSec * hz * Math.PI * 2 + phase);
}
