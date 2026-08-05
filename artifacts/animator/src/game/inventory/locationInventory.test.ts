import { describe, expect, it, beforeEach } from "vitest";
import {
  campLocationId,
  depositToLocation,
  ensureCampStorage,
  ensureHiddenLootStorage,
  homeIslandLocationId,
  loadLocationStorage,
  markLockBusted,
  newLocationStorage,
  canAccessLocationWithoutLockpick,
  transferLocationToHomeIsland,
} from "./locationInventory";
import { resolveDepositContext, resolveDepositDestination } from "./depositZones";
import {
  createLockpickSession,
  attemptLockpickTumble,
  setLockpickPinAngle,
  pinInSweetZone,
  rollLockpickInstant,
} from "./lockpick";
import { newItemInstance } from "./types";

describe("location inventory (Albion)", () => {
  beforeEach(() => {
    // isolate keys used in tests
    try {
      localStorage.removeItem(`grudge:loc-inv:v1:${campLocationId("test_claim")}`);
      localStorage.removeItem(`grudge:loc-inv:v1:${homeIslandLocationId("acct1")}`);
    } catch {
      /* jsdom */
    }
  });

  it("routes claim deposit to camp storage id", () => {
    const dest = resolveDepositDestination({
      x: 0,
      y: 0,
      z: 0,
      insideClaim: true,
      claimKey: "test_claim",
      accountId: "acct1",
    });
    expect(dest.kind).toBe("camp");
    expect(dest.locationId).toBe("camp:test_claim");
  });

  it("routes home island to shared bag", () => {
    const dest = resolveDepositDestination({
      x: 0,
      y: 0,
      z: 0,
      onHomeIsland: true,
      accountId: "acct1",
    });
    expect(dest.kind).toBe("home_island");
    expect(dest.locationId).toBe("home:acct1");
  });

  it("deposit context exposes send-to-home on camp", () => {
    const ctx = resolveDepositContext({
      x: 0,
      y: 0,
      z: 0,
      nearCamp: true,
      claimKey: "c1",
    });
    expect(ctx.canDeposit).toBe(true);
    expect(ctx.canSendToHome).toBe(true);
    expect(ctx.destination?.kind).toBe("camp");
  });

  it("stores materials at camp until sent home", async () => {
    let st = ensureCampStorage("test_claim", "acct1");
    st = depositToLocation(st, [newItemInstance("wood", 40)]);
    expect(st.resources.wood).toBe(40);
    const res = await transferLocationToHomeIsland({
      storage: st,
      accountId: "acct1",
    });
    expect(res.ok).toBe(true);
    expect(res.storage.resources.wood).toBeUndefined();
    expect(res.account.resources.wood).toBeGreaterThanOrEqual(40);
  });

  it("owner skips lockpick; foreign needs bust", () => {
    const st = newLocationStorage("camp:x", "camp", {
      ownerAccountId: "owner",
      lockDifficulty: 50,
    });
    expect(canAccessLocationWithoutLockpick(st, "owner")).toBe(true);
    expect(canAccessLocationWithoutLockpick(st, "thief")).toBe(false);
    const busted = markLockBusted(st);
    expect(canAccessLocationWithoutLockpick(busted, "thief")).toBe(true);
  });

  it("hidden treasure has lock difficulty", () => {
    const st = ensureHiddenLootStorage({
      pinId: "pin_1",
      kind: "hidden_treasure",
      seedLoot: [newItemInstance("ore", 5)],
    });
    expect(st.kind).toBe("hidden_treasure");
    expect(st.lockDifficulty).toBeGreaterThan(0);
    expect(st.resources.ore).toBe(5);
  });
});

describe("lockpick", () => {
  it("succeeds when pin in sweet zone and tumble", () => {
    let s = createLockpickSession({
      targetId: "hchest:1",
      kind: "hidden_chest",
      difficulty: 10,
      label: "Test",
      seed: 42,
    });
    s = setLockpickPinAngle(s, s.sweetAngle);
    expect(pinInSweetZone(s)).toBe(true);
    s = { ...s, holdProgress: 0.9 };
    s = attemptLockpickTumble(s);
    expect(s.status).toBe("success");
  });

  it("instant roll respects bounds", () => {
    let hits = 0;
    for (let i = 0; i < 40; i++) {
      if (rollLockpickInstant({ difficulty: 20, skillLevel: 20, rand: () => 0.1 })) {
        hits++;
      }
    }
    expect(hits).toBe(40);
  });
});
