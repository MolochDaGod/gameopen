import { describe, expect, it } from "vitest";
import {
  AI_PRODUCTION_SYSTEMS_PROMPT,
  AI_WIRING,
  CAMPFIRE_SURFACES,
  CAMPFIRE_TVS,
  campfireTvsUrls,
  ENCAMPMENT_BACKDROP,
  encampmentBackdropUrls,
  DEPLOY_CHECKLIST,
  DEPLOY_LAYERS,
  PROD_AUTH_TOKEN_KEYS,
  PROD_HOSTS,
  PROD_KILL_LIST,
  PROD_TIMING_MS,
  readProductionAuthToken,
  REST_SAME_ORIGIN,
  SURFACE_LOAD_PLAN,
  warmupProductionSurface,
} from "./productionSystemsPattern";

describe("productionSystemsPattern", () => {
  it("locks platform layers to CF + Vercel + Railway", () => {
    expect(DEPLOY_LAYERS.frontend).toBe("vercel");
    expect(DEPLOY_LAYERS.edge).toBe("cloudflare_worker");
    expect(DEPLOY_LAYERS.binaries).toBe("cloudflare_r2");
    expect(DEPLOY_LAYERS.playerApi).toBe("railway_node");
  });

  it("uses same-origin REST paths only", () => {
    for (const path of Object.values(REST_SAME_ORIGIN)) {
      expect(path.startsWith("/api/")).toBe(true);
    }
    expect(REST_SAME_ORIGIN.aiHealth).toBe("/api/ai/health");
  });

  it("maps critical surfaces to load patterns + cinema ids", () => {
    expect(SURFACE_LOAD_PLAN.doors?.pattern).toBe("cinema_backdrop");
    expect(SURFACE_LOAD_PLAN.characters?.cinemaId).toBe("char_select_establish");
    // Lobby owns one CampfireLobbyScene — no ProductionCinema dungeon gate
    expect(SURFACE_LOAD_PLAN.lobby?.pattern).toBe("spa_instant");
    expect(SURFACE_LOAD_PLAN.lobby?.cinemaId).toBeUndefined();
    expect(SURFACE_LOAD_PLAN.danger?.pattern).toBe("boot_gate");
    expect(SURFACE_LOAD_PLAN.home_island?.criticalMeshes?.length).toBeGreaterThan(0);
  });

  it("characters/lobby critical meshes are TVS farm CDN props not dungeon", () => {
    const charMeshes = SURFACE_LOAD_PLAN.characters?.criticalMeshes ?? [];
    expect(charMeshes.some((m) => m.includes("campfire-lobby/tvs"))).toBe(true);
    expect(charMeshes.some((m) => /dungeon|ethereal/i.test(m))).toBe(false);
    expect(CAMPFIRE_SURFACES.modes).toContain("characters");
    expect(CAMPFIRE_SURFACES.doorAliases).toContain("characters");
  });

  it("auth token keys put Open primary first and match fleet.ts", async () => {
    expect(PROD_AUTH_TOKEN_KEYS[0]).toBe("grudge.open.token");
    expect(readProductionAuthToken({ override: "jwt.test" })).toBe("jwt.test");
    expect(readProductionAuthToken({ override: null })).toBe(null);
    const { FLEET_TOKEN_KEYS } = await import("./fleet");
    expect([...FLEET_TOKEN_KEYS]).toEqual([...PROD_AUTH_TOKEN_KEYS]);
  });

  it("campfire TVS urls are CDN-first", () => {
    const urls = campfireTvsUrls("campfire.glb");
    expect(urls[0]).toContain(PROD_HOSTS.assetsCdn);
    expect(urls[0]).toContain("campfire-lobby/tvs/campfire.glb");
    expect(CAMPFIRE_TVS.smokeCritical.length).toBeGreaterThanOrEqual(3);
  });

  it("Encament backdrop is CDN-first and play starts at Encament", () => {
    const urls = encampmentBackdropUrls();
    expect(urls[0]).toContain(PROD_HOSTS.assetsCdn);
    expect(urls[0]).toContain("chicken_gun_fruzer_encampment.glb");
    expect(ENCAMPMENT_BACKDROP.era).toBe("voxel");
    expect(ENCAMPMENT_BACKDROP.localPlay).toBe("encampment");
    expect(ENCAMPMENT_BACKDROP.playUrl).toContain("/characters");
  });

  it("AI wiring has health path and auth error copy", () => {
    expect(AI_WIRING.healthSameOrigin).toBe("/api/ai/health");
    expect(AI_WIRING.errNoToken).toMatch(/sign in/i);
    expect(AI_WIRING.errRejected).toMatch(/re-sign/i);
  });

  it("keeps timing budgets under boot stall", () => {
    expect(PROD_TIMING_MS.restWarmupBudget).toBeLessThan(PROD_TIMING_MS.bootSlowNotice);
    expect(PROD_TIMING_MS.surfaceStall).toBeLessThan(PROD_TIMING_MS.bootStall);
  });

  it("warmup parallelizes REST with mock fetch when token present", async () => {
    const calls: string[] = [];
    const result = await warmupProductionSurface("characters", {
      budgetMs: 500,
      authToken: "test.jwt.token",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
      prefetchMeshes: [],
    });
    expect(calls.some((c) => c.includes("/api/characters"))).toBe(true);
    expect(result.surface).toBe("characters");
    expect(PROD_HOSTS.open).toContain("open.grudge-studio.com");
  });

  it("warmup skips characters REST when guest has no token", async () => {
    const calls: string[] = [];
    await warmupProductionSurface("doors", {
      budgetMs: 500,
      authToken: null,
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
      prefetchMeshes: [],
    });
    expect(calls.some((c) => c.includes("/api/characters"))).toBe(false);
    expect(calls.some((c) => c.includes("/api/health"))).toBe(true);
  });

  it("doors critical meshes use live CDN heroes not introgamer", () => {
    const meshes = SURFACE_LOAD_PLAN.doors?.criticalMeshes ?? [];
    expect(meshes.some((m) => m.includes("introgamer"))).toBe(false);
    expect(meshes.some((m) => m.includes("racalvin"))).toBe(true);
  });

  it("exports deploy checklist and kill list for agents", () => {
    expect(DEPLOY_CHECKLIST.length).toBeGreaterThan(3);
    expect(PROD_KILL_LIST.some((k) => /WebSocket/i.test(k))).toBe(true);
    expect(PROD_KILL_LIST.some((k) => /grudge\.open\.token/i.test(k))).toBe(true);
    expect(AI_PRODUCTION_SYSTEMS_PROMPT).toContain("same-origin");
    expect(AI_PRODUCTION_SYSTEMS_PROMPT).toContain("Cloudflare");
    expect(AI_PRODUCTION_SYSTEMS_PROMPT).toContain("readProductionAuthToken");
  });
});
