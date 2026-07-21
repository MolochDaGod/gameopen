import { describe, expect, it } from "vitest";
import {
  AI_PRODUCTION_SYSTEMS_PROMPT,
  DEPLOY_CHECKLIST,
  DEPLOY_LAYERS,
  PROD_HOSTS,
  PROD_KILL_LIST,
  PROD_TIMING_MS,
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
  });

  it("maps critical surfaces to load patterns + cinema ids", () => {
    expect(SURFACE_LOAD_PLAN.doors?.pattern).toBe("cinema_backdrop");
    expect(SURFACE_LOAD_PLAN.characters?.cinemaId).toBe("char_select_establish");
    expect(SURFACE_LOAD_PLAN.lobby?.pattern).toBe("cinema_flow");
    expect(SURFACE_LOAD_PLAN.danger?.pattern).toBe("boot_gate");
    expect(SURFACE_LOAD_PLAN.home_island?.criticalMeshes?.length).toBeGreaterThan(0);
  });

  it("keeps timing budgets under boot stall", () => {
    expect(PROD_TIMING_MS.restWarmupBudget).toBeLessThan(PROD_TIMING_MS.bootSlowNotice);
    expect(PROD_TIMING_MS.surfaceStall).toBeLessThan(PROD_TIMING_MS.bootStall);
  });

  it("warmup parallelizes REST with mock fetch", async () => {
    const calls: string[] = [];
    const result = await warmupProductionSurface("characters", {
      budgetMs: 500,
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

  it("exports deploy checklist and kill list for agents", () => {
    expect(DEPLOY_CHECKLIST.length).toBeGreaterThan(3);
    expect(PROD_KILL_LIST.some((k) => /WebSocket/i.test(k))).toBe(true);
    expect(AI_PRODUCTION_SYSTEMS_PROMPT).toContain("same-origin");
    expect(AI_PRODUCTION_SYSTEMS_PROMPT).toContain("Cloudflare");
  });
});
