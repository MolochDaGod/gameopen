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

  it("does not put a voxel-era hero on the Toon kit — Mixamo explorer instead", () => {
    const p = resolveDangerPlayable({
      search: "?era=voxel",
      fleetCharacter: {
        id: "00000000-0000-4000-8000-0000000000bb",
        name: "Block",
        raceId: "human",
        gameEra: "voxel",
        config: { baseId: "explorer" },
      },
    });
    expect(p.era).toBe("voxel");
    expect(p.lane).toBe("mixamo-explorer");
    expect(p.spec.studioAvatarId).toBe("explorer");
    expect(p.displayName).toBe("Block");
  });

  it("?era=voxel without fleet still boots explorer", () => {
    const p = resolveDangerPlayable({ search: "?era=voxel" });
    expect(p.lane).toBe("mixamo-explorer");
    expect(p.spec.studioAvatarId).toBe("explorer");
  });
});
