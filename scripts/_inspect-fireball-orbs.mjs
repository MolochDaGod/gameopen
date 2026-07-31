import fs from "fs";
import path from "path";

function inspectGlb(file) {
  const buf = fs.readFileSync(file);
  const magic = buf.toString("utf8", 0, 4);
  if (magic !== "glTF") throw new Error("not glb " + file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  const nodes = json.nodes || [];
  const meshes = json.meshes || [];
  const mats = json.materials || [];
  const scenes = json.scenes || [];
  const anims = json.animations || [];
  const access = json.accessors || [];

  function walk(i, depth, acc) {
    const n = nodes[i] || {};
    const name = n.name || "node_" + i;
    const t = n.translation || [0, 0, 0];
    const s = n.scale || [1, 1, 1];
    const hasMesh = n.mesh !== undefined;
    acc.push({
      i,
      name,
      t,
      s,
      hasMesh,
      mesh: hasMesh ? meshes[n.mesh].name || "mesh_" + n.mesh : null,
      children: (n.children || []).length,
      depth,
    });
    for (const c of n.children || []) walk(c, depth + 1, acc);
  }

  const childSet = new Set();
  for (const n of nodes) for (const c of n.children || []) childSet.add(c);
  const roots =
    (scenes[0] && scenes[0].nodes) ||
    nodes.map((_, i) => i).filter((i) => !childSet.has(i));
  const tree = [];
  for (const r of roots) walk(r, 0, tree);

  let globalMin = [Infinity, Infinity, Infinity];
  let globalMax = [-Infinity, -Infinity, -Infinity];
  for (const m of meshes) {
    for (const p of m.primitives || []) {
      const ai = p.attributes && p.attributes.POSITION;
      if (ai === undefined) continue;
      const a = access[ai];
      if (a && a.min && a.max) {
        for (let k = 0; k < 3; k++) {
          globalMin[k] = Math.min(globalMin[k], a.min[k]);
          globalMax[k] = Math.max(globalMax[k], a.max[k]);
        }
      }
    }
  }
  const size =
    globalMin[0] === Infinity
      ? null
      : [
          globalMax[0] - globalMin[0],
          globalMax[1] - globalMin[1],
          globalMax[2] - globalMin[2],
        ];
  const center = size
    ? [
        (globalMin[0] + globalMax[0]) / 2,
        (globalMin[1] + globalMax[1]) / 2,
        (globalMin[2] + globalMax[2]) / 2,
      ]
    : null;

  // group mesh nodes by approximate Z center of their mesh accessor
  const meshNodes = [];
  for (const n of nodes) {
    if (n.mesh === undefined) continue;
    const m = meshes[n.mesh];
    const prim = (m.primitives || [])[0];
    const ai = prim?.attributes?.POSITION;
    const a = ai !== undefined ? access[ai] : null;
    const t = n.translation || [0, 0, 0];
    meshNodes.push({
      name: n.name || m.name || "?",
      mesh: m.name || "mesh_" + n.mesh,
      t,
      min: a?.min,
      max: a?.max,
      mid: a?.min
        ? [
            (a.min[0] + a.max[0]) / 2 + t[0],
            (a.min[1] + a.max[1]) / 2 + t[1],
            (a.min[2] + a.max[2]) / 2 + t[2],
          ]
        : t,
    });
  }

  console.log("FILE", file);
  console.log(
    " bytes",
    buf.length,
    "nodes",
    nodes.length,
    "meshes",
    meshes.length,
    "mats",
    mats.length,
    "anims",
    anims.length,
    "images",
    (json.images || []).length,
    "textures",
    (json.textures || []).length,
  );
  console.log(
    " mesh names:",
    meshes.map((m, i) => m.name || "m" + i).join(", "),
  );
  if (size) {
    console.log(
      " accessor AABB size",
      size.map((x) => +x.toFixed(3)),
      "maxDim",
      +Math.max(...size).toFixed(3),
      "center",
      center.map((x) => +x.toFixed(3)),
    );
  }
  console.log(" mesh-bearing nodes (world-ish mid via t+local aabb):");
  meshNodes
    .sort((a, b) => (a.mid?.[2] ?? 0) - (b.mid?.[2] ?? 0))
    .forEach((n) => {
      console.log(
        "  -",
        n.name,
        "mesh=",
        n.mesh,
        "t=",
        n.t.map((x) => +x.toFixed(2)),
        "midZ=",
        n.mid ? +n.mid[2].toFixed(2) : "?",
        "localSize=",
        n.min
          ? [
              +(n.max[0] - n.min[0]).toFixed(2),
              +(n.max[1] - n.min[1]).toFixed(2),
              +(n.max[2] - n.min[2]).toFixed(2),
            ]
          : "?",
      );
    });
  console.log(" top tree:");
  for (const n of tree.slice(0, 40)) {
    const pad = "  ".repeat(n.depth);
    console.log(
      pad + "-",
      n.name,
      "t=" + n.t.map((x) => +x.toFixed(1)).join(","),
      n.hasMesh ? "mesh=" + n.mesh : "",
    );
  }
  if (tree.length > 40) console.log("  ... +" + (tree.length - 40) + " more");
  console.log("");
}

const root = path.resolve("client/public/models/vfx");
const files = [
  "fireball.glb",
  "orbs/orb-fire.glb",
  "orbs/orb-ember.glb",
  "orbs/orb-core.glb",
  "orbs/orb-flare.glb",
  "explosive-orb.glb",
];
for (const rel of files) {
  const f = path.join(root, rel);
  if (fs.existsSync(f)) inspectGlb(f);
  else console.log("MISS", f);
}
