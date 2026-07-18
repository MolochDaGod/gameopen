/**
 * Camp build system — placeable ghosts, claim radius, commit place, runtime.
 *
 * Ghost: blue-tinted clone of the real mesh (box fallback).
 * Solid: full textures + AnimationMixer (doors/gates) + tower/trap/npc hooks.
 *
 * LMB while ghost active commits. Esc / cancel clears. Claim-gated items
 * require a planted claim_flag within radius.
 */

import * as THREE from "three";
import {
  CLAIM_FLAG_PLACEABLE,
  GHOST_BLUE,
  GHOST_RED,
  getPlaceable,
  snapToGrid,
  type PlaceableDef,
  type PlacedStructure,
} from "./placeables";
import { loadCampWorld, loadPlaceableMesh, placeableIconUrl } from "./loadCampAsset";
import { getCampAssetBinding } from "./campAssetCatalog";

/** Cache cloned templates after first fleet load (by placeableId). */
type CachedMesh = { scene: THREE.Object3D; clips: THREE.AnimationClip[]; url: string };
const meshCache = new Map<string, CachedMesh>();

async function loadCanonicalPlaceable(
  placeableId: string,
  def?: PlaceableDef,
): Promise<CachedMesh | null> {
  const hit = meshCache.get(placeableId);
  if (hit) {
    return {
      scene: hit.scene.clone(true),
      clips: hit.clips,
      url: hit.url,
    };
  }
  // Always prep textures for cache (ghost clones are re-tinted after clone)
  const loaded = await loadPlaceableMesh(placeableId, {
    fallbackMeshUrl: def?.meshUrl,
    meshScale: def?.meshScale,
    skipPrep: false,
  });
  if (!loaded) return null;
  loaded.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  meshCache.set(placeableId, {
    scene: loaded.scene,
    clips: loaded.animations,
    url: loaded.url,
  });
  return {
    scene: loaded.scene.clone(true),
    clips: loaded.animations,
    url: loaded.url,
  };
}

/** Blue (or red invalid) transparent ghost materials on a mesh tree. */
function tintGhost(root: THREE.Object3D, hex: number) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    m.material = mats.map((mat) => {
      const base =
        (mat as THREE.MeshStandardMaterial).clone?.() ??
        new THREE.MeshStandardMaterial({ color: hex });
      if ((base as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const s = base as THREE.MeshStandardMaterial;
        s.transparent = true;
        s.opacity = 0.48;
        s.depthWrite = false;
        s.color = new THREE.Color(hex);
        s.emissive = new THREE.Color(hex);
        s.emissiveIntensity = 0.55;
        s.metalness = 0.05;
        s.roughness = 0.45;
      } else if ((base as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
        const b = base as THREE.MeshBasicMaterial;
        b.transparent = true;
        b.opacity = 0.48;
        b.color = new THREE.Color(hex);
        b.depthWrite = false;
      }
      return base;
    }) as unknown as THREE.Material;
  });
}

