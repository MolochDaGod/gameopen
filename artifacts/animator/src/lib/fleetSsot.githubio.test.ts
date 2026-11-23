import { describe, expect, it } from "vitest";
import { contentCandidates, definitionBaseCandidates } from "./fleetSsot";

describe("fleetSsot catalog hosts", () => {
  it("does not fall back to github.io", () => {
    expect(definitionBaseCandidates().join("\n")).not.toMatch(/github\.io/i);
    expect(contentCandidates("master-weaponSkills.json").join("\n")).not.toMatch(/github\.io/i);
  });
});
