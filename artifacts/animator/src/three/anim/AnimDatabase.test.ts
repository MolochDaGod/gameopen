import { describe, expect, it } from "vitest";
import { AnimDatabase, getAnimDatabase, bakePathFromRel } from "./AnimDatabase";
import { AnimStateMachine, resolveAnimForSurface } from "./AnimStateMachine";

describe("AnimDatabase", () => {
  const db = getAnimDatabase();

  it("loads embedded registry with packs and clips", () => {
    expect(db.version).toBeGreaterThanOrEqual(1);
    expect(db.listClips().length).toBeGreaterThan(20);
    expect(db.listStates().length).toBeGreaterThan(15);
    expect(db.listPacks().polearm).toBeTruthy();
    expect(db.listPacks().climb).toBeTruthy();
  });

  it("readiness reports ready polearm clips", () => {
    const r = db.readiness();
    expect(r.total).toBeGreaterThan(0);
    expect(r.ready).toBeGreaterThan(0);
    expect(r.byPack.polearm?.ready).toBeGreaterThan(0);
  });

  it("resolves ground loco walk for sword", () => {
    const r = db.resolve({
      stateId: "loco.walk",
      weaponId: "sword",
      surface: "ground",
      activity: "combat",
      speed: 0.4,
    });
    expect(r).toBeTruthy();
    expect(r!.bakeRel || r!.sourceRel).toBeTruthy();
    expect(r!.clip.role).toMatch(/walk|run|idle/);
  });

  it("resolves swim and climb vertical grab clips", () => {
    const swim = db.resolve({ stateId: "loco.swim", surface: "swim", role: "swim" });
    expect(swim?.clip.pack).toBe("swim");
    expect(swim?.sourceRel || swim?.bakeRel).toBeTruthy();

    const hang = db.resolve({
      stateId: "traversal.hang",
      surface: "climb",
      role: "hang",
    });
    expect(hang?.clip.tags?.includes("vertical_grab") || hang?.clip.role).toBeTruthy();

    const mantle = db.resolve({
      stateId: "traversal.mantle",
      surface: "mantle",
      role: "mantle",
    });
    expect(mantle?.clip.role).toMatch(/mantle|climb/);
  });

  it("resolves harvest activity", () => {
    const r = db.resolve({
      stateId: "activity.harvestGather",
      activity: "harvest",
      surface: "ground",
    });
    expect(r?.clip.pack).toMatch(/harvest|unarmed/);
  });

  it("bans run-to-roll loco", () => {
    expect(db.isBannedBake("locomotion/running")).toBe(true);
  });

  it("bakePathFromRel formats JSON path", () => {
    expect(bakePathFromRel("polearm/idle")).toBe("anims/baked/polearm/idle.json");
  });

  it("bakeRelsForWeaponPack returns unique paths for polearm", () => {
    const rels = db.bakeRelsForWeaponPack("polearm");
    expect(rels.some((r) => r.includes("polearm"))).toBe(true);
    expect(rels.some((r) => r.includes("jump") || r.includes("dodge"))).toBe(true);
  });
});

describe("AnimStateMachine", () => {
  it("ticks idle → walk → run from speed", () => {
    const m = new AnimStateMachine();
    const idle = m.tick({
      surface: "ground",
      activity: "combat",
      weaponId: "spear",
      speed: 0,
    });
    expect(idle.stateId).toBe("loco.idle");

    const walk = m.tick({
      surface: "ground",
      activity: "combat",
      weaponId: "spear",
      speed: 0.4,
    });
    expect(walk.stateId).toBe("loco.walk");

    const run = m.tick({
      surface: "ground",
      activity: "combat",
      weaponId: "spear",
      speed: 0.9,
    });
    expect(run.stateId).toBe("loco.run");
  });

  it("maps swim and climb surfaces", () => {
    const m = new AnimStateMachine();
    const swim = m.tick({
      surface: "swim",
      activity: "combat",
      speed: 0.5,
    });
    expect(swim.stateId).toBe("loco.swim");

    const climb = m.tick({
      surface: "climb",
      activity: "combat",
      speed: 0.2,
    });
    expect(climb.stateId).toBe("traversal.climb");
  });

  it("verticalGrab forces hang state", () => {
    const m = new AnimStateMachine();
    const out = m.tick({
      surface: "ground",
      activity: "combat",
      speed: 0,
      verticalGrab: true,
    });
    expect(out.stateId).toBe("traversal.hang");
  });

  it("attack action resolves combat.attack", () => {
    const m = new AnimStateMachine();
    const out = m.requestAction(
      { kind: "attack" },
      { surface: "ground", activity: "combat", weaponId: "spear", speed: 0 },
      1,
    );
    expect(out.stateId).toBe("combat.attack");
    expect(out.oneShot).toBe(true);
    expect(out.resolve?.clip).toBeTruthy();
  });

  it("harvest chop action", () => {
    const m = new AnimStateMachine();
    const out = m.requestAction(
      { kind: "harvest", tool: "chop" },
      { surface: "ground", activity: "harvest", speed: 0 },
      0,
    );
    expect(out.stateId).toBe("activity.harvestChop");
  });

  it("resolveAnimForSurface helper", () => {
    const r = resolveAnimForSurface({
      surface: "wallRun",
      speed: 1,
    });
    expect(r?.clip.role === "wallRun" || r?.clip.pack === "climb" || r).toBeTruthy();
  });
});

describe("AnimDatabase construct from empty", () => {
  it("handles empty db", () => {
    const empty = new AnimDatabase(
      { version: 0, packs: {}, clips: [] },
      { version: 0, states: [] },
    );
    expect(empty.resolve({ role: "idle" })).toBeNull();
  });
});
