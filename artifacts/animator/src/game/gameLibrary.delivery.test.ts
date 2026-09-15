import { describe, expect, it } from "vitest";
import {
  DELIVERY_SHELVES,
  GAME_LIBRARY,
  deliveryShelf,
  getGame,
  libraryByShelf,
} from "./gameLibrary";

describe("Open delivery shelves", () => {
  it("has account / games / editors / content", () => {
    expect(DELIVERY_SHELVES.map((s) => s.id)).toEqual([
      "account",
      "games",
      "editors",
      "content",
    ]);
  });

  it("account hub + foundry land on Account", () => {
    expect(deliveryShelf(getGame("account-hub")!)).toBe("account");
    expect(deliveryShelf(getGame("character-foundry")!)).toBe("account");
    expect(deliveryShelf(getGame("studio-portal")!)).toBe("account");
    expect(deliveryShelf(getGame("ai-legion")!)).toBe("account");
    expect(deliveryShelf(getGame("wallet-hub")!)).toBe("account");
  });

  it("coder lands on Editors", () => {
    expect(deliveryShelf(getGame("coder-ide")!)).toBe("editors");
    expect(deliveryShelf(getGame("ui-hydra")!)).toBe("editors");
  });

  it("editors: grok-builder, threeflow, forge", () => {
    expect(deliveryShelf(getGame("grok-builder")!)).toBe("editors");
    expect(deliveryShelf(getGame("threeflow")!)).toBe("editors");
    expect(deliveryShelf(getGame("forge-editor")!)).toBe("editors");
  });

  it("games shelf includes mimic + danger + grudge-dungeons", () => {
    const ids = libraryByShelf("games").map((g) => g.id);
    expect(ids).toContain("mimic-dungeon");
    expect(ids).toContain("danger-room");
    expect(ids).toContain("grudge-dungeons");
    expect(ids).toContain("magma-core");
    expect(getGame("grudge-dungeons")!.url).toBe("https://grudge-dungeons.vercel.app/");
    expect(getGame("magma-core")!.url).toContain("theme=molten");
    expect(getGame("grudge-dungeons")!.url).toBe("https://grudge-dungeons.vercel.app/");
  });

  it("every library title maps to a shelf", () => {
    for (const g of GAME_LIBRARY) {
      expect(DELIVERY_SHELVES.some((s) => s.id === deliveryShelf(g))).toBe(true);
    }
  });
});
