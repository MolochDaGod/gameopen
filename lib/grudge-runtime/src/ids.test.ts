import { describe, expect, it } from "vitest";
import {
  detectIdKind,
  encodeWirePlayerName,
  decodeWirePlayerName,
  isCharacterId,
  newGrudgeId,
  newUuid,
} from "./ids";

describe("ids", () => {
  it("mints unique uuids", () => {
    const a = newUuid();
    const b = newUuid();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(8);
  });

  it("mints typed grudge ids", () => {
    const e = newGrudgeId("entity");
    expect(e.startsWith("ent_")).toBe(true);
    expect(detectIdKind(e)).toBe("entity");
  });

  it("detects character prefixes", () => {
    expect(detectIdKind("char_abc")).toBe("character");
    expect(detectIdKind("HERO-1")).toBe("hero");
    expect(isCharacterId("char_x")).toBe(true);
    expect(isCharacterId("guest")).toBe(true);
  });

  it("round-trips wire player name", () => {
    const w = encodeWirePlayerName("Ada", "char_1", "fleet-9");
    const d = decodeWirePlayerName(w);
    expect(d.displayName).toBe("Ada");
    expect(d.characterId).toBe("char_1");
    expect(d.fleetId).toBe("fleet-9");
  });
});
