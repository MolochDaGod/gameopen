import { describe, expect, it } from "vitest";
import {
  buildHoldGraph,
  pickFootHoldAfterHands,
  pickNextHandHold,
  seedClimbPose,
  stepClimbLocomotion,
  validateHandAboveFeet,
  type ClimbHold,
} from "./climbHolds";

function gridWall(wall: ClimbHold["wall"] = "opposite"): ClimbHold[] {
  const holds: ClimbHold[] = [];
  let i = 0;
  for (let x = -2; x <= 2; x++) {
    for (let y = 0; y <= 5; y++) {
      holds.push({
        id: `h${i++}`,
        x,
        y,
        z: -15,
        nx: 0,
        ny: 0,
        nz: 1,
        source: "t",
        wall,
      });
    }
  }
  return holds;
}

describe("climbHolds", () => {
  it("builds graph with neighbour edges", () => {
    const holds = gridWall();
    const g = buildHoldGraph(holds, 1.2);
    const mid = holds.find((h) => h.x === 0 && h.y === 2)!;
    expect((g.get(mid.id) ?? []).length).toBeGreaterThan(2);
  });

  it("hands stay above feet after step", () => {
    const holds = gridWall();
    let state = seedClimbPose(holds, "opposite", { x: 0, y: 1.5, z: -15 });
    for (let i = 0; i < 6; i++) {
      state = stepClimbLocomotion(
        holds,
        state,
        i % 2 === 0 ? "leftHand" : "rightHand",
        1.5 + i * 0.2,
      );
    }
    expect(validateHandAboveFeet(holds, state, 0.3)).toBe(true);
  });

  it("pickNextHandHold prefers upward holds", () => {
    const holds = gridWall();
    const cur = holds.find((h) => h.x === 0 && h.y === 1)!;
    const next = pickNextHandHold(holds, cur, "rightHand", 1);
    expect(next).toBeTruthy();
    expect(next!.y).toBeGreaterThanOrEqual(cur.y);
  });

  it("foot pick stays under hands", () => {
    const holds = gridWall();
    const left = holds.find((h) => h.x === -1 && h.y === 3)!;
    const right = holds.find((h) => h.x === 1 && h.y === 3)!;
    // Drag from a nearby foot (y=2) within footReach of holds under hands
    const foot = pickFootHoldAfterHands(
      holds,
      { left, right },
      holds.find((h) => h.x === -1 && h.y === 2)!,
      "leftFoot",
    );
    expect(foot).toBeTruthy();
    expect(foot!.y).toBeLessThan(Math.min(left.y, right.y) - 0.3);
  });
});
