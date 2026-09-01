import { describe, expect, it, vi, afterEach } from "vitest";
import { apiUrl, gameDataUrl, FLEET } from "./fleetCore";

describe("apiUrl / gameDataUrl SSOT", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("browser keeps same-origin /api paths", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => null } });
    expect(apiUrl("/api/ledger/search")).toBe("/api/ledger/search");
    expect(apiUrl("/api/uuid/test")).toBe("/api/uuid/test");
    expect(apiUrl("characters")).toBe("/api/characters");
  });

  it("gameDataUrl always keeps /api on Railway origin", () => {
    expect(gameDataUrl("/api/health")).toBe(`${FLEET.gameData}/api/health`);
    expect(gameDataUrl("/api/uuid/test")).toBe(`${FLEET.gameData}/api/uuid/test`);
    expect(gameDataUrl("ledger/search")).toBe(`${FLEET.gameData}/api/ledger/search`);
  });
});
