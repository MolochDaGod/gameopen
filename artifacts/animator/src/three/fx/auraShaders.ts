/**
 * Aura shell shaders — inflated body layer (~0.1 m along normals) with
 * pattern-driven animated surfaces (heal swell, emerald charge, ice swirl,
 * purple arcane, orange fire rise, etc.).
 *
 * Vertex: `position + normal * uExpand` so the shell sits outside the unit mesh.
 * Fragment: procedural noise + fresnel + pattern modes; additive/transparent.
 */

import * as THREE from "three";

/** Visual pattern family for the shell layer. */
export type AuraPattern =
  | "healSwell" // rising soft bands — healing
  | "chargeGlow" // emerald charge pulse
  | "iceSwirl" // light-blue swirling veins
  | "arcanePulse" // purple occult pulse
  | "fireRise" // orange rising heat
  | "sparkGrid" // lightning lattice
  | "holyShimmer" // white-gold sparkle
  | "sleepHaze"; // soft blue fog bands

export interface AuraShellOpts {
  color: number;
  color2?: number;
  pattern: AuraPattern;
  /** Normal inflate distance in metres (default 0.1). */
  expand?: number;
  /** Peak opacity 0–1. */
  opacity?: number;
  /** Scroll / swirl speed multiplier. */
  speed?: number;
}

const NOISE_GLSL = /* glsl */ `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}
`;

const VERT = /* glsl */ `
uniform float uExpand;
uniform float uTime;
uniform float uPulse;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec2 vUv;
varying float vFresnelHint;

void main() {
  vUv = uv;
  // Inflate shell  uExpand metres along object normal (outside the unit surface).
  vec3 inflated = position + normalize(normal) * uExpand;
  vec4 worldPos = modelMatrix * vec4(inflated, 1.0);
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vFresnelHint = pow(1.0 - max(dot(viewDir, vWorldNormal), 0.0), 2.2);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

function fragForPattern(pattern: AuraPattern): string {
  // pattern id as int for branches (avoid string compare in GLSL)
  const mode =
    pattern === "healSwell"
      ? 0
      : pattern === "chargeGlow"
        ? 1
        : pattern === "iceSwirl"
          ? 2
          : pattern === "arcanePulse"
            ? 3
            : pattern === "fireRise"
              ? 4
              : pattern === "sparkGrid"
                ? 5
                : pattern === "holyShimmer"
                  ? 6
                  : 7; // sleepHaze

  return /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uTime;
uniform float uOpacity;
uniform float uSpeed;
uniform float uPulse;
uniform int uMode;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec2 vUv;
varying float vFresnelHint;

${NOISE_GLSL}

void main() {
  float t = uTime * uSpeed;
  vec2 uv = vUv;
  float n = fbm(uv * 4.0 + vec2(0.0, -t * 0.35));
  float n2 = fbm(uv * 7.0 + vec2(t * 0.2, t * 0.15));
  float pattern = 0.0;
  float alphaBoost = 1.0;

  if (uMode == 0) {
    // healSwell — soft rising emerald bands
    float bands = sin((uv.y * 10.0 - t * 2.2) + n * 2.5) * 0.5 + 0.5;
    pattern = smoothstep(0.35, 0.85, bands) * (0.55 + 0.45 * n);
    alphaBoost = 0.9 + 0.25 * uPulse;
  } else if (uMode == 1) {
    // chargeGlow — radial charge + pulse
    float r = length(uv - 0.5) * 2.0;
    float ring = smoothstep(0.15, 0.0, abs(r - (0.35 + 0.15 * sin(t * 3.0))));
    pattern = (1.0 - r) * 0.5 + ring * 0.9 + n * 0.25;
    alphaBoost = 0.75 + 0.45 * uPulse;
  } else if (uMode == 2) {
    // iceSwirl — light blue swirling veins
    float ang = atan(uv.y - 0.5, uv.x - 0.5);
    float swirl = sin(ang * 5.0 + t * 1.8 + n * 4.0) * 0.5 + 0.5;
    float veins = smoothstep(0.4, 0.9, swirl * (0.6 + n2));
    pattern = veins + (1.0 - length(uv - 0.5) * 1.4) * 0.3;
  } else if (uMode == 3) {
    // arcanePulse — purple occult hex-ish pulse
    float grid = abs(sin(uv.x * 18.0 + t)) * abs(sin(uv.y * 18.0 - t * 0.7));
    pattern = pow(grid, 0.45) * (0.5 + 0.5 * n) + vFresnelHint * 0.4;
    alphaBoost = 0.7 + 0.5 * abs(sin(t * 2.5));
  } else if (uMode == 4) {
    // fireRise — orange rising heat tongues
    float rise = fbm(vec2(uv.x * 5.0, uv.y * 3.0 - t * 1.6));
    float tongues = smoothstep(0.35, 0.9, rise + (1.0 - uv.y) * 0.35);
    pattern = tongues * (0.6 + 0.4 * n2);
  } else if (uMode == 5) {
    // sparkGrid — lightning lattice
    float gx = abs(fract(uv.x * 12.0 + t * 0.5) - 0.5);
    float gy = abs(fract(uv.y * 8.0 - t) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.04, min(gx, gy));
    float flash = step(0.92, n2);
    pattern = line * 0.7 + flash + n * 0.15;
  } else if (uMode == 6) {
    // holyShimmer
    float spark = step(0.82, n2);
    pattern = vFresnelHint * 0.7 + spark + (1.0 - length(uv - 0.5)) * 0.25;
    alphaBoost = 0.8 + 0.3 * uPulse;
  } else {
    // sleepHaze
    float haze = fbm(uv * 2.5 + vec2(t * 0.1, -t * 0.08));
    pattern = haze * 0.7 + (1.0 - abs(uv.y - 0.6)) * 0.3;
    alphaBoost = 0.55;
  }

  float fres = vFresnelHint;
  float body = mix(pattern, fres, 0.35);
  vec3 col = mix(uColor, uColor2, body * 0.65 + n * 0.2);
  col += uColor2 * fres * 0.55;

  float alpha = clamp(body * uOpacity * alphaBoost + fres * uOpacity * 0.5, 0.0, 1.0);
  // Soft bottom fade so feet don't clip
  alpha *= smoothstep(0.0, 0.12, uv.y) * smoothstep(1.05, 0.75, uv.y);

  gl_FragColor = vec4(col, alpha);
}
`;
}

