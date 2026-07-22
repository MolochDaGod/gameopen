import { describe, expect, it } from "vitest";
import { STORM_SHIP_ASSETS } from "./StormShipAttackScene";
import { CINEMA_STORM_SHIP_ATTACK, getCinema } from "./catalog";
import { validateCinemaManifest } from "./CinemaTimeline";

describe("Storm Ship Attack cinema", () => {
  it("catalog entry validates and hands off to characters", () => {
    const m = getCinema("storm_ship_attack");
    expect(m?.id).toBe("storm_ship_attack");
    expect(validateCinemaManifest(CINEMA_STORM_SHIP_ATTACK).ok).toBe(true);
    expect(CINEMA_STORM_SHIP_ATTACK.transitionTo).toBe("characters");
    expect(CINEMA_STORM_SHIP_ATTACK.surface).toBe("landing");
  });

  it("lists prod ship + stingray mesh keys", () => {
    expect(STORM_SHIP_ASSETS.ship[0]).toContain("stylized-pirate-ship.prod.glb");
    expect(STORM_SHIP_ASSETS.stingray[0]).toContain("mutant-stingray.prod.glb");
    expect(STORM_SHIP_ASSETS.heroes.length).toBeGreaterThan(2);
  });
});
