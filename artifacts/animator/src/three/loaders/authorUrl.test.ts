import { describe, expect, it } from "vitest";
import { rewriteAuthorResourceUrl } from "./authorUrl";

describe("rewriteAuthorResourceUrl", () => {
  it("rewrites concatenated Windows VoxelAssets texture URIs to a data pixel", () => {
    const u =
      "anim/animations/reactions/D:/VoxelAssets/DungeonCrawlerCharacters/Exports/Content/Textures/DungeonCrawler_Character.png";
    const out = rewriteAuthorResourceUrl(u);
    expect(out.startsWith("data:image/png")).toBe(true);
  });

  it("rewrites bare Windows drive paths", () => {
    const out = rewriteAuthorResourceUrl(
      "D:/VoxelAssets/DungeonCrawlerCharacters/Exports/Content/Textures/DungeonCrawler_Character.png",
    );
    expect(out.startsWith("data:image/png")).toBe(true);
  });

  it("leaves http and same-origin URLs alone", () => {
    expect(rewriteAuthorResourceUrl("https://open.grudge-studio.com/models/vol.glb")).toBe(
      "https://open.grudge-studio.com/models/vol.glb",
    );
    expect(rewriteAuthorResourceUrl("/anim/animations/reactions/stunned.fbx")).toBe(
      "/anim/animations/reactions/stunned.fbx",
    );
  });
});
