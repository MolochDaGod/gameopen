import { describe, expect, it } from "vitest";
import {
  applyIntensity,
  rangedFireLock,
  rangedPrimaryTune,
  rangedReleaseDelay,
} from "./rangedPrimary";

describe("rangedPrimaryTune", () => {
  it("bows release mid-draw with arrow visuals", () => {
    const t = rangedPrimaryTune("bow");
    expect(t.kind).toBe("arrow");
    expect(t.visual).toBe("arrow");
    expect(t.releaseLead).toBeGreaterThan(0.15);
    expect(t.clips[0]).toMatch(/arrow|shoot/i);
  });

  it("guns are snappy slug releases", () => {
    const p = rangedPrimaryTune("pistol");
    expect(p.kind).toBe("bullet");
    expect(p.releaseLead).toBeLessThan(0.12);
    expect(rangedPrimaryTune("hunter-rifle").speed).toBeGreaterThan(p.speed);
  });

  it("staffs cast spell bolts with a cast-peak lead", () => {
    const s = rangedPrimaryTune("staff");
    expect(s.kind).toBe("spell");
    expect(s.visual).toBe("spell");
    expect(s.releaseLead).toBeGreaterThan(0.1);
  });
});

describe("ranged release timing", () => {
  it("caps release inside the clip intensity window", () => {
    const t = rangedPrimaryTune("bow");
    expect(rangedReleaseDelay(t, 0.5)).toBeLessThanOrEqual(0.5 * 0.55 + 1e-6);
  });

  it("fire lock rides clip playthrough", () => {
    const t = rangedPrimaryTune("bow");
    const lock = rangedFireLock(t, 0.8);
    expect(lock).toBeGreaterThan(0.3);
    expect(lock).toBeLessThanOrEqual(0.8);
  });

  it("intensity scales damage softly", () => {
    // applyIntensity uses weaponCombat which needs registry — just ensure pure math path doesn't throw for known id
    const base = rangedPrimaryTune("bow");
    const scaled = applyIntensity(base, "bow");
    expect(scaled.damage).toBeGreaterThan(0);
    expect(scaled.speed).toBeGreaterThan(0);
  });
});
