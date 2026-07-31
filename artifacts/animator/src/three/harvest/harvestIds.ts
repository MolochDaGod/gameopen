/**
 * Stable harvest identity helpers: definition / location / instance UUIDs.
 * Prefixes: hrvd_ (def) · hrvl_ (location) · hrvi_ (instance)
 */

function slugify(s: string): string {
  return String(s || "item")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

/** Simple deterministic hash → hex. */
export function uuidFromSeed(seed: string): string {
  let h = 2166136261;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // expand to 32 hex chars
  const a = (h >>> 0).toString(16).padStart(8, "0");
  const b = ((h * 2654435761) >>> 0).toString(16).padStart(8, "0");
  const c = ((h * 1597334677) >>> 0).toString(16).padStart(8, "0");
  const d = ((h ^ 0x9e3779b9) >>> 0).toString(16).padStart(8, "0");
  return `${a}${b}${c}${d}`;
}

export function definitionId(slug: string): string {
  return `hrvd_${slugify(slug)}`;
}

/** Location id from world seed + quantized cell + def slug. */
export function locationIdForCell(
  worldSeed: string,
  x: number,
  y: number,
  z: number,
  defSlug: string,
  cell = 1,
): string {
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);
  const cz = Math.floor(z / cell);
  const key = `${worldSeed}|${cx},${cy},${cz}|${slugify(defSlug)}`;
  return `hrvl_${uuidFromSeed(key).slice(0, 16)}`;
}

export function newInstanceId(worldSeed: string, key: string): string {
  return `hrvi_${uuidFromSeed(`${worldSeed}|${key}|${Date.now() % 1e6}`).slice(0, 20)}`;
}
