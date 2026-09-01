import { describe, expect, it } from "vitest";
import {
  grudgeAvatarId,
  normalizeToGrudgeAvatarId,
  parseGrudgeAvatarId,
  isGrudge6StudioId,
} from "./raceModel";

describe("normalizeToGrudgeAvatarId — Danger/lobby practice SSOT", () => {
  it("keeps canonical grudge: ids", () => {
    expect(normalizeToGrudgeAvatarId("grudge:western-kingdoms:warrior")).toBe(
      "grudge:western-kingdoms:warrior",
    );
  });

  it("maps race-human / race-orc catalog ids to grudge6", () => {
    expect(normalizeToGrudgeAvatarId("race-human")).toBe(
      "grudge:western-kingdoms:warrior",
    );
    expect(normalizeToGrudgeAvatarId("race-orc")).toBe("grudge:orcs:warrior");
    expect(normalizeToGrudgeAvatarId("race-high-elf", "ranger")).toBe(
      "grudge:high-elves:ranger",
    );
  });

  it("maps hyphen hub ids grudge-western-kingdoms-warrior", () => {
    expect(normalizeToGrudgeAvatarId("grudge-western-kingdoms-warrior")).toBe(
      "grudge:western-kingdoms:warrior",
    );
    expect(normalizeToGrudgeAvatarId("grudge-orcs-knight")).toBe(
      "grudge:orcs:knight",
    );
  });

  it("maps bare race keys", () => {
    expect(normalizeToGrudgeAvatarId("orc")).toBe("grudge:orcs:warrior");
    expect(normalizeToGrudgeAvatarId("human", "mage")).toBe(
      "grudge:western-kingdoms:mage",
    );
  });

  it("keeps explorer for voxel only", () => {
    expect(normalizeToGrudgeAvatarId("explorer")).toBe("explorer");
    expect(isGrudge6StudioId("explorer")).toBe(false);
    expect(isGrudge6StudioId("race-human")).toBe(true);
  });

  it("parseGrudgeAvatarId only accepts colon form", () => {
    expect(parseGrudgeAvatarId("grudge:barbarians:warrior")?.raceId).toBe(
      "barbarians",
    );
    expect(parseGrudgeAvatarId("grudge-barbarians-warrior")).toBeNull();
    expect(grudgeAvatarId("barbarians", "warrior")).toBe(
      "grudge:barbarians:warrior",
    );
  });
});
