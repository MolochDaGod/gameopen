/**
 * Agama Survival environment SSOT — SI scale, terrain layers, water, colliders.
 *
 * Hard rules (grudge-world-scale):
 *  - 1 unit = 1 m after calibration
 *  - 1.8 m human is the yardstick
 *  - Classic 100× (cm) fixed unclamped
 *  - Never fit characters to map; fit map to metres
 */
import * as THREE from "three";
import { PLAYER_HEIGHT_M } from "../../lib/productionRuntime";

export type MapScaleResult = {
  unitScale: number;
  half: number;
  spanX: number;
  spanZ: number;
  height: number;
  waterY: number | null;
  terrainMeshes: THREE.Mesh[];
  waterMeshes: THREE.Mesh[];
  propMeshes: THREE.Mesh[];
};

const WATER_NAME_RE = /water|ocean|sea|lake|river|pond|pool|flood|wave/i;
const TERRAIN_NAME_RE =
  /terrain|ground|floor|road|path|dirt|grass|rock|cliff|hill|land|island|sand|mud|field|farm|street/i;

/**
 * Robust world AABB from individual meshes, discarding quantization junk
 * (Sketchfab often embeds ±32767 sentinel accessors).
 */
export function measureMapRobust(root: THREE.Object3D): {
  box: THREE.Box3;
  maxXZ: number;
  height: number;
  meshCount: number;
} {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let any = false;
  let meshCount = 0;
  const tmp = new THREE.Box3();
  const size = new THREE.Vector3();

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    meshCount++;
    tmp.setFromObject(m);
    if (tmp.isEmpty()) return;
    tmp.getSize(size);
    const span = Math.max(size.x, size.y, size.z);
    // Discard broken / quantized extents
    if (!(span > 1e-4) || span > 2e4) return;
    if (
      Math.abs(tmp.min.x) > 2e4 ||
      Math.abs(tmp.max.x) > 2e4 ||
      Math.abs(tmp.min.z) > 2e4 ||
      Math.abs(tmp.max.z) > 2e4
    ) {
      return;
    }
    if (!any) {
      box.copy(tmp);
      any = true;
    } else {
      box.union(tmp);
    }
  });

  if (!any) {
    box.setFromObject(root);
  }
  const s = box.getSize(new THREE.Vector3());
  return {
    box,
    maxXZ: Math.max(s.x, s.z) || 1,
    height: s.y || 1,
    meshCount,
  };
}

function isSketchfabRoot(root: THREE.Object3D): boolean {
  let hit = false;
  root.traverse((o) => {
    if (hit) return;
    if (/sketchfab/i.test(o.name)) hit = true;
  });
  return hit;
}

/**
 * Scale map into SI metres relative to a 1.8 m human.
 * Prefer enlarging tiny maps (100× character bug) over crushing real props.
 */
export function scaleMapToSi(
  root: THREE.Object3D,
  opts?: { targetSpanM?: number; mapKey?: string },
): MapScaleResult {
  const playerH = PLAYER_HEIGHT_M;
  const TARGET_SPAN = opts?.targetSpanM ?? 110;
  const MIN_SPAN = 40;

  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.updateMatrixWorld(true);

  let { maxXZ, height } = measureMapRobust(root);
  let unitScale = 1;

  // Sketchfab / cm packs: force cm→m when span is absurd or root hints cm
  const sketchfab = isSketchfabRoot(root);
  if (sketchfab || maxXZ > 400 || height > 80) {
    unitScale = 0.01;
  } else if (maxXZ < 0.8 && height < 0.8) {
    // Map authored as metres-as-cm (tiny) → blow up
    unitScale = 100;
  } else if (maxXZ < 3 && height < 3) {
    // Borderline tiny island vs 1.8 m human → 10× or 100×
    unitScale = maxXZ < 1.2 ? 100 : 10;
  }

  if (unitScale !== 1) {
    root.scale.setScalar(unitScale);
    root.updateMatrixWorld(true);
    ({ maxXZ, height } = measureMapRobust(root));
  }

  // Playable footprint vs human
  let playScale = 1;
  if (maxXZ > TARGET_SPAN * 1.5) {
    playScale = TARGET_SPAN / maxXZ;
  } else if (maxXZ < MIN_SPAN) {
    playScale = MIN_SPAN / Math.max(maxXZ, 0.01);
  }
  // Agama survival: prefer roomy combat ring even if unit fix was partial
  if (opts?.mapKey?.includes("agama") && maxXZ * playScale < 70) {
    playScale = Math.max(playScale, 80 / Math.max(maxXZ, 0.01));
  }

  if (Math.abs(playScale - 1) > 0.02) {
    root.scale.multiplyScalar(playScale);
    unitScale *= playScale;
    root.updateMatrixWorld(true);
  }

  // Center XZ, ground min.y = 0
  const measured = measureMapRobust(root);
  const c = measured.box.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= measured.box.min.y;
  root.updateMatrixWorld(true);

  const final = measureMapRobust(root);
  const finalSize = final.box.getSize(new THREE.Vector3());
  const half = Math.max(finalSize.x, finalSize.z) * 0.5;

  const classified = classifyMeshes(root);
  const waterY = classified.waterMeshes.length
    ? estimateWaterY(classified.waterMeshes)
    : estimateLowPlaneY(classified.terrainMeshes);

  console.info(
    "[survivalEnvironment] SI scale unit=",
    unitScale.toFixed(5),
    "span=",
    finalSize.x.toFixed(1),
    "×",
    finalSize.z.toFixed(1),
    "h=",
    finalSize.y.toFixed(1),
    "m  waterY=",
    waterY?.toFixed(2) ?? "n/a",
    "meshes=",
    final.meshCount,
    "terrain=",
    classified.terrainMeshes.length,
    "water=",
    classified.waterMeshes.length,
  );

  return {
    unitScale,
    half,
    spanX: finalSize.x,
    spanZ: finalSize.z,
    height: finalSize.y,
    waterY,
    ...classified,
  };
}

