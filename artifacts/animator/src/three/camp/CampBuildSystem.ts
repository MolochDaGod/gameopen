/**
 * Camp build system — placeable ghosts, claim radius, commit place.
 *
 * LMB while ghost active commits. Esc / cancel clears. Claim-gated items
 * require a planted claim_flag within radius.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  CLAIM_FLAG_PLACEABLE,
  getPlaceable,
  snapToGrid,
  type PlaceableDef,
  type PlacedStructure,
} from "./placeables";

const gltfLoader = new GLTFLoader();
const meshCache = new Map<string, THREE.Object3D>();

async function loadMeshTemplate(url: string): Promise<THREE.Object3D | null> {
  const hit = meshCache.get(url);
  if (hit) return hit.clone(true);
  try {
    const gltf = await gltfLoader.loadAsync(url);
    const root = gltf.scene;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    meshCache.set(url, root);
    return root.clone(true);
  } catch {
    return null;
  }
}

function makeBoxGhost(def: PlaceableDef, valid: boolean): THREE.Object3D {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(def.footprint.x * 2, def.footprint.y, def.footprint.z * 2);
  const mat = new THREE.MeshStandardMaterial({
    color: valid ? def.ghostColor : 0xff3333,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    emissive: valid ? def.ghostColor : 0xff0000,
    emissiveIntensity: 0.25,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = def.footprint.y * 0.5;
  g.add(mesh);
  // Ground ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(def.footprint.x, def.footprint.z) * 1.1, Math.max(def.footprint.x, def.footprint.z) * 1.25, 32),
    new THREE.MeshBasicMaterial({
      color: valid ? 0x6ee7b7 : 0xff5555,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(ring);
  return g;
}

export type CampBuildCallbacks = {
  flash?: (msg: string, t?: number) => void;
  onPlaced?: (s: PlacedStructure) => void;
  /** Player world position for claim-radius checks. */
  getPlayerPos?: () => THREE.Vector3;
};

export class CampBuildSystem {
  readonly group = new THREE.Group();
  private ghost: THREE.Object3D | null = null;
  private activeDef: PlaceableDef | null = null;
  private yaw = 0;
  private valid = true;
  private placed: PlacedStructure[] = [];
  private placedMeshes = new Map<string, THREE.Object3D>();
  private claimCenters: THREE.Vector3[] = [];
  private claimRadius = CLAIM_FLAG_PLACEABLE.footprint
    ? 48
    : 48;
  private readonly cbs: CampBuildCallbacks;

  constructor(scene: THREE.Scene, cbs: CampBuildCallbacks = {}) {
    this.cbs = cbs;
    this.group.name = "CampBuildSystem";
    scene.add(this.group);
  }

  get isGhostActive(): boolean {
    return !!this.activeDef;
  }

  get activePlaceableId(): string | null {
    return this.activeDef?.id ?? null;
  }

  get structures(): readonly PlacedStructure[] {
    return this.placed;
  }

  get hasClaim(): boolean {
    return this.claimCenters.length > 0;
  }

  setClaimRadius(r: number) {
    this.claimRadius = Math.max(8, r);
  }

