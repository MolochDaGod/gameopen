import { describe, expect, it } from "vitest";
import {
  advanceBeamSession,
  beamLaunchUpVel,
  beamProfileForWeapon,
  clampBeamRadius,
  createBeamSession,
  pointOnBeamSegment,
  BEAM_PROFILES,
} from "../beamCast";

describe("beamCast", () => {
  it("clamps radius to 0.1–1 m", () => {
    expect(clampBeamRadius(0.01)).toBe(0.1);
    expect(clampBeamRadius(0.45)).toBe(0.45);
    expect(clampBeamRadius(2)).toBe(1);
  });

  it("maps weapons to distinct profiles", () => {
    expect(beamProfileForWeapon("staffFire").id).toBe("staff_fire");
    expect(beamProfileForWeapon("staffIce").physics).toBe("stun");
    expect(beamProfileForWeapon("staffStorm").physics).toBe("launch");
    expect(beamProfileForWeapon("staffFire").physics).toBe("explode");
    expect(beamProfileForWeapon("tome").physics).toBe("ragdoll");
    expect(beamProfileForWeapon("pistol").id).toBe("gun_beam");
    expect(beamProfileForWeapon("scythe").id).toBe("twohand_cast");
  });

  it("freezes normalized dir on session create", () => {
    const s = createBeamSession(
      BEAM_PROFILES.staff_default!,
      { x: 0, y: 1, z: 0 },
      { x: 3, y: 0, z: 4 },
      1,
    );
    expect(s.phase).toBe("charge");
    expect(s.dir.x).toBeCloseTo(0.6);
    expect(s.dir.z).toBeCloseTo(0.8);
    expect(s.profile.radius).toBeGreaterThanOrEqual(0.1);
    expect(s.profile.radius).toBeLessThanOrEqual(1);
  });

  it("advances charge → beam → done with tick flags", () => {
    const s = createBeamSession(
      {
        ...BEAM_PROFILES.wand!,
        castTime: 0.4,
        beamLife: 0.5,
        tickInterval: 0.1,
      },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
      1,
    );
    let r = advanceBeamSession(s, 0.2);
    expect(r.enteredBeam).toBe(false);
    expect(s.phase).toBe("charge");

    r = advanceBeamSession(s, 0.25);
    expect(r.enteredBeam).toBe(true);
    expect(s.phase).toBe("beam");

    // Force a tick
    r = advanceBeamSession(s, 0.12);
    expect(r.shouldTick).toBe(true);

    // Finish beam life
    r = advanceBeamSession(s, 1.0);
    expect(r.done).toBe(true);
    expect(s.phase).toBe("done");
  });

  it("detects points on the beam segment cylinder", () => {
    const origin = { x: 0, y: 1, z: 0 };
    const dir = { x: 0, y: 0, z: 1 };
    const hit = pointOnBeamSegment(origin, dir, 10, { x: 0.2, y: 1, z: 5 }, 0.5);
    expect(hit).not.toBeNull();
    expect(hit!.proj).toBeCloseTo(5);

    const miss = pointOnBeamSegment(origin, dir, 10, { x: 2, y: 1, z: 5 }, 0.5);
    expect(miss).toBeNull();

    const behind = pointOnBeamSegment(origin, dir, 10, { x: 0, y: 1, z: -2 }, 0.5);
    expect(behind).toBeNull();
  });

  it("maps physics modes to launch up-vel (ragdoll/explode clean ≥8)", () => {
    expect(beamLaunchUpVel(BEAM_PROFILES.staff_fire!)).toBeGreaterThanOrEqual(8.5);
    expect(beamLaunchUpVel(BEAM_PROFILES.tome!)).toBeGreaterThanOrEqual(9);
    expect(beamLaunchUpVel(BEAM_PROFILES.staff_storm!)).toBeGreaterThanOrEqual(6.5);
  });
});
