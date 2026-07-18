/**
 * Spline-based VFX for Open (zones hub, combat accents).
 *
 * Uses three.js built-ins:
 *  - CatmullRomCurve3 + TubeGeometry (ribbon / data stream)
 *  - Points along curve (spark trail)
 *  - Optional orbiting GLB (“Another shape of data”)
 *
 * Pair with graphMath for sampling / easing. PostFX: postfx.createMysticalComposer.
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import {
  circleGraphNodes,
  pulse,
  type Vec3,
} from "./graphMath";

export const DATA_SHAPE_R2_KEY = "models/vfx/another_shape_of_data.glb";

export interface SplineVfxHandle {
  group: THREE.Group;
  update: (dt: number) => void;
  dispose: () => void;
  /** Live curve for external samplers. */
  curve: THREE.CatmullRomCurve3;
}

function toThree(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z);
}

/** Build a glowing tube ribbon along control points. */
export function createSplineRibbon(
  points: Vec3[],
  opts?: {
    tubularSegments?: number;
    radius?: number;
    radialSegments?: number;
    color?: number;
    closed?: boolean;
  },
): { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; geo: THREE.TubeGeometry } {
  const closed = opts?.closed !== false;
  const curve = new THREE.CatmullRomCurve3(
    points.map(toThree),
    closed,
    "catmullrom",
    0.35,
  );
  const geo = new THREE.TubeGeometry(
    curve,
    opts?.tubularSegments ?? 96,
    opts?.radius ?? 0.045,
    opts?.radialSegments ?? 6,
    closed,
  );
  const mat = new THREE.MeshStandardMaterial({
    color: opts?.color ?? 0x5fe0ff,
    emissive: opts?.color ?? 0x3aa8ff,
    emissiveIntensity: 1.4,
    metalness: 0.2,
    roughness: 0.25,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "splineRibbon";
  return { mesh, curve, geo };
}

/** Spark points sliding on a curve. */
export function createSplineSparks(
  curve: THREE.CatmullRomCurve3,
  count = 48,
  color = 0xaef5ff,
): {
  points: THREE.Points;
  update: (t: number) => void;
  dispose: () => void;
} {
  const pos = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 0.12,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.name = "splineSparks";
  const phases = Array.from({ length: count }, () => Math.random());

  const scratch = new THREE.Vector3();
  const update = (time: number) => {
    const arr = geo.attributes.position!.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const u = (phases[i]! + time * (0.08 + (i % 5) * 0.01)) % 1;
      curve.getPointAt(u, scratch);
      arr[i * 3] = scratch.x;
      arr[i * 3 + 1] = scratch.y;
      arr[i * 3 + 2] = scratch.z;
    }
    geo.attributes.position!.needsUpdate = true;
  };

  return {
    points,
    update,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

/**
 * Full stage: ribbon graph + sparks + optional data-shape GLB orbiting center.
 * Designed for GRUDOX zones hub / presentation backdrop.
 */
export async function createDataShapeSplineStage(opts?: {
  nodeCount?: number;
  radius?: number;
  loadShape?: boolean;
}): Promise<SplineVfxHandle> {
  const group = new THREE.Group();
  group.name = "dataShapeSplineStage";
  const n = opts?.nodeCount ?? 10;
  const R = opts?.radius ?? 3.2;
  const nodes = circleGraphNodes(n, R, 0.4);
  // Slight vertical wave for 3D graph feel
  for (let i = 0; i < nodes.length; i++) {
    nodes[i]!.y = 0.25 + 0.35 * Math.sin((i / n) * Math.PI * 2);
  }

  const { mesh: ribbon, curve, geo: tubeGeo } = createSplineRibbon(nodes, {
    color: 0x5fe0ff,
    radius: 0.04,
    closed: true,
  });
  group.add(ribbon);

  // Inner chord ribbons (graph edges to center pulse)
  const hub = { x: 0, y: 0.6, z: 0 };
  for (let i = 0; i < n; i += 2) {
    const a = nodes[i]!;
    const mid = {
      x: (a.x + hub.x) * 0.5,
      y: (a.y + hub.y) * 0.5 + 0.4,
      z: (a.z + hub.z) * 0.5,
    };
    const { mesh } = createSplineRibbon([a, mid, hub], {
      closed: false,
      tubularSegments: 32,
      radius: 0.018,
      color: 0xb98cff,
    });
    mesh.material = new THREE.MeshStandardMaterial({
      color: 0xb98cff,
      emissive: 0x6a40c0,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.55,
      roughness: 0.3,
    });
    group.add(mesh);
  }

  const sparks = createSplineSparks(curve, 56, 0xd4f7ff);
  group.add(sparks.points);

  // Node markers
  const nodeGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const nodeMat = new THREE.MeshStandardMaterial({
    color: 0xffd24d,
    emissive: 0xaa8800,
    emissiveIntensity: 0.9,
  });
  for (const p of nodes) {
    const s = new THREE.Mesh(nodeGeo, nodeMat);
    s.position.set(p.x, p.y, p.z);
    group.add(s);
  }

  let shape: THREE.Object3D | null = null;
  if (opts?.loadShape !== false) {
    try {
      const { scene } = await loadGltfFirst(
        [DATA_SHAPE_R2_KEY, "models/vfx/another_shape_of_data.glb"],
        sharedGltfLoader(),
        { prepMaterials: true },
      );
      const wrap = new THREE.Group();
      wrap.add(scene);
      wrap.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(wrap);
      const size = new THREE.Vector3();
      box.getSize(size);
      const target = 1.35;
      const s = target / Math.max(size.x, size.y, size.z, 0.01);
      wrap.scale.setScalar(s);
      wrap.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(wrap);
      const c = box2.getCenter(new THREE.Vector3());
      wrap.position.sub(c);
      wrap.position.y += 0.55;
      shape = wrap;
      shape.name = "anotherShapeOfData";
      group.add(shape);
    } catch (err) {
      console.warn("[splineVfx] data shape GLB missing — ribbon only", err);
    }
  }

  let t = 0;
  const ribbonMat = ribbon.material as THREE.MeshStandardMaterial;

  return {
    group,
    curve,
    update(dt: number) {
      t += dt;
      sparks.update(t * 0.15);
      ribbonMat.emissiveIntensity = 1.0 + pulse(t, 0.4) * 0.8;
      if (shape) {
        shape.rotation.y = t * 0.35;
        shape.rotation.x = Math.sin(t * 0.5) * 0.12;
        shape.position.y = 0.55 + Math.sin(t * 0.9) * 0.08;
      }
      group.rotation.y = t * 0.08;
    },
    dispose() {
      tubeGeo.dispose();
      (ribbon.material as THREE.Material).dispose();
      sparks.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry && m.geometry !== tubeGeo && m.geometry !== nodeGeo) {
          // leave shared; cloned glb disposed lightly
        }
      });
      group.removeFromParent();
    },
  };
}
