/**
 * Storm ocean surface — multi-layer procedural water shader for cinema.
 * Gerstner-style waves, foam caps, dark storm albedo, wind scroll.
 */
import * as THREE from "three";

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uStorm;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vWave;
  varying vec3 vNormalW;

  // Simple Gerstner wave
  vec3 gerstner(vec2 p, float t, float amp, float wl, float speed, vec2 dir) {
    float k = 6.28318 / wl;
    float c = sqrt(9.8 / k) * speed;
    float f = k * (dot(dir, p) - c * t);
    float a = amp * (0.55 + 0.45 * uStorm);
    float sa = sin(f);
    float ca = cos(f);
    return vec3(dir.x * a * ca, a * sa, dir.y * a * ca);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    vec2 p = pos.xz;
    float t = uTime;

    vec3 d = vec3(0.0);
    d += gerstner(p, t, 0.55, 14.0, 1.0, normalize(vec2(1.0, 0.35)));
    d += gerstner(p, t, 0.32, 7.5, 1.25, normalize(vec2(-0.4, 1.0)));
    d += gerstner(p, t, 0.18, 3.8, 1.6, normalize(vec2(0.7, -0.6)));
    d += gerstner(p, t, 0.08 * uStorm, 1.8, 2.1, normalize(vec2(-0.9, 0.2)));

    pos += d;
    vWave = d.y;

    // Approximate normal from wave slope
    float e = 0.35;
    vec3 dx = gerstner(p + vec2(e, 0.0), t, 0.55, 14.0, 1.0, normalize(vec2(1.0, 0.35)))
            - gerstner(p - vec2(e, 0.0), t, 0.55, 14.0, 1.0, normalize(vec2(1.0, 0.35)));
    vec3 dz = gerstner(p + vec2(0.0, e), t, 0.32, 7.5, 1.25, normalize(vec2(-0.4, 1.0)))
            - gerstner(p - vec2(0.0, e), t, 0.32, 7.5, 1.25, normalize(vec2(-0.4, 1.0)));
    vec3 n = normalize(vec3(-dx.y, e * 2.0, -dz.y));
    vNormalW = normalize(mat3(modelMatrix) * n);

    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uStorm;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vWave;
  varying vec3 vNormalW;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.05; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 L = normalize(uSunDir);

    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.5);
    float nWave = fbm(vWorld.xz * 0.08 + uTime * 0.12);
    float depthMix = clamp(0.35 + vWave * 0.55 + nWave * 0.2, 0.0, 1.0);

    vec3 col = mix(uDeep, uShallow, depthMix);
    // Storm greys the sea
    col = mix(col, vec3(0.06, 0.09, 0.12), uStorm * 0.55);

    // Specular glints
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 64.0) * (0.25 + 0.5 * (1.0 - uStorm));
    col += vec3(0.75, 0.85, 1.0) * spec;

    // Foam on peaks + wind streaks
    float foam = smoothstep(0.28, 0.55, vWave + nWave * 0.25);
    foam *= 0.55 + 0.45 * uStorm;
    float streaks = fbm(vWorld.xz * 0.35 + vec2(uTime * 0.4, 0.0));
    foam = max(foam, smoothstep(0.72, 0.92, streaks) * 0.35 * uStorm);
    col = mix(col, uFoam, foam * 0.85);

    // Dark horizon reflection
    col = mix(col, vec3(0.02, 0.03, 0.05), fres * (0.4 + 0.4 * uStorm));

    float alpha = 0.88 + fres * 0.1;
    gl_FragColor = vec4(col, alpha);
  }
`;

export type StormWaterHandle = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  update: (t: number, storm: number) => void;
  dispose: () => void;
};

export function createStormWater(size = 280, segments = 128): StormWaterHandle {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStorm: { value: 0.85 },
      uDeep: { value: new THREE.Color(0x041018) },
      uShallow: { value: new THREE.Color(0x0a3a48) },
      uFoam: { value: new THREE.Color(0xc8d8e8) },
      uSunDir: { value: new THREE.Vector3(0.2, 0.35, 0.4).normalize() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = "StormWater";
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  return {
    mesh,
    material,
    update(t, storm) {
      material.uniforms.uTime.value = t;
      material.uniforms.uStorm.value = THREE.MathUtils.clamp(storm, 0, 1);
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}

/** Enhance loaded ship materials toward wet wood / canvas realism. */
export function enhanceShipMaterials(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const next: THREE.Material[] = [];
    for (const mat of mats) {
      if (!mat) continue;
      if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const s = (mat as THREE.MeshStandardMaterial).clone();
        if (s.map) {
          s.map.colorSpace = THREE.SRGBColorSpace;
          s.map.anisotropy = 8;
        }
        if (s.normalMap) s.normalMap.anisotropy = 8;
        // Wet storm look
        s.roughness = Math.min(Math.max(s.roughness ?? 0.7, 0.35), 0.72);
        s.metalness = Math.min(s.metalness ?? 0.05, 0.2);
        s.envMapIntensity = 0.85;
        // Slight blue-grey grade for storm lighting
        if (!s.map) s.color.offsetHSL(0.02, -0.08, -0.04);
        else s.color.multiplyScalar(0.92);
        s.needsUpdate = true;
        next.push(s);
      } else {
        next.push(mat);
      }
    }
    m.material = next.length === 1 ? next[0]! : next;
  });
}

/** Stingray / beast materials — wet organic + emissive belly. */
export function enhanceBeastMaterials(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const next: THREE.Material[] = [];
    for (const mat of mats) {
      if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const s = (mat as THREE.MeshStandardMaterial).clone();
        if (s.map) s.map.colorSpace = THREE.SRGBColorSpace;
        s.roughness = 0.42;
        s.metalness = 0.08;
        s.emissive = new THREE.Color(0x102030);
        s.emissiveIntensity = 0.15;
        s.needsUpdate = true;
        next.push(s);
      } else next.push(mat);
    }
    m.material = next.length === 1 ? next[0]! : next;
  });
}
