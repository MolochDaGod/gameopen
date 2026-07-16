/**
 * Lightweight GLB bounds reader — no three.js required.
 * Uses accessor min/max when present (glTF 2.0 exporters usually write them).
 */
import fs from "node:fs";

/**
 * @param {string} filePath
 * @returns {{ ok: boolean, size?: {x:number,y:number,z:number}, min?: number[], max?: number[], animCount?: number, skinCount?: number, meshCount?: number, clipNames?: string[], nodeNames?: string[], err?: string }}
 */
export function inspectGlb(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 20) return { ok: false, err: "file too small" };
    const magic = buf.toString("utf8", 0, 4);
    if (magic !== "glTF") return { ok: false, err: "not a GLB" };

    let off = 12;
    let json = null;
    while (off + 8 <= buf.length) {
      const len = buf.readUInt32LE(off);
      const type = buf.toString("utf8", off + 4, off + 8);
      off += 8;
      if (type === "JSON") {
        json = JSON.parse(buf.slice(off, off + len).toString("utf8"));
      }
      off += len;
      if (off % 4) off += 4 - (off % 4);
    }
    if (!json) return { ok: false, err: "no JSON chunk" };

    const animCount = (json.animations || []).length;
    const skinCount = (json.skins || []).length;
    const meshCount = (json.meshes || []).length;
    const clipNames = (json.animations || []).map((a) => a.name || "(unnamed)");
    const nodeNames = (json.nodes || []).map((n) => n.name).filter(Boolean);

    // Union POSITION accessor bounds
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    let found = false;
    for (const mesh of json.meshes || []) {
      for (const prim of mesh.primitives || []) {
        const posIdx = prim.attributes?.POSITION;
        if (posIdx == null) continue;
        const acc = json.accessors?.[posIdx];
        if (!acc?.min || !acc?.max) continue;
        found = true;
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], acc.min[i]);
          max[i] = Math.max(max[i], acc.max[i]);
        }
      }
    }

    // Apply node scales (shallow) if only one root scale is present
    if (found && json.nodes?.length) {
      // If a single non-1 scale on root, approximate
      const root = json.nodes[json.scenes?.[0]?.nodes?.[0] ?? 0];
      if (root?.scale) {
        const [sx, sy, sz] = root.scale;
        min = [min[0] * sx, min[1] * sy, min[2] * sz];
        max = [max[0] * sx, max[1] * sy, max[2] * sz];
      }
    }

    if (!found) {
      return {
        ok: true,
        animCount,
        skinCount,
        meshCount,
        clipNames,
        nodeNames,
        err: "no POSITION min/max — re-export or run grudge-convert inspect",
      };
    }

    const size = {
      x: max[0] - min[0],
      y: max[1] - min[1],
      z: max[2] - min[2],
    };
    return {
      ok: true,
      size,
      min,
      max,
      animCount,
      skinCount,
      meshCount,
      clipNames,
      nodeNames,
    };
  } catch (e) {
    return { ok: false, err: String(e.message || e) };
  }
}
