import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { isolateNamedChild, physicsForMode } from "./WingBackRig";
import { backSlotItem, codedBackSlotItems } from "./backSlotItems";

describe("dedicated holy / traveler wing catalog", () => {
  it("holy uses the wing_379 drop and traveler has three gorilla tiers", () => {
    const holy = backSlotItem("back_holy_wings");
    expect(holy?.meshUrl).toMatch(/ride\/wings\/holy_wings\.glb$/);
    expect(holy?.wingSpanM).toBeGreaterThan(1);

    const tiers = codedBackSlotItems().filter((i) => i.id.startsWith("back_traveler_wings"));
    expect(tiers.map((t) => t.id)).toEqual([
      "back_traveler_wings",
      "back_traveler_wings_t2",
      "back_traveler_wings_t3",
    ]);
    expect(new Set(tiers.map((t) => t.isolateName)).size).toBe(3);
    expect(tiers.every((t) => t.meshUrl?.includes("traveler_wings_variants.glb"))).toBe(true);
  });

  it("isolateNamedChild keeps one wardrobe sibling", () => {
    const root = new THREE.Group();
    root.name = "GLTF_SceneRootNode";
    const a = new THREE.Group();
    a.name = "FireWings_Wardrobe Variant_2";
    const b = new THREE.Group();
    b.name = "FireWings_Wardrobe Variant.001_5";
    const c = new THREE.Group();
    c.name = "FireWings_Wardrobe Variant.002_8";
    root.add(a, b, c);
    expect(isolateNamedChild(root, "FireWings_Wardrobe Variant.001_5")).toBe(true);
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(true);
    expect(c.visible).toBe(false);
  });

  it("traveler T3 glides farther than T1", () => {
    const t1 = physicsForMode("flight", 1);
    const t3 = physicsForMode("flight", 3);
    expect(t3.glide).toBeGreaterThan(t1.glide);
    expect(t3.lift).toBeGreaterThan(t1.lift);
  });
});