/**
 * Build an additive inflated aura shell material.
 * Call `mat.uniforms.uTime.value = age` each frame.
 */
export function createAuraShellMaterial(opts: AuraShellOpts): THREE.ShaderMaterial {
  const c1 = new THREE.Color(opts.color);
  const c2 = new THREE.Color(opts.color2 ?? opts.color);
  const pattern = opts.pattern;
  const mode =
    pattern === "healSwell"
      ? 0
      : pattern === "chargeGlow"
        ? 1
        : pattern === "iceSwirl"
          ? 2
          : pattern === "arcanePulse"
            ? 3
            : pattern === "fireRise"
              ? 4
              : pattern === "sparkGrid"
                ? 5
                : pattern === "holyShimmer"
                  ? 6
                  : 7;

  return new THREE.ShaderMaterial({
    uniforms: {
      uExpand: { value: opts.expand ?? 0.1 },
      uTime: { value: 0 },
      uPulse: { value: 1 },
      uSpeed: { value: opts.speed ?? 1 },
      uOpacity: { value: opts.opacity ?? 0.55 },
      uColor: { value: c1 },
      uColor2: { value: c2 },
      uMode: { value: mode },
    },
    vertexShader: VERT,
    fragmentShader: fragForPattern(pattern),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Humanoid proxy shell: capsule body + head, already sized so expand=0.1 sits
 * just outside a typical 1.8 m unit. For true per-mesh shells use
 * {@link createExpandedMeshLayer}.
 */
export function createHumanoidAuraShell(
  mat: THREE.ShaderMaterial,
): THREE.Group {
  const g = new THREE.Group();
  g.name = "auraShellHumanoid";
  // Base body slightly under skin; shader expands +0.1 m along normals
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 8, 16), mat);
  body.position.y = 0.95;
  body.name = "auraBody";
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat);
  head.position.y = 1.7;
  head.name = "auraHead";
  g.add(head);
  return g;
}

