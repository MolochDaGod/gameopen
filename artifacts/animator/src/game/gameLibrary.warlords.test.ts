import { describe, expect, it } from "vitest";
import {
  featuredGames,
  getGame,
  isLibraryVisible,
  libraryByCategory,
  warlordsInGameWorlds,
  WARLORDS_CLIENT_URL,
  gameLaunchUrl,
} from "./gameLibrary";

describe("Warlords in-game only (not Open standalone)", () => {
  it("hides home/water/grudox island from library lists", () => {
    for (const id of ["water-island", "grudox-island"]) {
      const g = getGame(id);
      expect(g, id).toBeTruthy();
      expect(g!.warlordsInGameOnly, id).toBe(true);
      expect(isLibraryVisible(g!), id).toBe(false);
    }
    const warlordsCat = libraryByCategory("warlords").map((g) => g.id);
    expect(warlordsCat).not.toContain("water-island");
    expect(warlordsCat).not.toContain("grudox-island");
    expect(warlordsCat).toContain("warlords");
  });

  it("does not feature in-game islands", () => {
    const ids = featuredGames().map((g) => g.id);
    expect(ids).not.toContain("water-island");
    expect(ids).not.toContain("grudox-island");
    expect(ids).toContain("warlords");
  });

  it("launch URL for in-game worlds points at Warlords client", () => {
    const g = getGame("water-island")!;
    const url = gameLaunchUrl(g, { token: "t", characterId: "c1" });
    expect(url).toContain("client.grudge-studio.com");
    expect(url).toContain("warlordsWorld=water-island");
    expect(url).not.toContain("water.grudge-studio.com/island");
  });

  it("documents sector/home as warlordsInGameWorlds", () => {
    const hidden = warlordsInGameWorlds();
    expect(hidden.length).toBeGreaterThanOrEqual(2);
    expect(WARLORDS_CLIENT_URL).toMatch(/client\.grudge-studio\.com/);
  });
});
