/**
 * Seed world deployments — Minecraft-like open worlds with portal → dungeon.
 * Catalog: content/worlds/seed-deployments.json
 */
import {
  buildSeedDeployment,
  clampChunkIdx,
  chunkBlocks,
  DEFAULT_CHUNK_IDX,
  deploymentToScene,
  deploymentToSharePayload,
  hashSeed,
  type SeedPortal,
  type SeedPortalPlan,
  type SeedWorldBiome,
  type SeedWorldDeployment,
} from "@workspace/voxel-canonical";

export { chunkBlocks, clampChunkIdx, DEFAULT_CHUNK_IDX };
import {
  buildMineLoaderUrl,
  mineLoaderApiCandidates,
} from "../auth/mineLoaderConfig";
import { getStoredToken } from "../lib/grudgeAuth";
import { gameSession } from "./GameSession";

export type { SeedWorldDeployment, SeedPortal };

export interface SeedCatalogEntry {
  id: string;
  name: string;
  blurb: string;
  seed: string | number;
  chunkIdx: number;
  biome: SeedWorldBiome;
  featured?: boolean;
  deploy: "mine-loader" | "open-playtest" | "both";
  portalPlan?: Partial<SeedPortalPlan>;
  portals?: SeedPortal[];
}

export interface SeedCatalog {
  format: string;
  version: number;
  label: string;
  notes: string;
  journey: string[];
  deployments: SeedCatalogEntry[];
}

const FALLBACK_CATALOG: SeedCatalog = {
  format: "grudge.seed-world.catalog.v1",
  version: 1,
  label: "Seed world deployments",
  notes: "Fallback catalog — open world seeds with portals into dungeons.",
  journey: [
    "Join seed world",
    "Explore overworld",
    "Find portal",
    "Enter dungeon",
    "Return via exit portal",
  ],
  deployments: [
    {
      id: "seed-grudge-plains",
      name: "Grudge Plains",
      blurb: "Starter overworld (256²) — four themed dungeon portals.",
      seed: "grudge-plains",
      chunkIdx: DEFAULT_CHUNK_IDX,
      biome: "plains",
      featured: true,
      deploy: "both",
      portalPlan: {
        portalCount: 4,
        themes: ["ruins", "crypt", "mine", "temple"],
      },
    },
  ],
};

async function tryJson<T>(urls: string[]): Promise<T | null> {
  for (const u of urls) {
    try {
      const r = await fetch(u, { credentials: "omit" });
      if (!r.ok) continue;
      return (await r.json()) as T;
    } catch {
      /* next */
    }
  }
  return null;
}

export async function loadSeedCatalog(): Promise<SeedCatalog> {
  const data = await tryJson<SeedCatalog>([
    "/content/worlds/seed-deployments.json",
    "/api/content/worlds/seed-deployments.json",
    ...mineLoaderApiCandidates("/api/content/worlds/seed-deployments.json"),
    "https://info.grudge-studio.com/api/v1/content/worlds/seed-deployments.json",
    "https://objectstore.grudge-studio.com/api/v1/content/worlds/seed-deployments.json",
  ]);
  if (data?.deployments?.length) {
    // Normalize chunkIdx (catalog v1 had invalid 8/9).
    return {
      ...data,
      deployments: data.deployments.map((d) => ({
        ...d,
        chunkIdx: clampChunkIdx(d.chunkIdx ?? DEFAULT_CHUNK_IDX),
      })),
    };
  }
  return FALLBACK_CATALOG;
}

/** Expand catalog entry into full deployment with deterministic portals. */
export function catalogEntryToDeployment(entry: SeedCatalogEntry): SeedWorldDeployment {
  return buildSeedDeployment({
    id: entry.id,
    name: entry.name,
    blurb: entry.blurb,
    seed: entry.seed,
    chunkIdx: clampChunkIdx(entry.chunkIdx ?? DEFAULT_CHUNK_IDX),
    biome: entry.biome,
    featured: entry.featured,
    deploy: entry.deploy,
    portalPlan: entry.portalPlan,
    portals: entry.portals,
  });
}

export function listDeployments(catalog: SeedCatalog): SeedWorldDeployment[] {
  return catalog.deployments.map(catalogEntryToDeployment);
}