function classifyMeshes(root: THREE.Object3D): {
  terrainMeshes: THREE.Mesh[];
  waterMeshes: THREE.Mesh[];
  propMeshes: THREE.Mesh[];
} {
  const terrainMeshes: THREE.Mesh[] = [];
  const waterMeshes: THREE.Mesh[] = [];
  const propMeshes: THREE.Mesh[] = [];

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = m.name || "";
    const matName = materialNames(m);
    const blob = `${name} ${matName}`;

    if (WATER_NAME_RE.test(blob) || looksLikeWaterMaterial(m)) {
      waterMeshes.push(m);
      m.userData.physicsLayer = "water";
      m.userData.terrainLayer = "water";
      return;
    }
    if (TERRAIN_NAME_RE.test(blob) || isLargeHorizontal(m)) {
      terrainMeshes.push(m);
      m.userData.physicsLayer = "terrain";
      m.userData.terrainLayer = "surface";
      return;
    }
    propMeshes.push(m);
    m.userData.physicsLayer = "prop";
    m.userData.terrainLayer = "prop";
  });

  // Ensure we always have terrain candidates (largest meshes by XZ)
  if (!terrainMeshes.length) {
    const ranked = rankMeshesByFootprint(root);
    for (const m of ranked.slice(0, 12)) {
      m.userData.physicsLayer = "terrain";
      m.userData.terrainLayer = "surface";
      terrainMeshes.push(m);
    }
  }

  return { terrainMeshes, waterMeshes, propMeshes };
}

function materialNames(m: THREE.Mesh): string {
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  return mats
    .map((x) => (x as THREE.Material)?.name || "")
    .join(" ");
}

function looksLikeWaterMaterial(m: THREE.Mesh): boolean {
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  for (const raw of mats) {
    const mat = raw as THREE.MeshStandardMaterial;
    if (!mat || !mat.color) continue;
    const c = mat.color;
    // Blue-green liquid heuristic
    if (c.b > 0.35 && c.b > c.r * 1.15 && c.g > c.r * 0.8) {
      if (mat.transparent || mat.opacity < 0.95 || mat.metalness > 0.4) return true;
    }
    const trans = (mat as THREE.MeshStandardMaterial & { transmission?: number }).transmission;
    if (typeof trans === "number" && trans > 0.2) return true;
  }
  return false;
}

function isLargeHorizontal(m: THREE.Mesh): boolean {
  const b = new THREE.Box3().setFromObject(m);
  const s = b.getSize(new THREE.Vector3());
  const xz = Math.max(s.x, s.z);
  return xz > 8 && s.y < xz * 0.35;
}

