/**
 * Clean-split fireball.glb demo scene → 4 centered staff orbs (SI ~0.45 m).
 *
 * fireball.glb is a Sketchfab multi-ball lineup along +Z — NEVER a projectile.
 *
 * Usage: node scripts/split-fireball-orbs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "client/public/models/vfx/fireball.glb");
const OUT_DIRS = [
  path.join(ROOT, "client/public/models/vfx/orbs"),
  path.join(ROOT, "artifacts/animator/public/models/vfx/orbs"),
];

const TARGET_DIAMETER_M = 0.45;

/**
 * Explicit Sketchfab cluster roots (inspected from fireball.glb hierarchy).
 * Each entry is a parent Sphere or Circle node that owns one mesh leaf.
 * Shared z≈0 shell duplicates (Sphere.004/006/009/011/013/015) are excluded
 * so each orb is one ball, not four stacked shells.
 */
const CLUSTER_DEFS = [
  {
    id: "orb-fire",
    label: "Fire Orb",
    element: "fire",
    roots: ["Sphere_1", "Sphere.001_2", "Sphere.002_3", "Sphere.003_4", "Circle.001_5"],
    staffUse: { projectileScale: 1, tipScale: 0.55, chargeScale: 0.8 },
  },
  {
    id: "orb-ember",
    label: "Ember Orb",
    element: "storm",
    roots: ["Sphere.005_9", "Sphere.007_11", "Circle.002_12", "Sphere.008_13", "Sphere.021_31"],
    staffUse: { projectileScale: 1, tipScale: 0.55, chargeScale: 0.8 },
  },
  {
    id: "orb-core",
    label: "Arcane Core Orb",
    element: "arcane",
    roots: ["Sphere.010_16", "Sphere.012_18", "Circle.003_19", "Sphere.018_27", "Sphere.019_28"],
    staffUse: { projectileScale: 1, tipScale: 0.55, chargeScale: 0.8 },
  },
  {
    id: "orb-flare",
    label: "Flare Orb",
    element: "holy",
    roots: ["Sphere.014_22", "Sphere.016_24", "Circle.004_25", "Sphere.017_26", "Sphere.020_29"],
    staffUse: { projectileScale: 1, tipScale: 0.55, chargeScale: 0.8 },
  },
];

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("utf8", 0, 4) !== "glTF") throw new Error("not glb: " + file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  let off = 20 + jsonLen;
  while (off % 4 !== 0) off++;
  let bin = Buffer.alloc(0);
  if (off + 8 <= buf.length) {
    const chunkLen = buf.readUInt32LE(off);
    bin = buf.slice(off + 8, off + 8 + chunkLen);
  }
  return { json, bin };
}

function writeGlb(json, bin) {
  let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  if (jsonPad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
  let binBuf = bin || Buffer.alloc(0);
  const binPad = (4 - (binBuf.length % 4)) % 4;
  if (binPad) binBuf = Buffer.concat([binBuf, Buffer.alloc(binPad, 0)]);

  const totalLen = 12 + 8 + jsonBuf.length + (binBuf.length ? 8 + binBuf.length : 0);
  const out = Buffer.alloc(totalLen);
  out.write("glTF", 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLen, 8);
  out.writeUInt32LE(jsonBuf.length, 12);
  out.write("JSON", 16);
  jsonBuf.copy(out, 20);
  if (binBuf.length) {
    const bo = 20 + jsonBuf.length;
    out.writeUInt32LE(binBuf.length, bo);
    out.write("BIN\0", bo + 4);
    binBuf.copy(out, bo + 8);
  }
  return out;
}

function mat4Compose(t = [0, 0, 0], r = null, s = [1, 1, 1]) {
  const [tx, ty, tz] = t;
  const [sx, sy, sz] = s;
  let x = 0,
    y = 0,
    z = 0,
    w = 1;
  if (r && r.length === 4) {
    x = r[0];
    y = r[1];
    z = r[2];
    w = r[3];
  }
  const x2 = x + x,
    y2 = y + y,
    z2 = z + z;
  const xx = x * x2,
    xy = x * y2,
    xz = x * z2;
  const yy = y * y2,
    yz = y * z2,
    zz = z * z2;
  const wx = w * x2,
    wy = w * y2,
    wz = w * z2;
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

function mat4Mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

function mat4TransformPoint(m, p) {
  const x = p[0],
    y = p[1],
    z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

function nodeLocalMatrix(n) {
  if (n.matrix && n.matrix.length === 16) return n.matrix.slice();
  return mat4Compose(n.translation, n.rotation, n.scale);
}

function computeWorldMatrices(nodes) {
  const world = new Array(nodes.length);
  const childOf = new Map();
  nodes.forEach((n, i) => {
    for (const c of n.children || []) childOf.set(c, i);
  });
  function worldOf(i) {
    if (world[i]) return world[i];
    const local = nodeLocalMatrix(nodes[i] || {});
    const p = childOf.get(i);
    world[i] = p === undefined ? local : mat4Mul(worldOf(p), local);
    return world[i];
  }
  for (let i = 0; i < nodes.length; i++) worldOf(i);
  return world;
}

function collectSubtree(nodes, rootIdx, out = new Set()) {
  if (out.has(rootIdx)) return out;
  out.add(rootIdx);
  for (const c of nodes[rootIdx].children || []) collectSubtree(nodes, c, out);
  return out;
}

function accessorBounds(json, accessorIndex) {
  const acc = json.accessors[accessorIndex];
  if (!acc?.min || !acc?.max) return null;
  return { min: acc.min.slice(0, 3), max: acc.max.slice(0, 3) };
}

function transformBounds(min, max, world) {
  const outMin = [Infinity, Infinity, Infinity];
  const outMax = [-Infinity, -Infinity, -Infinity];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]]) {
        const p = mat4TransformPoint(world, [x, y, z]);
        for (let k = 0; k < 3; k++) {
          outMin[k] = Math.min(outMin[k], p[k]);
          outMax[k] = Math.max(outMax[k], p[k]);
        }
      }
  return { min: outMin, max: outMax };
}