/** Custom seed typed by player (Minecraft-style). */
export function customSeedDeployment(
  seedInput: string,
  opts?: {
    name?: string;
    biome?: SeedWorldBiome;
    portalCount?: number;
    chunkIdx?: number;
  },
): SeedWorldDeployment {
  const trimmed = seedInput.trim() || String(Date.now());
  return buildSeedDeployment({
    id: `seed-custom-${hashSeed(trimmed).toString(16)}`,
    name: opts?.name ?? `World · ${trimmed.slice(0, 24)}`,
    blurb: "Custom seed overworld — portals placed from seed.",
    seed: trimmed,
    chunkIdx: clampChunkIdx(opts?.chunkIdx ?? DEFAULT_CHUNK_IDX),
    biome: opts?.biome ?? "mixed",
    featured: false,
    deploy: "both",
    portalPlan: {
      portalCount: opts?.portalCount ?? 4,
      themes: ["ruins", "crypt", "mine", "temple"],
    },
  });
}

/**
 * Launch URL into Mine-Loader Realms with seed + deployment metadata.
 * Client/lobby can read query params for create/join seed world.
 */
export function buildSeedWorldLaunchUrl(dep: SeedWorldDeployment): string {
  const token = getStoredToken();
  return buildMineLoaderUrl({
    surface: "play",
    token,
    characterId: gameSession.snapshot.selectedCharacterId,
    seed: dep.world.seedNumber,
    seedLabel: String(dep.world.seed),
    deploymentId: dep.world.id,
    chunkIdx: clampChunkIdx(dep.world.chunkIdx),
    worldMode: "seed-overworld",
  });
}

/** Deep-link into a specific dungeon via portal (after discovery). */
export function buildPortalDungeonLaunchUrl(
  dep: SeedWorldDeployment,
  portalId: string,
): string | null {
  const portal = dep.portals.find((p) => p.id === portalId);
  if (!portal) return null;
  const token = getStoredToken();
  const url = new URL(
    buildMineLoaderUrl({
      surface: "play",
      token,
      characterId: gameSession.snapshot.selectedCharacterId,
    }),
  );
  url.searchParams.set("mode", "dungeon");
  url.searchParams.set("dungeonId", portal.dungeon.dungeonId);
  url.searchParams.set("dungeonSeed", String(portal.dungeon.seed));
  if (portal.dungeon.templateId) {
    url.searchParams.set("templateId", portal.dungeon.templateId);
  }
  if (portal.dungeon.theme) url.searchParams.set("theme", portal.dungeon.theme);
  url.searchParams.set("returnDeployment", dep.world.id);
  url.searchParams.set("returnSeed", String(dep.world.seedNumber));
  url.searchParams.set("returnPortal", portal.id);
  url.searchParams.set(
    "returnPos",
    `${portal.position.x},${portal.position.y + 1},${portal.position.z}`,
  );
  return url.toString();
}

/** POST share payload to Mine-Loader /api/worlds when available. */
export async function shareSeedDeployment(
  dep: SeedWorldDeployment,
): Promise<{ ok: boolean; code?: string; error?: string; launchUrl?: string }> {
  const body = deploymentToSharePayload(dep);
  // Prefer Open same-origin proxy → Railway, then direct Railway / edge SPA.
  const urls = mineLoaderApiCandidates("/api/worlds");
  for (const u of urls) {
    try {
      const r = await fetch(u, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { code?: string; name?: string };
      if (!j.code) continue;
      const launch = buildMineLoaderUrl({
        surface: "join",
        joinCode: j.code,
        token: getStoredToken(),
        characterId: gameSession.snapshot.selectedCharacterId,
        seed: dep.world.seedNumber,
        chunkIdx: clampChunkIdx(dep.world.chunkIdx),
        deploymentId: dep.world.id,
      });
      return { ok: true, code: j.code, launchUrl: launch };
    } catch {
      /* next */
    }
  }
  // Fallback: open play with seed query only (no share code)
  return {
    ok: false,
    error: "Share API unavailable — open with seed query instead",
    launchUrl: buildSeedWorldLaunchUrl(dep),
  };
}

export function exportDeploymentJson(dep: SeedWorldDeployment): string {
  return JSON.stringify(
    {
      ...dep,
      scene: deploymentToScene(dep),
      share: deploymentToSharePayload(dep),
    },
    null,
    2,
  );
}

export function downloadDeploymentJson(dep: SeedWorldDeployment) {
  const blob = new Blob([exportDeploymentJson(dep)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${dep.world.id}.seed-world.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
