import { describe, expect, it } from "vitest";
import { CinemaTimeline, validateCinemaManifest } from "./CinemaTimeline";
import {
  CINEMA_CHAR_SELECT_ESTABLISH,
  CINEMA_INTRO_DOORS,
  CINEMA_INTRO_TO_CHARACTERS,
  PRODUCTION_CINEMAS,
} from "./catalog";

describe("CinemaTimeline + production catalog", () => {
  it("validates every production cinema recording", () => {
    for (const m of Object.values(PRODUCTION_CINEMAS)) {
      const v = validateCinemaManifest(m);
      expect(v.ok, `${m.id}: ${v.errors.join(", ")}`).toBe(true);
      expect(m.beats.length).toBeGreaterThan(0);
    }
  });

  it("intro_doors loops without finishing", () => {
    const tl = new CinemaTimeline(CINEMA_INTRO_DOORS);
    let s = tl.update(30);
    expect(s.finished).toBe(false);
    expect(s.time).toBeLessThan(CINEMA_INTRO_DOORS.durationSec);
    expect(s.caption.length).toBeGreaterThan(0);
  });

  it("intro_to_characters finishes and hands off to characters", () => {
    expect(CINEMA_INTRO_TO_CHARACTERS.transitionTo).toBe("characters");
    const tl = new CinemaTimeline(CINEMA_INTRO_TO_CHARACTERS);
    const s = tl.update(CINEMA_INTRO_TO_CHARACTERS.durationSec + 1);
    expect(s.finished).toBe(true);
  });

  it("skip respects skippableAfterSec then completes linear", () => {
    const tl = new CinemaTimeline(CINEMA_INTRO_TO_CHARACTERS);
    tl.update(0.2);
    let s = tl.skip();
    expect(s.finished).toBe(false);
    tl.update(1.5);
    s = tl.skip();
    expect(s.finished).toBe(true);
  });

  it("char select establish is short and production-tagged", () => {
    expect(CINEMA_CHAR_SELECT_ESTABLISH.surface).toBe("characters");
    expect(CINEMA_CHAR_SELECT_ESTABLISH.durationSec).toBeLessThan(12);
    expect(CINEMA_INTRO_DOORS.assets.some((a) => a.kind === "character")).toBe(true);
  });
});
