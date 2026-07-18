/**
 * Grudge / Warlords UUID + typed id SSOT.
 *
 * Runtime identity (players, entities, instances) MUST use these helpers —
 * never seed-derived RNG for entity ids (world gen stays deterministic).
 *
 * Character / item ids follow fleet D1 / Postgres conventions:
 *   char_… · HERO-… · EQIP-… · ITEM-…
 */

let counter = 0;

/** RFC UUID v4 when available; otherwise time+counter+random (Node 18+ / browsers). */
export function newUuid(prefix = ""): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const base =
    c && typeof c.randomUUID === "function"
      ? c.randomUUID()
      : `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 10)}`;
  return prefix ? `${prefix}_${base}` : base;
}

/** Known fleet id prefixes (storage + network). */
export const ID_PREFIX = {
  /** Player character row (Postgres / D1 SSOT) */
  character: "char_",
  /** Hero / display character pack */
  hero: "HERO-",
  /** Equipment instance */
  equipment: "EQIP-",
  /** Item instance */
  item: "ITEM-",
  /** Runtime entity (NPC, prop, projectile) */
  entity: "ent_",
  /** Network room / match */
  room: "room_",
  /** Scene instance (dungeon run, island session) */
  instance: "inst_",
  /** Zone / cabinet / GRUDOX card */
  zone: "zone_",
  /** Portal / trigger */
  portal: "portal_",
  /** Script / content module */
  script: "scr_",
  /** Asset catalog key (logical, not R2 path) */
  asset: "asset_",
} as const;

export type IdKind = keyof typeof ID_PREFIX;

/** Mint a typed runtime id: `ent_<uuid>`, `inst_<uuid>`, etc. */
export function newGrudgeId(kind: IdKind): string {
  return newUuid(ID_PREFIX[kind].replace(/[-_]$/, "") || kind);
}

/** Mint with exact prefix string (e.g. `char_`). */
export function newPrefixedId(prefix: string): string {
  const p = prefix.endsWith("_") || prefix.endsWith("-") ? prefix.slice(0, -1) : prefix;
  return newUuid(p);
}

/** Detect kind from a stored id string. */
export function detectIdKind(id: string): IdKind | "uuid" | "unknown" {
  if (!id || typeof id !== "string") return "unknown";
  for (const [kind, prefix] of Object.entries(ID_PREFIX) as [IdKind, string][]) {
    if (id.startsWith(prefix)) return kind;
  }
  // bare UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return "uuid";
  }
  return "unknown";
}

/** True when id looks like a fleet character key. */
export function isCharacterId(id: string): boolean {
  const k = detectIdKind(id);
  return k === "character" || k === "hero" || id === "guest";
}

/**
 * Multiplayer wire name: display + animator character id + fleet uuid.
 * Unit-separator so display names can contain `|`.
 */
export function encodeWirePlayerName(
  displayName: string,
  characterId: string,
  fleetId = "local",
): string {
  return `${displayName}\u001f${characterId}\u001f${fleetId}`;
}

export function decodeWirePlayerName(wire: string): {
  displayName: string;
  characterId: string | null;
  fleetId: string | null;
} {
  const parts = wire.split("\u001f");
  if (parts.length >= 2) {
    return {
      displayName: parts[0] || "Player",
      characterId: parts[1] || null,
      fleetId: parts[2] || null,
    };
  }
  const pipe = wire.split("|");
  if (pipe.length >= 2) {
    return { displayName: pipe[0] || "Player", characterId: pipe[1] || null, fleetId: null };
  }
  return { displayName: wire || "Player", characterId: null, fleetId: null };
}