/** Copy only used bufferViews into a compact bin. */
function compactBin(srcJson, srcBin, usedViewIndices) {
  const sorted = [...usedViewIndices].sort((a, b) => a - b);
  const chunks = [];
  const viewMap = new Map();
  let cursor = 0;
  const newViews = [];
  for (const vi of sorted) {
    const bv = srcJson.bufferViews[vi];
    const offset = bv.byteOffset || 0;
    const length = bv.byteLength;
    // align 4
    const pad = (4 - (cursor % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad, 0));
      cursor += pad;
    }
    chunks.push(srcBin.slice(offset, offset + length));
    viewMap.set(vi, newViews.length);
    newViews.push({
      buffer: 0,
      byteOffset: cursor,
      byteLength: length,
      ...(bv.byteStride !== undefined ? { byteStride: bv.byteStride } : {}),
      ...(bv.target !== undefined ? { target: bv.target } : {}),
    });
    cursor += length;
  }
  return { bin: Buffer.concat(chunks.length ? chunks : [Buffer.alloc(0)]), newViews, viewMap };
}

function extractCluster(srcJson, srcBin, nodeIndices, world, clusterId) {
  const nodes = srcJson.nodes;
  const meshNodes = [...nodeIndices].filter((i) => nodes[i].mesh !== undefined);
  if (!meshNodes.length) throw new Error(`cluster ${clusterId}: no mesh nodes`);

  let gMin = [Infinity, Infinity, Infinity];
  let gMax = [-Infinity, -Infinity, -Infinity];
  for (const i of meshNodes) {
    const mesh = srcJson.meshes[nodes[i].mesh];
    for (const prim of mesh.primitives || []) {
      const pos = prim.attributes?.POSITION;
      if (pos === undefined) continue;
      const b = accessorBounds(srcJson, pos);
      if (!b) continue;
      const wb = transformBounds(b.min, b.max, world[i]);
      for (let k = 0; k < 3; k++) {
        gMin[k] = Math.min(gMin[k], wb.min[k]);
        gMax[k] = Math.max(gMax[k], wb.max[k]);
      }
    }
  }
  if (!Number.isFinite(gMin[0])) throw new Error(`cluster ${clusterId}: no bounds`);

  const center = [
    (gMin[0] + gMax[0]) / 2,
    (gMin[1] + gMax[1]) / 2,
    (gMin[2] + gMax[2]) / 2,
  ];
  const size = [gMax[0] - gMin[0], gMax[1] - gMin[1], gMax[2] - gMin[2]];
  const maxDim = Math.max(...size);
  const scale = maxDim > 1e-6 ? TARGET_DIAMETER_M / maxDim : 1;

  const usedMeshes = new Map();
  const usedMats = new Map();
  const usedAccessors = new Set();
  const usedViews = new Set();

  for (const i of meshNodes) {
    const mi = nodes[i].mesh;
    if (!usedMeshes.has(mi)) usedMeshes.set(mi, usedMeshes.size);
    const mesh = srcJson.meshes[mi];
    for (const prim of mesh.primitives || []) {
      if (prim.material !== undefined && !usedMats.has(prim.material)) {
        usedMats.set(prim.material, usedMats.size);
      }
      for (const key of Object.keys(prim.attributes || {})) {
        usedAccessors.add(prim.attributes[key]);
      }
      if (prim.indices !== undefined) usedAccessors.add(prim.indices);
    }
  }
  for (const ai of usedAccessors) {
    const acc = srcJson.accessors[ai];
    if (acc?.bufferView !== undefined) usedViews.add(acc.bufferView);
  }

  const { bin: compact, newViews, viewMap } = compactBin(srcJson, srcBin, usedViews);

  const accList = [...usedAccessors].sort((a, b) => a - b);
  const accMap = new Map(accList.map((a, i) => [a, i]));
  const meshList = [...usedMeshes.keys()];
  const meshMap = new Map(meshList.map((m, i) => [m, i]));
  const matList = [...usedMats.keys()];
  const matMap = new Map(matList.map((m, i) => [m, i]));

  const newAccessors = accList.map((ai) => {
    const a = { ...srcJson.accessors[ai] };
    if (a.bufferView !== undefined) a.bufferView = viewMap.get(a.bufferView);
    return a;
  });
  const newMeshes = meshList.map((mi) => {
    const mesh = JSON.parse(JSON.stringify(srcJson.meshes[mi]));
    for (const prim of mesh.primitives || []) {
      if (prim.material !== undefined) prim.material = matMap.get(prim.material);
      if (prim.indices !== undefined) prim.indices = accMap.get(prim.indices);
      for (const key of Object.keys(prim.attributes || {})) {
        prim.attributes[key] = accMap.get(prim.attributes[key]);
      }
    }
    return mesh;
  });
  const newMaterials = matList.map((mi) =>
    JSON.parse(JSON.stringify(srcJson.materials[mi])),
  );

  const newNodes = [
    {
      name: clusterId,
      children: meshNodes.map((_, idx) => idx + 1),
      scale: [scale, scale, scale],
    },
  ];
  for (const i of meshNodes) {
    const w = world[i];
    newNodes.push({
      name: nodes[i].name || `part_${i}`,
      mesh: meshMap.get(nodes[i].mesh),
      translation: [w[12] - center[0], w[13] - center[1], w[14] - center[2]],
      ...(nodes[i].rotation ? { rotation: nodes[i].rotation.slice() } : {}),
    });
  }

  const outJson = {
    asset: { version: "2.0", generator: "split-fireball-orbs" },
    scene: 0,
    scenes: [{ name: clusterId, nodes: [0] }],
    nodes: newNodes,
    meshes: newMeshes,
    materials: newMaterials,
    accessors: newAccessors,
    bufferViews: newViews,
    buffers: [{ byteLength: compact.length }],
  };

  return {
    json: outJson,
    bin: compact,
    meta: {
      id: clusterId,
      meshNodes: meshNodes.map((i) => nodes[i].name),
      meshCount: meshNodes.length,
      sourceAabb: { min: gMin, max: gMax, size, maxDim },
      center,
      scale,
      targetDiameterM: TARGET_DIAMETER_M,
      binBytes: compact.length,
    },
  };
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Missing source", SRC);
    process.exit(1);
  }
  const { json, bin } = readGlb(SRC);
  const nodes = json.nodes || [];
  const world = computeWorldMatrices(nodes);
  const byName = new Map(nodes.map((n, i) => [n.name, i]));

  console.log("Source nodes:", nodes.length, "meshes:", (json.meshes || []).length);

  const manifest = {
    source: "models/vfx/fireball.glb",
    note: "NEVER use whole fireball.glb as staff projectile — use these orbs",
    generatedAt: new Date().toISOString(),
    targetDiameterM: TARGET_DIAMETER_M,
    method: "explicit cluster roots + center + SI scale on root + compact bin",
    orbs: [],
  };

  for (const outDir of OUT_DIRS) fs.mkdirSync(outDir, { recursive: true });

  for (const def of CLUSTER_DEFS) {
    const set = new Set();
    const found = [];
    for (const name of def.roots) {
      const idx = byName.get(name);
      if (idx === undefined) {
        console.warn(`  missing root ${name} for ${def.id}`);
        continue;
      }
      found.push(name);
      collectSubtree(nodes, idx, set);
    }
    console.log(`${def.id}: roots ${found.join(", ")} → ${set.size} nodes`);

    const { json: outJson, bin: outBin, meta } = extractCluster(
      json,
      bin,
      set,
      world,
      def.id,
    );
    const glb = writeGlb(outJson, outBin);

    for (const outDir of OUT_DIRS) {
      const dest = path.join(outDir, `${def.id}.glb`);
      fs.writeFileSync(dest, glb);
      console.log(
        "  wrote",
        path.relative(ROOT, dest),
        glb.length,
        "B meshes=",
        meta.meshCount,
        "scale=",
        meta.scale.toFixed(5),
      );
    }

    manifest.orbs.push({
      id: def.id,
      label: def.label,
      element: def.element,
      file: `models/vfx/orbs/${def.id}.glb`,
      nodeCount: meta.meshCount,
      nodes: meta.meshNodes,
      bytes: glb.length,
      targetDiameterM: TARGET_DIAMETER_M,
      sourceMaxDim: +meta.sourceAabb.maxDim.toFixed(3),
      bakedScale: +meta.scale.toFixed(6),
      staffUse: def.staffUse,
    });
  }

  for (const outDir of OUT_DIRS) {
    fs.writeFileSync(
      path.join(outDir, "orb-manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
  }
  console.log("Done. Orbs:", manifest.orbs.map((o) => `${o.id}:${o.bytes}B`).join(" "));
}

main();
