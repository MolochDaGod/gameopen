/**
 * Unity Player prefab cape variants (Long Cape 1 / Wide Cape 1 / default).
 * Same spine attach as explorer cape — not a second cloth engine.
 */
import * as THREE from "three";
import { findBackBone } from "./WingBackRig";
import { applyGameLayer } from "../gameplay/GamePlayLayers";

export type CapeVariant = "default" | "long" | "wide";

const CAPE_GEO: Record<CapeVariant, { w: number; h: number; d: number; color: number }> = {
  default: { w: 0.5, h: 1.1, d: 0.04, color: 0x1a2740 },
  long: { w: 0.48, h: 1.45, d: 0.04, color: 0x2a1840 },
  wide: { w: 0.78, h: 1.05, d: 0.05, color: 0x1b2746 },
};

export class CapeBackRig {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh | null = null;
  private variant: CapeVariant = "default";

  attachToCharacter(root: THREE.Object3D): void {
    const bone = findBackBone(root) || root;
    this.group.removeFromParent();
    bone.add(this.group);
    this.group.position.set(0, -0.08, -0.14);
    this.group.rotation.set(0.12, 0, 0);
    applyGameLayer(this.group, "prop");
    this.rebuild(this.variant);
  }

  setVariant(v: CapeVariant): void {
    this.variant = v;
    this.rebuild(v);
  }

  setVisible(on: boolean): void {
    this.group.visible = on;
  }

  private rebuild(v: CapeVariant): void {
    if (this.mesh) {
      this.mesh.removeFromParent();
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    const spec = CAPE_GEO[v];
    const geo = new THREE.BoxGeometry(spec.w, spec.h, spec.d);
    const mat = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = `CapeBack_${v}`;
    this.mesh.position.set(0, -spec.h * 0.42, 0);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);
  }

  dispose(): void {
    this.group.removeFromParent();
    if (this.mesh) {
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
    }
    this.mesh = null;
  }
}
