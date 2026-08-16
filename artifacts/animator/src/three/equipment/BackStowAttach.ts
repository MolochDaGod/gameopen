/**
 * Stow a back-slot GLB on the spine (Casting windsurf pack, shark fin).
 * Same family as WingBackRig / Casting BackSlotEquip — not a second attach system.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { prepObjectMaterials } from "../texturePrep";
import { applyToonStyle } from "../materials/toonStyle";
import { applyGameLayer } from "../gameplay/GamePlayLayers";
import { findBackBone } from "./WingBackRig";

const BASE = import.meta.env.BASE_URL || "/";

export class BackStowAttach {
  readonly group = new THREE.Group();
  private root: THREE.Object3D | null = null;
  private loadedUrl: string | null = null;

  attachToCharacter(
    characterRoot: THREE.Object3D,
    pose?: { offset?: [number, number, number]; eulerDeg?: [number, number, number] },
  ): void {
    const bone = findBackBone(characterRoot) || characterRoot;
    this.group.removeFromParent();
    bone.add(this.group);
    const off = pose?.offset ?? [0.02, 0.06, -0.14];
    const e = pose?.eulerDeg ?? [8, 180, 0];
    this.group.position.set(off[0], off[1], off[2]);
    this.group.rotation.set(
      THREE.MathUtils.degToRad(e[0] || 0),
      THREE.MathUtils.degToRad(e[1] || 0),
      THREE.MathUtils.degToRad(e[2] || 0),
    );
  }

  async show(url: string, stowLengthM = 0.58): Promise<boolean> {
    const resolved = url.startsWith("http") || url.startsWith("/") ? url : `${BASE}${url}`;
    if (this.loadedUrl === resolved && this.root) {
      this.group.visible = true;
      return true;
    }
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(resolved);
      this.clearRoot();
      this.root = gltf.scene;
      this.root.name = "BackStow";
      prepObjectMaterials(this.root, { neutralizeMetal: true });
      applyToonStyle(this.root, { outline: false, steps: 4 });
      applyGameLayer(this.root, "prop");
      this.group.add(this.root);
      this.normalizeLength(stowLengthM);
      this.loadedUrl = resolved;
      this.group.visible = true;
      return true;
    } catch (e) {
      console.warn("[BackStowAttach] load failed", url, e);
      this.group.visible = false;
      return false;
    }
  }

  hide(): void {
    this.group.visible = false;
  }

  private normalizeLength(targetM: number): void {
    if (!this.root) return;
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z, 0.01);
    const s = targetM / longest;
    if (Number.isFinite(s) && s > 0 && s < 50) this.group.scale.setScalar(s);
  }

  private clearRoot(): void {
    if (this.root) this.root.removeFromParent();
    this.root = null;
    this.loadedUrl = null;
  }

  dispose(): void {
    this.clearRoot();
    this.group.removeFromParent();
  }
}
