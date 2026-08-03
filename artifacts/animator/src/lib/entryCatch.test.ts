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

  it("maps explorer arcade to Open danger", () => {
    const r = catchEntry({ pathname: "/arcade/play/explorer", search: "" });
    expect(r.kind).toBe("mode");
    if (r.kind === "mode") expect(r.mode).toBe("danger");
  });

  it("sends foundry create intent off Open", () => {
    const r = catchEntry({ pathname: "/", search: "?mode=create" });
    expect(r.kind).toBe("hard_redirect");
    if (r.kind === "hard_redirect") {
      expect(r.url).toContain("character.grudge-studio.com/foundry");
      expect(r.url).toContain("returnTo=");
    }
  });

  it("hands charactersgrudox to account hub", () => {
    const r = catchEntry({
      pathname: "/danger",
      search: "?from=charactersgrudox&characterId=abc",
    });
    expect(r.kind).toBe("mode");
    if (r.kind === "mode") expect(r.mode).toBe("account");
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
    expect(startUrlForIntent("arcadeCabinet", { cabinetId: "racer" })).toContain(
      "grudox.grudge-studio.com",
    );
    expect(GRUDOX_ONLY_CABINETS.has("racer")).toBe(true);
  });
});
