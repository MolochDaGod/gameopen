import { describe, expect, it } from "vitest";
import { resolveProductionIconUrl } from "./productionMedia";

describe("productionMedia icons", () => {
  it("rewrites github.io icon hosts to the assets CDN", () => {
    const url = resolveProductionIconUrl(
      "https://molochdagod.github.io/ObjectStore/icons/pack/weapons/Sword_01.png",
    );
    expect(url).toBe("https://assets.grudge-studio.com/icons/pack/weapons/Sword_01.png");
  });

  it("resolves relative icon paths on the CDN", () => {
    expect(resolveProductionIconUrl("/icons/pack/weapons/Sword_01.png")).toBe(
      "https://assets.grudge-studio.com/icons/pack/weapons/Sword_01.png",
    );
  });
});