function rankMeshesByFootprint(root: THREE.Object3D): THREE.Mesh[] {
  const list: { m: THREE.Mesh; area: number }[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const b = new THREE.Box3().setFromObject(m);
    const s = b.getSize(new THREE.Vector3());
    const area = s.x * s.z;
    if (area > 4 && s.x < 2e4 && s.z < 2e4) list.push({ m, area });
  });
  list.sort((a, b) => b.area - a.area);
  return list.map((x) => x.m);
}

function estimateWaterY(meshes: THREE.Mesh[]): number | null {
  let sum = 0;
  let n = 0;
  for (const m of meshes) {
    const b = new THREE.Box3().setFromObject(m);
    sum += (b.min.y + b.max.y) * 0.5;
    n++;
  }
  return n ? sum / n : null;
}

function estimateLowPlaneY(meshes: THREE.Mesh[]): number | null {
  if (!meshes.length) return null;
  let minY = Infinity;
  for (const m of meshes.slice(0, 20)) {
    const b = new THREE.Box3().setFromObject(m);
    if (b.min.y < minY) minY = b.min.y;
  }
  return Number.isFinite(minY) ? minY + 0.15 : null;
}

/**
 * Raycast height sampler against terrain meshes (L0 feet SSOT).
 */
export function createTerrainHeightSampler(
  terrainMeshes: THREE.Mesh[],
): (x: number, z: number) => number | null {
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3(0, -1, 0);
  const targets = terrainMeshes.filter((m) => m.visible);

  return (x: number, z: number) => {
    origin.set(x, 400, z);
    raycaster.set(origin, dir);
    raycaster.far = 800;
    const hits = raycaster.intersectObjects(targets, false);
    if (!hits.length) return null;
    return hits[0]!.point.y;
  };
}

/**
 * Stylized water plane (production Water layer):
 *  - dual scroll albedo + normal maps
 *  - foam edge plane
 *  - volume body under surface
 *  - cheap GPU-ish vertex waves (normals every few frames)
 * Parent under scene; call update(dt) each frame.
 */
export class SurvivalWaterLayer {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;
  private foamMat: THREE.MeshStandardMaterial | null = null;
  private colorTex: THREE.CanvasTexture;
  private normalTex: THREE.CanvasTexture;
  private t = 0;
  private waveAcc = 0;
  waterY: number;

  constructor(halfExtent: number, waterY: number) {
    this.waterY = waterY;
    this.group.name = "survival_water_layer";
    const size = halfExtent * 2.4;
    // 32×32 is enough for readable waves without thrashing normals every frame
    const geo = new THREE.PlaneGeometry(size, size, 32, 32);

    this.colorTex = makeWaterColorTexture();
    this.normalTex = makeWaterNormalTexture();

    this.mat = new THREE.MeshStandardMaterial({
      color: 0x1c7a9c,
      metalness: 0.62,
      roughness: 0.18,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.35,
      map: this.colorTex,
      normalMap: this.normalTex,
      normalScale: new THREE.Vector2(0.85, 0.85),
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = waterY;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    this.mesh.userData.physicsLayer = "water";
    this.mesh.userData.terrainLayer = "water";
    this.group.add(this.mesh);

    // Foam / sparkle sheet slightly above surface
    this.foamMat = new THREE.MeshStandardMaterial({
      color: 0xc8f0ff,
      metalness: 0.1,
      roughness: 0.35,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      map: makeFoamTexture(),
      emissive: new THREE.Color(0x1a4060),
      emissiveIntensity: 0.15,
    });
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = waterY + 0.04;
    foam.renderOrder = 2;
    foam.userData.physicsLayer = "water";
    this.group.add(foam);

    // Deeper body under the surface for volume read
    const deep = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({
        color: 0x061828,
        roughness: 0.95,
        metalness: 0.05,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      }),
    );
    deep.rotation.x = -Math.PI / 2;
    deep.position.y = waterY - 0.55;
    this.group.add(deep);
  }

  update(dt: number): void {
    this.t += dt;
    this.waveAcc += dt;

    // Dual scroll — color + normal drift at different rates
    this.colorTex.offset.x = this.t * 0.028;
    this.colorTex.offset.y = this.t * 0.018;
    this.normalTex.offset.x = -this.t * 0.035;
    this.normalTex.offset.y = this.t * 0.022;
    if (this.foamMat?.map) {
      this.foamMat.map.offset.x = this.t * 0.015;
      this.foamMat.map.offset.y = -this.t * 0.012;
      this.foamMat.opacity = 0.16 + Math.sin(this.t * 0.7) * 0.06;
    }

    // Vertex waves ~15 Hz (skip most frames for perf)
    if (this.waveAcc < 1 / 15) return;
    this.waveAcc = 0;
    const pos = this.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    if (!pos) return;
    const t = this.t;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // PlaneGeometry is XY before rot
      const z =
        Math.sin(x * 0.12 + t * 1.35) * 0.07 +
        Math.cos(y * 0.1 + t * 1.05) * 0.055 +
        Math.sin((x + y) * 0.08 + t * 0.9) * 0.03;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        std.map?.dispose();
        std.normalMap?.dispose();
        std.dispose?.();
      }
    });
    this.colorTex.dispose();
    this.normalTex.dispose();
  }
}