function makeBoxGhost(def: PlaceableDef, valid: boolean): THREE.Object3D {
  const g = new THREE.Group();
  const hex = valid ? GHOST_BLUE : GHOST_RED;
  const geo = new THREE.BoxGeometry(def.footprint.x * 2, def.footprint.y, def.footprint.z * 2);
  const mat = new THREE.MeshStandardMaterial({
    color: hex,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    emissive: new THREE.Color(hex),
    emissiveIntensity: 0.45,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = def.footprint.y * 0.5;
  mesh.name = "ghost-box";
  g.add(mesh);
  g.add(makeGroundRing(def, valid));
  return g;
}

function makeGroundRing(def: PlaceableDef, valid: boolean): THREE.Mesh {
  const r = Math.max(def.footprint.x, def.footprint.z);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 1.05, r * 1.22, 40),
    new THREE.MeshBasicMaterial({
      color: valid ? GHOST_BLUE : GHOST_RED,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.name = "ghost-ring";
  return ring;
}

type RuntimeExtra = {
  mixer?: THREE.AnimationMixer;
  clips?: THREE.AnimationClip[];
  open?: boolean;
  armed?: boolean;
  towerCd?: number;
  trapCd?: number;
  npcRoot?: THREE.Object3D;
  behavior: PlaceableDef["behavior"];
  defId: string;
};

export type CampBuildCallbacks = {
  flash?: (msg: string, t?: number) => void;
  onPlaced?: (s: PlacedStructure) => void;
  getPlayerPos?: () => THREE.Vector3;
  /** Optional damage hook for towers / traps. */
  onAreaDamage?: (pos: THREE.Vector3, radius: number, damage: number, kind: string) => void;
  /** Optional NPC spawn hook (Studio can attach AI). */
  onSpawnNpc?: (at: THREE.Vector3, hint: string, structureId: string) => void;
};

export class CampBuildSystem {
  readonly group = new THREE.Group();
  private islandRoot: THREE.Object3D | null = null;
  private ghost: THREE.Object3D | null = null;
  private activeDef: PlaceableDef | null = null;
  private yaw = 0;
  private valid = true;
  private placed: PlacedStructure[] = [];
  private placedMeshes = new Map<string, THREE.Object3D>();
  private runtime = new Map<string, RuntimeExtra>();
  private claimCenters: THREE.Vector3[] = [];
  private claimRadius = 48;
  private readonly cbs: CampBuildCallbacks;
  private clock = new THREE.Clock(false);

  constructor(scene: THREE.Scene, cbs: CampBuildCallbacks = {}) {
    this.cbs = cbs;
    this.group.name = "CampBuildSystem";
    scene.add(this.group);
    this.clock.start();
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

  /** True when world position is inside any planted claim radius (account deposit zone). */
  isInsideClaim(pos: { x: number; z: number }): boolean {
    if (this.claimCenters.length === 0) return false;
    for (const c of this.claimCenters) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      if (dx * dx + dz * dz <= this.claimRadius * this.claimRadius) return true;
    }
    return false;
  }

  setClaimRadius(r: number) {
    this.claimRadius = Math.max(8, r);
  }

  /**
   * Load small_island (fleet-resolved: local → breeze-island → home island concept)
   * via canonical glTF importer + texture prep.
   */
  async loadSmallIsland(opts?: { y?: number; scale?: number }): Promise<boolean> {
    if (this.islandRoot) return true;
    const loaded = await loadCampWorld("small_island");
    if (!loaded) {
      this.cbs.flash?.("Small island GLB missing (fleet)", 1.2);
      return false;
    }
    const root = loaded.scene;
    if (opts?.scale && opts.scale !== 1) root.scale.multiplyScalar(opts.scale);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const yOff = opts?.y ?? -box.min.y;
    root.position.set(0, yOff, 0);
    root.name = "small_island";
    root.userData.assetType = "world";
    root.userData.importer = loaded.importer;
    root.userData.sourceUrl = loaded.url;
    root.traverse((o) => {
      o.userData.campIsland = true;
      o.userData.selectable = "ground";
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.receiveShadow = true;
        m.castShadow = true;
      }
    });
    this.group.add(root);
    this.islandRoot = root;
    this.cbs.flash?.(`ISLAND · ${loaded.url.split("/").pop()}`, 1.4);
    return true;
  }

  /**
   * Begin ghost placement for a placeable id.
   * Loads mesh async; blue ghost of the actual asset when ready.
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
        ? `GHOST · ${def.name} · blue = ok · LMB place · R rotate · Esc cancel`
        : `GHOST · ${def.name} · LMB place · R rotate · Esc cancel`,
      1.4,
    );
    // Canonical mesh: fleet load + blue ghost tint of the real asset
    const binding = getCampAssetBinding(def.id);
    if (binding?.importer !== "procedural" || def.meshUrl) {
      void loadCanonicalPlaceable(def.id, def).then((mesh) => {
        if (!mesh || this.activeDef?.id !== def.id) return;
        const tpl = mesh.scene;
        tintGhost(tpl, this.valid ? GHOST_BLUE : GHOST_RED);
        if (this.ghost) {
          const ring = this.ghost.children.find((c) => c.name === "ghost-ring");
          this.group.remove(this.ghost);
          this.ghost = new THREE.Group();
          this.ghost.name = "place-ghost";
          this.ghost.userData.sourceUrl = mesh.url;
          this.ghost.userData.assetType = binding?.assetType ?? "prop";
          this.ghost.add(tpl);
          if (ring) this.ghost.add(ring.clone());
          else this.ghost.add(makeGroundRing(def, this.valid));
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

  updateGhost(worldPos: THREE.Vector3) {
    if (!this.ghost || !this.activeDef) return;
    const snap = this.activeDef.snap;
    const x = snapToGrid(worldPos.x, snap);
    const z = snapToGrid(worldPos.z, snap);
    const y = worldPos.y;
    this.ghost.position.set(x, y, z);
    this.ghost.rotation.y = this.yaw;
    this.valid = this.canPlaceAt(this.ghost.position, this.activeDef);
    const hex = this.valid ? GHOST_BLUE : GHOST_RED;
    this.ghost.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const s = mat as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
        if ("emissive" in s && s.emissive) s.emissive.setHex(hex);
        if ("color" in s && s.color) s.color.setHex(hex);
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

  commitPlace(): PlacedStructure | null {
    if (!this.activeDef || !this.ghost) return null;
    const def = this.activeDef;
    const pos = this.ghost.position.clone();
    if (!this.canPlaceAt(pos, def)) {
      this.cbs.flash?.(
        def.claimGated ? "Need claim flag build rights in this area" : "Cannot place here",
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
      open: false,
      armed: def.behavior === "trap",
    };
    this.placed.push(structure);
    void this.spawnSolid(def, structure);
    if (def.id === "claim_flag") {
      this.claimCenters.push(new THREE.Vector3(pos.x, pos.y, pos.z));
      this.cbs.flash?.(`CLAIM PLANTED · build rights ${this.claimRadius}m`, 1.6);
    } else {
      this.cbs.flash?.(`DEPLOYED · ${def.name}`, 0.85);
    }
    this.cbs.onPlaced?.(structure);
    this.cancelGhost();
    return structure;
  }

  private async spawnSolid(def: PlaceableDef, s: PlacedStructure) {
    let root: THREE.Object3D | null = null;
    let clips: THREE.AnimationClip[] = [];
    let sourceUrl = "";
    // Production solid: full textures via loadGltfFirst + prepObjectMaterials
    const mesh = await loadCanonicalPlaceable(def.id, def);
    if (mesh) {
      root = mesh.scene;
      clips = mesh.clips;
      sourceUrl = mesh.url;
    }
    if (!root) {
      const geo = new THREE.BoxGeometry(def.footprint.x * 2, def.footprint.y, def.footprint.z * 2);
      const mat = new THREE.MeshStandardMaterial({
        color: def.ghostColor,
        roughness: 0.72,
        metalness: 0.12,
      });
      const box = new THREE.Mesh(geo, mat);
      box.position.y = def.footprint.y * 0.5;
      root = new THREE.Group();
      root.add(box);
      sourceUrl = "procedural";
    }
    // Solid is already height-fitted in local space; place at world snap
    root.position.set(s.x, s.y, s.z);
    root.rotation.y = s.yaw;
    root.name = `placeable:${s.placeableId}:${s.instanceId}`;
    root.userData.placeableId = s.placeableId;
    root.userData.instanceId = s.instanceId;
    root.userData.behavior = def.behavior || "static";
    root.userData.assetType = getCampAssetBinding(def.id)?.assetType ?? "prop";
    root.userData.importer = getCampAssetBinding(def.id)?.importer ?? "gltf";
    root.userData.sourceUrl = sourceUrl;
    root.userData.iconUrl = placeableIconUrl(def.id, def.iconUrl);
    root.userData.selectable =
      def.behavior === "door" || def.behavior === "gate" || def.behavior === "workbench"
        ? "node"
        : "ground";

    const extra: RuntimeExtra = {
      behavior: def.behavior || "static",
      defId: def.id,
      open: false,
      armed: def.behavior === "trap",
      towerCd: 0,
      trapCd: 0,
    };

    if (clips.length > 0) {
      const mixer = new THREE.AnimationMixer(root);
      extra.mixer = mixer;
      extra.clips = clips;
      // Idle / closed pose
      const idle =
        clips.find((c) => /idle|close|closed|rest/i.test(c.name)) || clips[0];
      if (idle) mixer.clipAction(idle).play();
    }

    // NPC marker for production buildings
    if (def.behavior === "npc_spawn") {
      const marker = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 0.9, 4, 8),
        new THREE.MeshStandardMaterial({
          color: 0x6ee7b7,
          roughness: 0.55,
          metalness: 0.15,
          emissive: 0x104030,
          emissiveIntensity: 0.35,
        }),
      );
      marker.position.set(def.footprint.x + 0.8, 0.95, 0);
      marker.name = "npc-standin";
      root.add(marker);
      extra.npcRoot = marker;
      this.cbs.onSpawnNpc?.(
        new THREE.Vector3(s.x + Math.cos(s.yaw) * 2, s.y, s.z + Math.sin(s.yaw) * 2),
        def.npcHint || "melee",
        s.instanceId,
      );
    }

    // Harvest node disc
    if (def.behavior === "harvest_node") {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(
          Math.max(def.footprint.x, def.footprint.z) * 0.9,
          Math.max(def.footprint.x, def.footprint.z) * 0.9,
          0.12,
          24,
        ),
        new THREE.MeshStandardMaterial({
          color: 0x5a8a30,
          roughness: 0.9,
        }),
      );
      disc.position.y = 0.06;
      disc.userData.harvestable = true;
      root.add(disc);
    }

    this.group.add(root);
    this.placedMeshes.set(s.instanceId, root);
    this.runtime.set(s.instanceId, extra);
  }

  /**
   * Per-frame: mixers, tower fire, trap arm.
   * Call from Studio tick with dt.
   */
  update(dt: number, playerPos?: THREE.Vector3, hostiles?: THREE.Vector3[]) {
    for (const [id, rt] of this.runtime) {
      rt.mixer?.update(dt);
      const mesh = this.placedMeshes.get(id);
      if (!mesh) continue;
      const def = getPlaceable(rt.defId);
      if (!def) continue;

      if (rt.behavior === "tower") {
        rt.towerCd = Math.max(0, (rt.towerCd ?? 0) - dt);
        if ((rt.towerCd ?? 0) <= 0 && hostiles && hostiles.length) {
          const origin = mesh.position;
          let best: THREE.Vector3 | null = null;
          let bestD = 14;
          for (const h of hostiles) {
            const d = origin.distanceTo(h);
            if (d < bestD) {
              bestD = d;
              best = h;
            }
          }
          if (best) {
            rt.towerCd = 1.6;
            this.cbs.onAreaDamage?.(best, 1.2, 8, "tower");
            // Visual spin
            mesh.rotation.y += 0.35;
          }
        }
      }

      if (rt.behavior === "trap" && rt.armed) {
        rt.trapCd = Math.max(0, (rt.trapCd ?? 0) - dt);
        if ((rt.trapCd ?? 0) <= 0 && hostiles) {
          for (const h of hostiles) {
            if (mesh.position.distanceTo(h) < 1.4) {
              rt.trapCd = 2.5;
              this.cbs.onAreaDamage?.(h, 1.0, 14, "trap");
              mesh.scale.setScalar(1.08);
              break;
            }
          }
        } else if (mesh.scale.x > 1.001) {
          mesh.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 4));
        }
      }
    }
  }

  /**
   * Interact nearest door/gate/workbench (E key).
   * Returns true if something toggled.
   */
  tryInteract(playerPos: THREE.Vector3, maxDist = 2.8): boolean {
    let bestId: string | null = null;
    let bestD = maxDist;
    for (const [id, mesh] of this.placedMeshes) {
      const rt = this.runtime.get(id);
      if (!rt) continue;
      if (rt.behavior !== "door" && rt.behavior !== "gate" && rt.behavior !== "workbench") continue;
      const d = mesh.position.distanceTo(playerPos);
      if (d < bestD) {
        bestD = d;
        bestId = id;
      }
    }
    if (!bestId) return false;
    const rt = this.runtime.get(bestId)!;
    const mesh = this.placedMeshes.get(bestId)!;
    if (rt.behavior === "workbench") {
      this.cbs.flash?.("Workbench · open Production (P)", 1.0);
      return true;
    }
    // Door / gate toggle
    rt.open = !rt.open;
    const st = this.placed.find((p) => p.instanceId === bestId);
    if (st) st.open = rt.open;
    if (rt.mixer && rt.clips && rt.clips.length) {
      const openClip =
        rt.clips.find((c) => /open/i.test(c.name)) ||
        (rt.open ? rt.clips[0] : rt.clips[rt.clips.length - 1]);
      const closeClip =
        rt.clips.find((c) => /close/i.test(c.name)) || rt.clips[0];
      const clip = rt.open ? openClip : closeClip;
      if (clip) {
        rt.mixer.stopAllAction();
        const action = rt.mixer.clipAction(clip);
        action.reset().setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
      }
    } else {
      // Procedural swing if no clips
      const target = rt.open ? Math.PI / 2 : 0;
      mesh.rotation.y += rt.open ? Math.PI / 2 : -Math.PI / 2;
      void target;
    }
    this.cbs.flash?.(rt.open ? "OPEN" : "CLOSED", 0.45);
    return true;
  }

  seedSandboxClaim(at?: THREE.Vector3) {
    const p = at?.clone() ?? new THREE.Vector3(0, 0, -6);
    if (this.claimCenters.length === 0) {
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
    this.runtime.clear();
    this.placed = [];
    this.claimCenters = [];
    this.islandRoot = null;
  }
}