/**
 * Clone a source mesh's geometry as an inflated aura layer (same material).
 * Skinned meshes: uses bind geometry only (static shell) — good for props;
 * for live characters prefer humanoid proxy synced to root.
 */
export function createExpandedMeshLayer(
  source: THREE.Mesh,
  mat: THREE.ShaderMaterial,
): THREE.Mesh {
  const geo = source.geometry.clone();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `auraLayer:${source.name || "mesh"}`;
  mesh.renderOrder = 2;
  // Match source transform if already in world — caller parents under same parent
  mesh.position.copy(source.position);
  mesh.quaternion.copy(source.quaternion);
  mesh.scale.copy(source.scale);
  return mesh;
}

/**
 * Flame-aura-class energy material for slash projectiles (ice-bow mesh).
 * Same noise / pattern language as body aura shells, plus a 3-stop fire trail
 * palette (core → mid → edge) and flow along the blade UV.
 *
 * Drive each frame: `mat.uniforms.uTime.value = age; mat.uniforms.uFade.value = fade;`
 */
export function createSlashEnergyMaterial(opts: {
  core: number;
  mid: number;
  edge: number;
  dark?: number;
  pattern: AuraPattern;
  opacity?: number;
  speed?: number;
  /** Normal inflate for outer glow shell (0 = skin-tight). */
  expand?: number;
}): THREE.ShaderMaterial {
  const mode =
    opts.pattern === "healSwell"
      ? 0
      : opts.pattern === "chargeGlow"
        ? 1
        : opts.pattern === "iceSwirl"
          ? 2
          : opts.pattern === "arcanePulse"
            ? 3
            : opts.pattern === "fireRise"
              ? 4
              : opts.pattern === "sparkGrid"
                ? 5
                : opts.pattern === "holyShimmer"
                  ? 6
                  : 7;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 1 },
      uPulse: { value: 1 },
      uSpeed: { value: opts.speed ?? 1.35 },
      uOpacity: { value: opts.opacity ?? 0.92 },
      uExpand: { value: opts.expand ?? 0.04 },
      uCore: { value: new THREE.Color(opts.core) },
      uMid: { value: new THREE.Color(opts.mid) },
      uEdge: { value: new THREE.Color(opts.edge) },
      uDark: { value: new THREE.Color(opts.dark ?? 0x100800) },
      uMode: { value: mode },
      uBrightness: { value: 1.35 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uExpand;
      uniform float uTime;
      uniform float uSpeed;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying float vFresnel;

      void main() {
        vUv = uv;
        // Subtle breath along normals (flame-aura shell language)
        float breath = 1.0 + 0.04 * sin(uTime * uSpeed * 3.0 + position.y * 6.0);
        vec3 inflated = position + normalize(normal) * uExpand * breath;
        vec4 worldPos = modelMatrix * vec4(inflated, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vFresnel = pow(1.0 - max(dot(viewDir, vWorldNormal), 0.0), 2.0);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uFade;
      uniform float uPulse;
      uniform float uSpeed;
      uniform float uOpacity;
      uniform vec3 uCore;
      uniform vec3 uMid;
      uniform vec3 uEdge;
      uniform vec3 uDark;
      uniform int uMode;
      uniform float uBrightness;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying float vFresnel;

      ${NOISE_GLSL}

      void main() {
        float t = uTime * uSpeed;
        vec2 uv = vUv;
        // Flow along blade length (U) with heat rise (V) — same family as fire trail
        float n = fbm(uv * 5.0 + vec2(-t * 0.55, t * 0.2));
        float n2 = fbm(uv * 9.0 + vec2(t * 0.3, -t * 0.4));
        float pattern = 0.0;
        float alphaBoost = 1.0;

        if (uMode == 0) {
          float bands = sin((uv.y * 12.0 - t * 2.4) + n * 2.5) * 0.5 + 0.5;
          pattern = smoothstep(0.3, 0.9, bands) * (0.55 + 0.45 * n);
        } else if (uMode == 1) {
          float r = length(uv - 0.5) * 2.0;
          float ring = smoothstep(0.12, 0.0, abs(r - (0.4 + 0.12 * sin(t * 3.2))));
          pattern = (1.0 - r) * 0.55 + ring + n * 0.2;
          alphaBoost = 0.8 + 0.4 * uPulse;
        } else if (uMode == 2) {
          // iceSwirl — veins + crystal noise
          float ang = atan(uv.y - 0.5, uv.x - 0.5);
          float swirl = sin(ang * 6.0 + t * 2.0 + n * 4.0) * 0.5 + 0.5;
          pattern = smoothstep(0.35, 0.95, swirl * (0.55 + n2)) + (1.0 - length(uv - 0.5) * 1.3) * 0.35;
        } else if (uMode == 3) {
          // arcanePulse — occult lattice
          float grid = abs(sin(uv.x * 20.0 + t)) * abs(sin(uv.y * 16.0 - t * 0.8));
          pattern = pow(grid, 0.4) * (0.5 + 0.5 * n) + vFresnel * 0.45;
          alphaBoost = 0.75 + 0.45 * abs(sin(t * 2.8));
        } else if (uMode == 4) {
          // fireRise — heat tongues along blade
          float rise = fbm(vec2(uv.x * 6.0, uv.y * 3.5 - t * 1.8));
          float tongues = smoothstep(0.28, 0.92, rise + (1.0 - uv.y) * 0.4);
          pattern = tongues * (0.55 + 0.45 * n2) + n * 0.15;
        } else if (uMode == 5) {
          float gx = abs(fract(uv.x * 14.0 + t * 0.6) - 0.5);
          float gy = abs(fract(uv.y * 10.0 - t) - 0.5);
          float line = 1.0 - smoothstep(0.0, 0.035, min(gx, gy));
          pattern = line * 0.75 + step(0.9, n2) + n * 0.12;
        } else if (uMode == 6) {
          // holyShimmer
          pattern = vFresnel * 0.75 + step(0.8, n2) + (1.0 - length(uv - 0.5)) * 0.3;
          alphaBoost = 0.85 + 0.35 * uPulse;
        } else {
          float haze = fbm(uv * 2.8 + vec2(t * 0.12, -t * 0.1));
          pattern = haze * 0.75 + 0.25;
          alphaBoost = 0.6;
        }

        // 3-stop fire-trail palette along energy density
        float dens = clamp(pattern * 0.7 + vFresnel * 0.45 + n * 0.15, 0.0, 1.0);
        vec3 col;
        if (dens < 0.33) col = mix(uCore, uMid, dens / 0.33);
        else if (dens < 0.66) col = mix(uMid, uEdge, (dens - 0.33) / 0.33);
        else col = mix(uEdge, uDark, (dens - 0.66) / 0.34);
        col += uCore * vFresnel * 0.55;
        col *= uBrightness;

        float alpha = clamp(dens * uOpacity * alphaBoost + vFresnel * uOpacity * 0.55, 0.0, 1.0);
        alpha *= uFade;
        // Soft edge so hard mesh silhouette dissolves into aura
        alpha *= smoothstep(0.0, 0.08, dens + vFresnel * 0.5);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/** Map status-ish intent → default pattern. */
export function patternForStatusStyle(
  style: string,
  kind: "buff" | "debuff",
  color: number,
): AuraPattern {
  if (style === "bubble") return kind === "buff" ? "chargeGlow" : "arcanePulse";
  if (style === "sleep") return "sleepHaze";
  if (style === "vortex") return "arcanePulse";
  if (style === "spark") return "sparkGrid";
  if (style === "orbit") return "iceSwirl";
  // rise — pick by color family
  const c = new THREE.Color(color);
  if (c.g > c.r && c.g > c.b) return kind === "buff" ? "healSwell" : "healSwell";
  if (c.r > 0.7 && c.g > 0.35 && c.b < 0.35) return "fireRise";
  if (c.b > c.r) return "iceSwirl";
  if (c.r > 0.5 && c.b > 0.5) return "arcanePulse";
  return kind === "buff" ? "holyShimmer" : "fireRise";
}

export function tickAuraMaterial(mat: THREE.ShaderMaterial, time: number, pulse = 1) {
  if (mat.uniforms.uTime) mat.uniforms.uTime.value = time;
  if (mat.uniforms.uPulse) mat.uniforms.uPulse.value = pulse;
}