/** Albedo: deep teal → cyan bands with soft caustic blotches. */
function makeWaterColorTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 512, 512);
  grd.addColorStop(0, "#063a52");
  grd.addColorStop(0.35, "#0e6a88");
  grd.addColorStop(0.55, "#1a90b0");
  grd.addColorStop(0.8, "#0c5470");
  grd.addColorStop(1, "#042838");
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);

  // Soft caustic rings
  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * 512;
    const cy = Math.random() * 512;
    const r = 12 + Math.random() * 48;
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, "rgba(160,230,255,0.22)");
    rg.addColorStop(0.45, "rgba(80,180,210,0.08)");
    rg.addColorStop(1, "rgba(0,40,60,0)");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }

  // Horizontal swell strokes
  g.strokeStyle = "rgba(190,240,255,0.18)";
  g.lineWidth = 2.5;
  for (let i = 0; i < 28; i++) {
    g.beginPath();
    const y0 = 8 + i * 18;
    g.moveTo(0, y0);
    for (let x = 0; x <= 512; x += 6) {
      g.lineTo(x, y0 + Math.sin(x * 0.05 + i * 0.7) * 5 + Math.cos(x * 0.02) * 2);
    }
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Procedural normal map (blue-purple base = flat normal).
 * Enough detail for sun glints without real assets.
 */
function makeWaterNormalTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  // Flat normal (0.5, 0.5, 1) ≈ #8080ff
  g.fillStyle = "#8080ff";
  g.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 256;
    const amp = 1.5 + Math.random() * 3;
    g.strokeStyle = `rgba(${100 + Math.random() * 40},${100 + Math.random() * 40},255,0.55)`;
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 4) {
      g.lineTo(x, y + Math.sin(x * 0.09 + i) * amp);
    }
    g.stroke();
  }
  // Cross ripples
  for (let i = 0; i < 40; i++) {
    const x0 = Math.random() * 256;
    g.strokeStyle = "rgba(140,130,255,0.4)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0, 0);
    for (let y = 0; y <= 256; y += 4) {
      g.lineTo(x0 + Math.sin(y * 0.08 + i) * 3, y);
    }
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeFoamTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = "rgba(0,0,0,0)";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 1 + Math.random() * 4;
    g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.45})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Soft foam bands
  g.strokeStyle = "rgba(255,255,255,0.2)";
  g.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    g.beginPath();
    const y = 20 + i * 24;
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 8) {
      g.lineTo(x, y + Math.sin(x * 0.1 + i) * 6);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Extract world-space verts/indices from a mesh for Rapier trimesh.
 * Caps triangle count for perf.
 */
export function meshToWorldTrimesh(
  mesh: THREE.Mesh,
  maxTris = 12000,
): { verts: Float32Array; indices: Uint32Array } | null {
  mesh.updateWorldMatrix(true, false);
  let geo = mesh.geometry;
  if (!geo) return null;
  if (geo.index) geo = geo.toNonIndexed();
  const pos = geo.getAttribute("position");
  if (!pos || pos.count < 3) return null;

  const step = Math.max(1, Math.ceil(pos.count / 3 / maxTris));
  const triCount = Math.floor(pos.count / 3 / step);
  if (triCount < 1) return null;

  const verts = new Float32Array(triCount * 9);
  const indices = new Uint32Array(triCount * 3);
  const v = new THREE.Vector3();
  let vi = 0;
  let ii = 0;
  for (let t = 0; t < triCount; t++) {
    const base = t * step * 3;
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, base + k).applyMatrix4(mesh.matrixWorld);
      verts[vi++] = v.x;
      verts[vi++] = v.y;
      verts[vi++] = v.z;
      indices[ii] = ii;
      ii++;
    }
  }
  return { verts, indices };
}
