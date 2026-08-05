import { describe, expect, it } from "vitest";
import { InputActionMap, FLEET_DEFAULT_BINDINGS } from "./inputActions";

describe("InputActionMap", () => {
  it("maps KeyW to move_forward", () => {
    const map = new InputActionMap({ target: null });
    // Simulate without attach
    (map as unknown as { keys: Set<string> }).keys.add("KeyW");
    expect(map.isDown("move_forward")).toBe(true);
    expect(map.moveAxes().z).toBeLessThan(0);
  });

  it("codeMatches uses fleet defaults", () => {
    const map = new InputActionMap({ target: null });
    expect(map.codeMatches("interact", "KeyX")).toBe(true);
    expect(map.codeMatches("interact", "KeyZ")).toBe(false);
    expect(FLEET_DEFAULT_BINDINGS.attack[0]).toEqual({ type: "mouse", button: 0 });
  });

  it("setEnabled clears held state", () => {
    const map = new InputActionMap({ target: null });
    (map as unknown as { keys: Set<string> }).keys.add("KeyW");
    map.setEnabled(false);
    expect(map.isDown("move_forward")).toBe(false);
  });
});
