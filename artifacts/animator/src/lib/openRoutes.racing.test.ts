import { describe, expect, it } from "vitest";
import { resolveModeFromLocation } from "./openRoutes";

describe("street racing routes", () => {
  it("resolves the canonical racing path", () => {
    expect(resolveModeFromLocation("/racing", "")).toBe("racing");
  });

  it.each(["/street-racing", "/raver", "/raver-racing"])(
    "resolves %s as the racing surface",
    (pathname) => {
      expect(resolveModeFromLocation(pathname, "")).toBe("racing");
    },
  );
});