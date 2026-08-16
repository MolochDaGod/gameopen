import { describe, expect, it } from "vitest";
import { resolveDangerPlayable } from "./dangerPlayableCharacter";

describe("resolveDangerPlayable era gate", () => {
  it("uses fleet Warlords Toon character", () => {
    const p = resolveDangerPlayable({
      search: "",
      fleetCharacter: {
        id: "00000000-0000-4000-8000-0000000000aa",
        name: "Aric",
        raceId: "western-kingdoms",
        classId: "warrior",
        gameEra: "warlords",
        model3d: { renderPipeline: "rts_toon" },
      },
    });
    expect(p.source).toBe("fleet-character");
    expect(p.spec.studioAvatarId).toBe("grudge:western-kingdoms:warrior");
  });

  it("does not put a voxel-era hero on the Toon kit — default WK Toon instead", () => {
    const p = resolveDangerPlayable({
      search: "",
      fleetCharacter: {
        id: "00000000-0000-4000-8000-0000000000bb",
        name: "Block",
        raceId: "human",
        gameEra: "voxel",
        config: { baseId: "explorer" },
      },
    });
    expect(p.source).toBe("default");
    expect(p.spec.studioAvatarId).toBe("grudge:western-kingdoms:warrior");
  });
});
