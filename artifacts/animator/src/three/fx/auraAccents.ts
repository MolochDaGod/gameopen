/**
 * Aura accent props: particles, glowing orbs, wing billboards, orbiting splines.
 * Parent under a status aura group; call update(dt, age) each frame.
 */

import * as THREE from "three";
import { createSplineRibbon, createSplineSparks } from "./splineVfx";

export type AuraAccentKind = "particles" | "orbs" | "wings" | "splineOrbit" | "hoverCrystals";

export interface AuraAccentHandle {
  group: THREE.Group;
  update(dt: number, age: number): void;
  dispose(): void;
}

let SOFT: THREE.Texture | null = null;
function softTex(): THREE.Texture {
  if (SOFT) return SOFT;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.4, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  SOFT = new THREE.CanvasTexture(c);
  SOFT.colorSpace = THREE.SRGBColorSpace;
  return SOFT;
}

/** Rising / orbiting soft particles. */
export function createParticleAccent(
  color: number,
  mode: "rise" | "orbit" | "spark" = "rise",
  count = 40,
): AuraAccentHandle {
  const group = new THREE.Group();
  group.name = "auraParticles";
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color(color);
  const life = new Float32Array(count);
  const max = new Float32Array(count);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seed[i * 4] = Math.random() * Math.PI * 2;
    seed[i * 4 + 1] = 0.2 + Math.random() * 0.5;
    seed[i * 4 + 2] = 0.4 + Math.random() * 1.2;
    seed[i * 4 + 3] = 0.5 + Math.random();
    max[i] = 0.8 + Math.random() * 1.4;
    life[i] = Math.random() * max[i];
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: mode === "spark" ? 0.12 : 0.18,
    map: softTex(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    opacity: 0.9,
  });
  const pts = new THREE.Points(geo, mat);
  group.add(pts);

  return {
    group,
    update(dt, age) {
      for (let i = 0; i < count; i++) {
        life[i] += dt;
        if (life[i] >= max[i]) {
          life[i] = 0;
          seed[i * 4] = Math.random() * Math.PI * 2;
        }
        const t = life[i] / max[i];
        const a = seed[i * 4]! + (mode === "orbit" ? age * 1.4 : age * 0.3);
        const r = seed[i * 4 + 1]!;
        const ix = i * 3;
        if (mode === "rise") {
          pos[ix] = Math.cos(a) * r * (1 + t * 0.2);
          pos[ix + 1] = t * 1.8 * seed[i * 4 + 3]!;
          pos[ix + 2] = Math.sin(a) * r * (1 + t * 0.2);
        } else if (mode === "orbit") {
          pos[ix] = Math.cos(a) * (0.55 + r * 0.3);
          pos[ix + 1] = seed[i * 4 + 2]! + Math.sin(age * 2 + i) * 0.1;
          pos[ix + 2] = Math.sin(a) * (0.55 + r * 0.3);
        } else {
          pos[ix] = Math.cos(a) * r + (Math.random() - 0.5) * 0.05;
          pos[ix + 1] = 0.5 + Math.random() * 1.2;
          pos[ix + 2] = Math.sin(a) * r;
        }
        const fade = Math.sin(Math.min(1, t) * Math.PI);
        col[ix] = c.r * fade;
        col[ix + 1] = c.g * fade;
        col[ix + 2] = c.b * fade;
      }
      (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** Floating glowing orbs (charge / absorb look). */
export function createOrbAccent(color: number, count = 5): AuraAccentHandle {
  const group = new THREE.Group();
  group.name = "auraOrbs";
  const mat = new THREE.MeshBasicMaterial({
    color,
    map: softTex(),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const orbs: THREE.Mesh[] = [];
  const phases: number[] = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + (i % 3) * 0.02, 10, 8), mat);
    orbs.push(m);
    phases.push(Math.random() * Math.PI * 2);
    group.add(m);
  }
  return {
    group,
    update(_dt, age) {
      for (let i = 0; i < orbs.length; i++) {
        const a = phases[i]! + age * (0.7 + i * 0.15);
        const y = 0.5 + ((i * 0.28) % 1.4) + Math.sin(age * 2 + i) * 0.12;
        const r = 0.55 + (i % 2) * 0.15;
        orbs[i]!.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        orbs[i]!.scale.setScalar(0.85 + Math.sin(age * 4 + i) * 0.2);
      }
    },
    dispose() {
      mat.dispose();
      orbs[0]?.geometry.dispose();
    },
  };
}

/** Soft wing billboards (buff / holy / rage). */
export function createWingAccent(color: number): AuraAccentHandle {
  const group = new THREE.Group();
  group.name = "auraWings";
  const mat = new THREE.MeshBasicMaterial({
    color,
    map: softTex(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(0.55, 0.9);
  const left = new THREE.Mesh(geo, mat);
  const right = new THREE.Mesh(geo, mat);
  left.position.set(-0.35, 1.15, -0.1);
  right.position.set(0.35, 1.15, -0.1);
  left.rotation.y = 0.4;
  right.rotation.y = -0.4;
  group.add(left, right);
  return {
    group,
    update(_dt, age) {
      const flap = Math.sin(age * 5) * 0.25;
      left.rotation.z = 0.35 + flap;
      right.rotation.z = -0.35 - flap;
      left.rotation.y = 0.45 + flap * 0.3;
      right.rotation.y = -0.45 - flap * 0.3;
      mat.opacity = 0.4 + Math.sin(age * 3) * 0.15;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** Hovering spline ribbon spinning around the unit. */
export function createSplineOrbitAccent(color: number, radius = 0.75, y = 1.0): AuraAccentHandle {
  const group = new THREE.Group();
  group.name = "auraSplineOrbit";
  const pts: { x: number; y: number; z: number }[] = [];
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wobble = Math.sin(i * 0.9) * 0.12;
    pts.push({
      x: Math.cos(a) * radius,
      y: y + wobble,
      z: Math.sin(a) * radius,
    });
  }
  const { mesh, curve, geo } = createSplineRibbon(pts, {
    color,
    radius: 0.03,
    tubularSegments: 64,
    closed: true,
  });
  // Force additive feel
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.transparent = true;
  mat.opacity = 0.75;
  mat.emissiveIntensity = 1.8;
  mat.depthWrite = false;
  group.add(mesh);
  const sparks = createSplineSparks(curve, 36, color);
  group.add(sparks.points);

  return {
    group,
    update(_dt, age) {
      group.rotation.y = age * 1.1;
      group.rotation.x = Math.sin(age * 0.6) * 0.12;
      sparks.update(age);
      mat.emissiveIntensity = 1.3 + Math.sin(age * 4) * 0.5;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      sparks.dispose();
    },
  };
}

/** Floating crystal shards (ice / rooted). */
export function createHoverCrystalAccent(color: number, count = 6): AuraAccentHandle {
  const group = new THREE.Group();
  group.name = "auraCrystals";
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    wireframe: false,
  });
  const geo = new THREE.OctahedronGeometry(0.08, 0);
  const shards: THREE.Mesh[] = [];
  const phases: number[] = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat);
    shards.push(m);
    phases.push((i / count) * Math.PI * 2);
    group.add(m);
  }
  return {
    group,
    update(_dt, age) {
      for (let i = 0; i < shards.length; i++) {
        const a = phases[i]! + age * 0.9;
        const y = 0.4 + (i % 3) * 0.4 + Math.sin(age * 2.2 + i) * 0.08;
        shards[i]!.position.set(Math.cos(a) * 0.6, y, Math.sin(a) * 0.6);
        shards[i]!.rotation.y = age * 2 + i;
        shards[i]!.rotation.x = age + i * 0.3;
      }
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

export interface AccentRecipe {
  kinds: AuraAccentKind[];
  particleMode?: "rise" | "orbit" | "spark";
}

/** Build all accents for a recipe. */
export function createAuraAccents(
  color: number,
  recipe: AccentRecipe,
): AuraAccentHandle[] {
  const out: AuraAccentHandle[] = [];
  for (const k of recipe.kinds) {
    if (k === "particles") out.push(createParticleAccent(color, recipe.particleMode ?? "rise"));
    else if (k === "orbs") out.push(createOrbAccent(color));
    else if (k === "wings") out.push(createWingAccent(color));
    else if (k === "splineOrbit") out.push(createSplineOrbitAccent(color));
    else if (k === "hoverCrystals") out.push(createHoverCrystalAccent(color));
  }
  return out;
}

/** Sensible accent sets per aura style. */
export function accentRecipeForStyle(style: string, kind: "buff" | "debuff"): AccentRecipe {
  switch (style) {
    case "bubble":
      return { kinds: ["orbs", "splineOrbit", "particles"], particleMode: "orbit" };
    case "sleep":
      return { kinds: ["particles"], particleMode: "rise" };
    case "vortex":
      return { kinds: ["splineOrbit", "particles", "orbs"], particleMode: "orbit" };
    case "spark":
      return { kinds: ["particles", "orbs"], particleMode: "spark" };
    case "orbit":
      return { kinds: ["hoverCrystals", "particles", "splineOrbit"], particleMode: "orbit" };
    case "rise":
    default:
      return kind === "buff"
        ? { kinds: ["particles", "wings", "orbs"], particleMode: "rise" }
        : { kinds: ["particles", "splineOrbit"], particleMode: "rise" };
  }
}
