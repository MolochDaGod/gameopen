import { describe, expect, it } from "vitest";
import {
  isMixamoClipPath,
  markMixamoPackMissing,
  mixamoPackKnownPresent,
} from "./mixamoPackAvailability";

describe("mixamoPackAvailability", () => {
  it("classifies Mixamo clip paths", () => {
    expect(isMixamoClipPath("anim/animations/bow/unarmed-idle-01.fbx")).toBe(true);
    expect(isMixamoClipPath("animations/sword/run-with-sword.fbx")).toBe(true);
    expect(isMixamoClipPath("anim/bow/idle.fbx")).toBe(true);
    expect(isMixamoClipPath("anim/base/animated-base-character.glb")).toBe(false);
    expect(isMixamoClipPath("models/grudge6/races/BRB_Characters.fbx")).toBe(false);
  });

  it("mark missing flips known state", () => {
    markMixamoPackMissing();
    expect(mixamoPackKnownPresent()).toBe(false);
  });
});
