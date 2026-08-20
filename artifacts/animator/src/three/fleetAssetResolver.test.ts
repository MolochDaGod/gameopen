import { describe, expect, it } from "vitest";
import {
  bufferLooksLikeHtml,
  isGlbMagic,
  resolveAssetCandidates,
} from "./fleetAssetResolver";

describe("fleetAssetResolver", () => {
  it("never lists gameopen.vercel.app or /gameopen/", () => {
    const c = resolveAssetCandidates("models/vfx/orbs/orb-fire.glb");
    expect(c.every((u) => !/gameopen\.vercel\.app/i.test(u))).toBe(true);
    expect(c.every((u) => !/assets\.grudge-studio\.com\/gameopen\//i.test(u))).toBe(true);
  });

  it("same-origin first for models/packs until R2 has the keys", () => {
    const c = resolveAssetCandidates("models/packs/modular-dungeon/assembled-crypt.glb");
    expect(c[0]).not.toContain("assets.grudge-studio.com");
    expect(c[0]).toMatch(/models\/packs\/modular-dungeon\/assembled-crypt\.glb/);
    expect(c.some((u) => u.includes("assets.grudge-studio.com"))).toBe(true);
  });

  it("puts R2 first for models", () => {
    const c = resolveAssetCandidates("models/vol.glb");
    expect(c[0]).toContain("assets.grudge-studio.com/models/vol.glb");
    expect(c.some((u) => /models\/worlds\/vol/.test(u))).toBe(false);
  });

  it("asset-packs stay R2-only", () => {
    const c = resolveAssetCandidates(
      "asset-packs/toon-rts-characters/glb/characters/human.glb",
    );
    expect(c.every((u) => u.includes("assets.grudge-studio.com"))).toBe(true);
    expect(c.length).toBeLessThanOrEqual(2);
  });

  it("detects HTML fake-200 and glTF magic", () => {
    const html = new TextEncoder().encode("<!DOCTYPE html><html>");
    expect(bufferLooksLikeHtml(html.buffer)).toBe(true);
    const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0, 0, 0, 0]);
    expect(isGlbMagic(glb.buffer)).toBe(true);
    expect(bufferLooksLikeHtml(glb.buffer)).toBe(false);
  });
});
