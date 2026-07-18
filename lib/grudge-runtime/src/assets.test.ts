import { describe, expect, it } from "vitest";
import { animPath, resolveAssetUrl, resolveAssetUrlPreferLocal } from "./assets";

describe("assets", () => {
  it("keeps absolute urls", () => {
    expect(resolveAssetUrl("https://cdn.example/a.glb")).toBe("https://cdn.example/a.glb");
  });

  it("joins cdn base", () => {
    expect(
      resolveAssetUrl("models/grudge/wk.glb", { cdnBase: "https://assets.grudge-studio.com" }),
    ).toBe("https://assets.grudge-studio.com/models/grudge/wk.glb");
  });

  it("prefers local public path", () => {
    expect(resolveAssetUrlPreferLocal("anim/sword/a.fbx", { preferLocal: true })).toBe(
      "/anim/sword/a.fbx",
    );
  });

  it("builds anim path", () => {
    expect(animPath("sword/slash.fbx")).toBe("anim/sword/slash.fbx");
  });
});
