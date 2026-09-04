import { describe, expect, it } from "vitest";
import {
  catchEntry,
  safeReturnUrl,
  isBlockedReturnHost,
  isAllowedReturnHost,
  startUrlForIntent,
  GRUDOX_ONLY_CABINETS,
  PRODUCT_STARTS,
} from "./entryCatch";

describe("entryCatch", () => {
  it("redirects GRUDOX-only cabinets off Open", () => {
    const r = catchEntry({
      pathname: "/arcade/play/racer",
      search: "",
    });
    expect(r.kind).toBe("hard_redirect");
    if (r.kind === "hard_redirect") {
      expect(r.url).toContain("grudox.grudge-studio.com/arcade/play/racer");
      expect(r.url).toContain("open=1");
    }
  });

  it("sends lava/molten paths to Magma Core crawl", () => {
    for (const path of ["/lava", "/molten", "/magma-core"]) {
      const r = catchEntry({ pathname: path, search: "" });
      expect(r.kind).toBe("hard_redirect");
      if (r.kind === "hard_redirect") {
        expect(r.url).toContain("grudge-dungeons.vercel.app");
        expect(r.url).toContain("theme=molten");
        expect(r.url).toContain("linear=1");
      }
    }
  });

  it("maps explorer arcade to GRUDOX voxel Danger", () => {
    const r = catchEntry({ pathname: "/arcade/play/explorer", search: "" });
    expect(r.kind).toBe("hard_redirect");
    if (r.kind === "hard_redirect") {
      expect(r.url).toContain("grudox.grudge-studio.com/voxgrudge/tvs-showcase.html");
      expect(r.url).toContain("era=voxel");
    }
  });

  it("startUrlForIntent grudoxDanger is voxel showcase", () => {
    expect(startUrlForIntent("grudoxDanger")).toContain("/voxgrudge/tvs-showcase.html");
  });

  it("startUrlForIntent studio products stay on fleet hosts", () => {
    expect(startUrlForIntent("studio")).toBe(PRODUCT_STARTS.studioPortal);
    expect(startUrlForIntent("ai")).toBe(PRODUCT_STARTS.aiHub);
    expect(startUrlForIntent("coder")).toBe(PRODUCT_STARTS.coder);
    expect(startUrlForIntent("wallet")).toBe(PRODUCT_STARTS.wallet);
    expect(startUrlForIntent("uiStudio")).toContain("ui.grudge-studio.com");
    expect(startUrlForIntent("uiHotkeys")).toContain("/hotkeys");
    expect(startUrlForIntent("uiAssets")).toContain("/assets");
    expect(startUrlForIntent("account")).toContain("open.grudge-studio.com");
    expect(startUrlForIntent("account")).toMatch(/account/);
  });

  it("sends foundry create intent off Open", () => {
    const r = catchEntry({ pathname: "/", search: "?mode=create" });
    expect(r.kind).toBe("hard_redirect");
    if (r.kind === "hard_redirect") {
      expect(r.url).toContain("character.grudge-studio.com/foundry");
      expect(r.url).toContain("returnTo=");
    }
  });

  it("door=characters wins over from=charactersgrudox (campfire, not account)", () => {
    const r = catchEntry({
      pathname: "/",
      search: "?door=characters&from=charactersgrudox&characterId=abc",
    });
    expect(r.kind).toBe("mode");
    if (r.kind === "mode") expect(r.mode).toBe("characters");
  });

  it("/characters path is campfire hub", () => {
    const r = catchEntry({
      pathname: "/characters",
      search: "?from=foundry",
    });
    expect(r.kind).toBe("mode");
    if (r.kind === "mode") expect(r.mode).toBe("characters");
  });

  it("foundry handoff without campfire path → account hub", () => {
    const r = catchEntry({
      pathname: "/danger",
      search: "?from=foundry&characterId=abc",
    });
    expect(r.kind).toBe("mode");
    if (r.kind === "mode") expect(r.mode).toBe("account");
  });

  it("from=charactersgrudox on hub → campfire", () => {
    const r = catchEntry({
      pathname: "/",
      search: "?from=charactersgrudox&characterId=abc",
    });
    expect(r.kind).toBe("mode");
    if (r.kind === "mode") expect(r.mode).toBe("characters");
  });

  it("sends home-island to Warlords client", () => {
    const r = catchEntry({
      pathname: "/home-island",
      search: "?characterId=x1",
    });
    expect(r.kind).toBe("hard_redirect");
    if (r.kind === "hard_redirect") {
      expect(r.url).toContain("client.grudge-studio.com/home-island");
      expect(r.url).toContain("characterId=x1");
    }
  });

  it("does not treat Open /world as Warlords world", () => {
    const r = catchEntry({ pathname: "/world", search: "" });
    // stay or defer — not hard redirect to warlords
    expect(r.kind).not.toBe("hard_redirect");
  });

  it("purges legacy /game to Mine-Loader islands", () => {
    const r = catchEntry({ pathname: "/game", search: "" });
    expect(r.kind).toBe("hard_redirect");
    if (r.kind === "hard_redirect") {
      expect(r.url).toContain("mineloader.grudge-studio.com");
      expect(r.url).toContain("entry=islands");
      expect(r.url).toContain("from=open-game-purge");
    }
  });

  it("startUrlForIntent islands → Mine-Loader", () => {
    const u = startUrlForIntent("islands", { characterId: "c1" });
    expect(u).toContain("mineloader.grudge-studio.com");
    expect(u).toContain("characterId=c1");
  });

  it("skips login landing when session present", () => {
    const r = catchEntry({
      pathname: "/login",
      search: "",
      hasSession: true,
    });
    expect(r.kind).toBe("mode");
    if (r.kind === "mode") expect(r.mode).toBe("doors");
  });

  it("unknown path → doors", () => {
    const r = catchEntry({ pathname: "/totally-fake-surface", search: "" });
    expect(r.kind).toBe("mode");
    if (r.kind === "mode") expect(r.mode).toBe("doors");
  });

  it("blocks character.* as return host", () => {
    expect(isBlockedReturnHost("character.grudge-studio.com")).toBe(true);
    expect(isAllowedReturnHost("character.grudge-studio.com")).toBe(false);
  });

  it("safeReturnUrl rejects id hub and foundry", () => {
    expect(safeReturnUrl("https://id.grudge-studio.com/login")).toBe(
      PRODUCT_STARTS.openHub,
    );
    const r = safeReturnUrl("https://character.grudge-studio.com/foundry");
    expect(r).toBe(PRODUCT_STARTS.account);
  });

  it("safeReturnUrl allows open host", () => {
    const u = safeReturnUrl("https://open.grudge-studio.com/danger");
    expect(u).toContain("open.grudge-studio.com/danger");
  });

  it("startUrlForIntent builds correct starts", () => {
    expect(startUrlForIntent("danger")).toContain("/danger");
    expect(startUrlForIntent("grokBuilder")).toContain("grok-builder");
    expect(startUrlForIntent("threeFlow")).toContain("threeflow");
    expect(startUrlForIntent("mimic")).toContain("/mimic");
    expect(startUrlForIntent("dungeon")).toBe("https://grudge-dungeons.vercel.app/");
    expect(startUrlForIntent("dungeonBoss")).toContain("linear=1");
    expect(startUrlForIntent("dungeonMolten")).toContain("theme=molten");
    expect(startUrlForIntent("dungeonMolten")).toContain("linear=1");
    expect(startUrlForIntent("arcadeCabinet", { cabinetId: "racer" })).toContain(
      "grudox.grudge-studio.com",
    );
    expect(GRUDOX_ONLY_CABINETS.has("racer")).toBe(true);
    expect(GRUDOX_ONLY_CABINETS.has("brawler")).toBe(true);
    expect(startUrlForIntent("realms")).toContain("mine");
    expect(startUrlForIntent("forge")).toContain("forge.grudge-studio.com");
    expect(startUrlForIntent("threeFlow")).toContain("threeflow");
  });

  it("sends Open /realms to Mine-Loader (voxel play)", () => {
    const r = catchEntry({ pathname: "/realms", search: "" });
    expect(r.kind).toBe("hard_redirect");
    if (r.kind === "hard_redirect") {
      expect(r.url).toMatch(/mine/i);
    }
  });
});
