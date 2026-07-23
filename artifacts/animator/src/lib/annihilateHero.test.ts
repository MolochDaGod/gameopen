import { describe, expect, it } from "vitest";
import { parseAnnihilateHero, formatHandBoneReport } from "./annihilateHero";

describe("parseAnnihilateHero", () => {
  it("parses elf_worge → grudge:high-elves:unarmed + mesh_ids", () => {
    const s = parseAnnihilateHero("elf_worge");
    expect(s).not.toBeNull();
    expect(s!.raceId).toBe("high-elves");
    expect(s!.presetId).toBe("unarmed");
    expect(s!.studioAvatarId).toBe("grudge:high-elves:unarmed");
    expect(s!.classKey).toBe("worge");
    expect(s!.animPack).toBe("unarmed");
    expect(s!.weaponFamily).toBe("unarmed");
    expect(s!.weaponId).toBe("none");
    expect(s!.meshIds.length).toBeGreaterThan(0);
    expect(s!.meshIds.some((m) => /ELF_/i.test(m))).toBe(true);
  });

  it("parses wk_warrior → warrior preset (polearm pack on WK)", () => {
    const s = parseAnnihilateHero("wk_warrior");
    expect(s!.raceId).toBe("western-kingdoms");
    expect(s!.studioAvatarId).toBe("grudge:western-kingdoms:warrior");
    expect(s!.presetId).toBe("warrior");
    expect(s!.meshIds.length).toBeGreaterThan(0);
  });

  it("parses high-elves/mage and orc_ranger", () => {
    expect(parseAnnihilateHero("high-elves/mage")!.studioAvatarId).toBe("grudge:high-elves:mage");
    expect(parseAnnihilateHero("high-elves/mage")!.animPack).toBe("magic");
    expect(parseAnnihilateHero("orc_ranger")!.animPack).toBe("longbow");
  });

  it("returns null for unknown race", () => {
    expect(parseAnnihilateHero("blob_worge")).toBeNull();
  });
});

describe("formatHandBoneReport", () => {
  it("lists sockets when present", () => {
    expect(
      formatHandBoneReport({
        containerR: "R_hand_container",
        handR: "Bip001 R Hand",
      }),
    ).toContain("R-socket");
  });

  it("warns when empty", () => {
    expect(formatHandBoneReport({})).toMatch(/NO HAND/);
  });
});