  /**
   * Begin ghost placement for a placeable id.
   * Loads mesh async when available; box ghost until then.
   */
  beginPlace(placeableId: string): boolean {
    const def = getPlaceable(placeableId);
    if (!def) {
      this.cbs.flash?.(`Unknown placeable: ${placeableId}`, 1.2);
      return false;
    }
    this.cancelGhost();
    this.activeDef = def;
    this.yaw = 0;
    this.valid = this.canPlaceAt(new THREE.Vector3(), def);
    this.ghost = makeBoxGhost(def, this.valid);
    this.group.add(this.ghost);
    this.cbs.flash?.(
      def.claimGated
        ? `GHOST · ${def.name} · claim required · LMB place · R rotate · Esc cancel`
        : `GHOST · ${def.name} · LMB place · R rotate · Esc cancel`,
      1.4,
    );
    if (def.meshUrl) {
      void loadMeshTemplate(def.meshUrl).then((tpl) => {
        if (!tpl || this.activeDef?.id !== def.id) return;
        // Tint mesh as ghost
        tpl.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          m.material = mats.map((mat) => {
            const c = (mat as THREE.MeshStandardMaterial).clone?.() ?? mat;
            if ((c as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              const s = c as THREE.MeshStandardMaterial;
              s.transparent = true;
              s.opacity = 0.55;
              s.depthWrite = false;
              s.emissive = new THREE.Color(def.ghostColor);
              s.emissiveIntensity = 0.2;
            }
            return c;
          }) as unknown as THREE.Material;
        });
        // Replace box with mesh, keep ring
        if (this.ghost) {
          const ring = this.ghost.children.find(
            (c) => (c as THREE.Mesh).geometry?.type === "RingGeometry",
          );
          this.group.remove(this.ghost);
          this.ghost = new THREE.Group();
          this.ghost.add(tpl);
          if (ring) this.ghost.add(ring.clone());
          this.group.add(this.ghost);
        }
      });
    }
    return true;
  }

  cancelGhost() {
    if (this.ghost) {
      this.group.remove(this.ghost);
      this.ghost = null;
    }
    this.activeDef = null;
  }

  rotateGhost(deltaRad = Math.PI / 4) {
    this.yaw += deltaRad;
    if (this.ghost) this.ghost.rotation.y = this.yaw;
  }

  /**
   * Update ghost position from aim point (player forward place point).
   */
  updateGhost(worldPos: THREE.Vector3) {
    if (!this.ghost || !this.activeDef) return;
    const snap = this.activeDef.snap;
    const x = snapToGrid(worldPos.x, snap);
    const z = snapToGrid(worldPos.z, snap);
    const y = worldPos.y;
    this.ghost.position.set(x, y, z);
    this.ghost.rotation.y = this.yaw;
    this.valid = this.canPlaceAt(this.ghost.position, this.activeDef);
    // Tint ring / box by validity
    this.ghost.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const s = mat as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
        if ("emissive" in s && s.emissive) {
          s.emissive.setHex(this.valid ? this.activeDef!.ghostColor : 0xff3333);
        }
        if ("color" in s && s.color && (m.geometry as THREE.BufferGeometry)?.type === "RingGeometry") {
          s.color.setHex(this.valid ? 0x6ee7b7 : 0xff5555);
        }
      }
    });
  }

  canPlaceAt(pos: THREE.Vector3, def: PlaceableDef): boolean {
    if (!def.claimGated) return true;
    if (this.claimCenters.length === 0) return false;
    for (const c of this.claimCenters) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      if (dx * dx + dz * dz <= this.claimRadius * this.claimRadius) return true;
    }
    return false;
  }

  /** Commit ghost to world. Returns placed structure or null. */
  commitPlace(): PlacedStructure | null {
    if (!this.activeDef || !this.ghost) return null;
    const def = this.activeDef;
    const pos = this.ghost.position.clone();
    if (!this.canPlaceAt(pos, def)) {
      this.cbs.flash?.(
        def.claimGated
          ? "Need claim flag build rights in this area"
          : "Cannot place here",
        1.2,
      );
      return null;
    }
    const instanceId = `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const structure: PlacedStructure = {
      instanceId,
      placeableId: def.id,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw: this.yaw,
      placedAt: Date.now(),
    };
    this.placed.push(structure);
    void this.spawnSolid(def, structure);
    if (def.id === "claim_flag") {
      this.claimCenters.push(new THREE.Vector3(pos.x, pos.y, pos.z));
      this.cbs.flash?.(`CLAIM PLANTED · build rights ${this.claimRadius}m`, 1.6);
    } else {
      this.cbs.flash?.(`PLACED · ${def.name}`, 0.8);
    }
    this.cbs.onPlaced?.(structure);
    this.cancelGhost();
    return structure;
  }

  private async spawnSolid(def: PlaceableDef, s: PlacedStructure) {
    let root: THREE.Object3D | null = null;
    if (def.meshUrl) {
      root = await loadMeshTemplate(def.meshUrl);
    }
    if (!root) {
      // Solid procedural stand-in
      const geo = new THREE.BoxGeometry(def.footprint.x * 2, def.footprint.y, def.footprint.z * 2);
      const mat = new THREE.MeshStandardMaterial({
        color: def.ghostColor,
        roughness: 0.75,
        metalness: 0.1,
      });
      root = new THREE.Mesh(geo, mat);
      root.position.y = def.footprint.y * 0.5;
      const wrap = new THREE.Group();
      wrap.add(root);
      root = wrap;
    }
    root.position.set(s.x, s.y, s.z);
    root.rotation.y = s.yaw;
    root.name = `placeable:${s.placeableId}:${s.instanceId}`;
    this.group.add(root);
    this.placedMeshes.set(s.instanceId, root);
  }

  /** Seed a claim at origin for Danger Room sandbox (so gated build works). */
  seedSandboxClaim(at?: THREE.Vector3) {
    const p = at?.clone() ?? new THREE.Vector3(0, 0, -6);
    if (this.claimCenters.length === 0) {
      // Place a claim flag solid without ghost
      const def = CLAIM_FLAG_PLACEABLE;
      const structure: PlacedStructure = {
        instanceId: "pl_sandbox_claim",
        placeableId: def.id,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: 0,
        placedAt: Date.now(),
      };
      this.placed.push(structure);
      this.claimCenters.push(p.clone());
      void this.spawnSolid(def, structure);
    }
  }

  dispose() {
    this.cancelGhost();
    this.group.removeFromParent();
    this.placedMeshes.clear();
    this.placed = [];
    this.claimCenters = [];
  }
}
