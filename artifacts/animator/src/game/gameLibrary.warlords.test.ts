import { describe, expect, it } from "vitest";
import {
  featuredGames,
  getGame,
  isLibraryVisible,
  libraryByCategory,
  warlordsInGameWorlds,
  WARLORDS_CLIENT_URL,
  WARLORDS_PIRATE_LOBBY_URL,
  WARLORDS_TUTORIAL_URL,
  gameLaunchUrl,
} from "./gameLibrary";

describe("Warlords in-game only (not Open standalone)", () => {
  it("hides home/water/grudox/pirate lobby from library lists", () => {
    for (const id of ["water-island", "grudox-island", "pirate-islands"]) {
      const g = getGame(id);
      expect(g, id).toBeTruthy();
      expect(g!.warlordsInGameOnly, id).toBe(true);
      expect(isLibraryVisible(g!), id).toBe(false);
    }
    const warlordsCat = libraryByCategory("warlords").map((g) => g.id);
    expect(warlordsCat).not.toContain("water-island");
    expect(warlordsCat).not.toContain("grudox-island");
    expect(warlordsCat).not.toContain("pirate-islands");
    expect(warlordsCat).toContain("warlords");
  });

  it("does not feature in-game islands or chicken-gun pirate lobby", () => {
    const ids = featuredGames().map((g) => g.id);
    expect(ids).not.toContain("water-island");
    expect(ids).not.toContain("grudox-island");
    expect(ids).not.toContain("pirate-islands");
    expect(ids).toContain("warlords");
  });

  it("launch URL for in-game worlds points at Warlords client", () => {
    const g = getGame("water-island")!;
    const url = gameLaunchUrl(g, { token: "t", characterId: "c1" });
    expect(url).toContain("client.grudge-studio.com");
    expect(url).toContain("warlordsWorld=water-island");
    expect(url).not.toContain("water.grudge-studio.com/island");
  });

  it("pirate-islands launches Warlords opening/tutorial lobby (not GRUDOX or Explorer)", () => {
    const g = getGame("pirate-islands")!;
    expect(g.category).toBe("warlords");
    expect(g.warlordsInGameOnly).toBe(true);
    const url = gameLaunchUrl(g, { token: "t", characterId: "c1" })!;
    expect(url).toContain("client.grudge-studio.com");
    expect(url).toContain("map=pirate-islands");
    expect(url).toContain("mode=lobby");
    expect(url).toContain("warlordsWorld=pirate-islands");
    expect(url).not.toContain("grudox.grudge-studio.com");
    expect(url).not.toContain("threejs-player-and-grass");
    expect(url).not.toMatch(/\/explorer\b/);
    expect(WARLORDS_PIRATE_LOBBY_URL).toContain("pirate-islands");
    expect(WARLORDS_TUTORIAL_URL).toContain("/tutorial");
  });

  it("documents sector/home/pirate lobby as warlordsInGameWorlds", () => {
    const hidden = warlordsInGameWorlds();
    expect(hidden.length).toBeGreaterThanOrEqual(3);
    expect(hidden.map((g) => g.id)).toContain("pirate-islands");
    expect(WARLORDS_CLIENT_URL).toMatch(/client\.grudge-studio\.com/);
  });
});
