/**
 * Node-env smoke: CSS2D needs a real DOM; construction is covered in Danger play.
 * Keep this lean (vitest node + no happy-dom) per animator OOM-safe config.
 */
import { describe, expect, it } from "vitest";
import { HtmlOverlaySystem } from "./HtmlOverlaySystem";
import type { FloatKind, WorldLabelKind } from "./HtmlOverlaySystem";

describe("HtmlOverlaySystem module", () => {
  it("exports production overlay class + kind unions", () => {
    expect(typeof HtmlOverlaySystem).toBe("function");
    const floatKinds: FloatKind[] = ["damage", "heal", "crit", "block", "miss", "stamina"];
    const labelKinds: WorldLabelKind[] = [
      "label",
      "building",
      "portal",
      "enter",
      "exit",
      "npc",
      "hostile",
      "claim",
      "interact",
    ];
    expect(floatKinds.length).toBe(6);
    expect(labelKinds.length).toBe(9);
  });
});
