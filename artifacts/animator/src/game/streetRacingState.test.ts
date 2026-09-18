import { describe, expect, it } from "vitest";
import {
  CHECKPOINTS_PER_LAP,
  LAP_DISTANCE,
  RACE_DISTANCE,
  raceProgress,
} from "./streetRacingState";

describe("street racing progress", () => {
  it("starts on lap one at checkpoint one", () => {
    expect(raceProgress(0)).toEqual({ lap: 1, checkpoint: 1, finished: false });
  });

  it("resets checkpoints at each lap boundary", () => {
    expect(raceProgress(LAP_DISTANCE - 1).checkpoint).toBe(CHECKPOINTS_PER_LAP);
    expect(raceProgress(LAP_DISTANCE)).toEqual({ lap: 2, checkpoint: 1, finished: false });
  });

  it("finishes at the race distance", () => {
    expect(raceProgress(RACE_DISTANCE)).toEqual({
      lap: 3,
      checkpoint: CHECKPOINTS_PER_LAP,
      finished: true,
    });
  });

  it("clamps negative distances to the start", () => {
    expect(raceProgress(-100)).toEqual({ lap: 1, checkpoint: 1, finished: false });
  });
});
