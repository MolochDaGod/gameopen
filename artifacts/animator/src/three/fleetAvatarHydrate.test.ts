import { describe, expect, it } from "vitest";
import { applyRoleAliases, FLEET_REQUIRED_ROLES, missingFleetRoles } from "./fleetAvatarHydrate";

describe("fleetAvatarHydrate", () => {
  it("lists required roles for controller parity", () => {
    expect(FLEET_REQUIRED_ROLES).toContain("idle");
    expect(FLEET_REQUIRED_ROLES).toContain("climb");
    expect(FLEET_REQUIRED_ROLES).toContain("swim");
    expect(FLEET_REQUIRED_ROLES).toContain("attack");
  });

  it("missingFleetRoles finds gaps", () => {
    const has = new Set(["idle", "walk"]);
    const miss = missingFleetRoles((r) => has.has(r));
    expect(miss).toContain("run");
    expect(miss).toContain("climb");
    expect(miss).not.toContain("idle");
  });

  it("applyRoleAliases fills sprint from run", () => {
    const roles = new Map<string, string>([["run", "run"]]);
    const actions = new Set(["run"]);
    const applied = applyRoleAliases(
      (n) => actions.has(n),
      (role, key) => {
        roles.set(role, key);
      },
      (r) => roles.has(r),
    );
    expect(applied.some((a) => a.startsWith("sprint"))).toBe(true);
    expect(roles.get("sprint")).toBe("run");
  });
});
