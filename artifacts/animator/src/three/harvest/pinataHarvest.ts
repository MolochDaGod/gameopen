/**
 * Pinata-style harvest nodes — HP stages, tool match, break → chunks/yield.
 * Minimal production stub so Danger Room / ForestWorld can register meshes.
 */
import * as THREE from "three";

export const DANGER_RESPAWN_SEC = 45;

export type HarvestToolNorm = "axe" | "pick" | "gather" | "any" | string;

export function normalizeHarvestTool(id?: string): HarvestToolNorm {
  const s = String(id || "any").toLowerCase();
  if (/axe|hatchet|log|chop|wood/.test(s)) return "axe";
  if (/pick|mine|ore/.test(s)) return "pick";
  if (/knife|skin/.test(s)) return "knife";
  if (/hoe|farm/.test(s)) return "hoe";
  if (/shovel|dig|terrain/.test(s)) return "shovel";
  if (/bucket|water/.test(s)) return "bucket";
  if (/fish|rod|pole/.test(s)) return "fish";
  if (/gather|hand|sickle|forage|herb|flower/.test(s)) return "gather";
  return s || "any";
}

export interface PinataNode {
  id: string;
  kind: string;
  tool: string;
  hp: number;
  maxHp: number;
  mesh: THREE.Object3D;
  broken: boolean;
}

export interface PinataHitResult {
  hit: boolean;
  broken: boolean;
  hp: number;
  maxHp: number;
  reason?: string;
}

export interface ColliderPlan {
  id: string;
  position: THREE.Vector3;
  halfExtents: THREE.Vector3;
  mesh?: THREE.Object3D;
}

export interface PinataHarvestOpts {
  flash?: (msg: string, t?: number) => void;
  getCharacterId?: () => string;
  getUnitAbsorbPos?: () => THREE.Vector3 | null;
  isUnitAbsorbing?: () => boolean;
  onBreak?: (id: string) => void;
  onRespawn?: (id: string) => void;
}

export class PinataHarvestSystem {
  private scene: THREE.Scene;
  private opts: PinataHarvestOpts;
  private nodes = new Map<string, PinataNode>();
  private respawnSec = DANGER_RESPAWN_SEC;
  private playerPos = new THREE.Vector3();
  private groundSampler: ((x: number, z: number) => number | null) | null = null;
  private respawnTimers = new Map<string, number>();

  constructor(scene: THREE.Scene, opts: PinataHarvestOpts = {}) {
    this.scene = scene;
    this.opts = opts;
  }

  setDefaultRespawnSec(sec: number) {
    this.respawnSec = Math.max(1, sec);
  }

  setPlayerPos(p: THREE.Vector3) {
    this.playerPos.copy(p);
  }

  setGroundSampler(fn: ((x: number, z: number) => number | null) | null) {
    this.groundSampler = fn;
  }

  /**
   * Drop all registered harvest nodes (map switch / restore Danger Room).
   * Does not dispose meshes owned by ForestWorld — only unregisters pinata state.
   * Studio calls this from activateDangerRoomInstance / setTestWorld.
   */
  clear(): void {
    for (const n of this.nodes.values()) {
      if (n.mesh?.userData) delete n.mesh.userData.harvestId;
      // Leave mesh visibility to map instance (chamber restore / outdoor clear)
    }
    this.nodes.clear();
    this.respawnTimers.clear();
  }

  registerMesh(
    mesh: THREE.Object3D,
    meta: {
      id: string;
      kind?: string;
      tool?: string;
      hp?: number;
      /** Optional material id for bag yield (ignored if unknown). */
      materialId?: string;
    },
  ) {
    const maxHp = meta.hp ?? 40;
    const node: PinataNode = {
      id: meta.id,
      kind: meta.kind || "forage",
      tool: meta.tool || "any",
      hp: maxHp,
      maxHp,
      mesh,
      broken: false,
    };
    mesh.userData.harvestId = meta.id;
    if (meta.materialId) mesh.userData.harvestMaterialId = meta.materialId;
    mesh.visible = true;
    this.nodes.set(meta.id, node);
  }

  getNode(id: string): PinataNode | undefined {
    return this.nodes.get(id);
  }

  hitForestNode(id: string, tool: HarvestToolNorm, power: number): PinataHitResult {
    const n = this.nodes.get(id);
    if (!n || n.broken) return { hit: false, broken: false, hp: 0, maxHp: 0, reason: "missing" };
    // Tool soft match — wrong tool still chips at 50%
    const match =
      n.tool === "any" ||
      tool === "any" ||
      n.tool === tool ||
      normalizeHarvestTool(n.tool) === tool;
    const dmg = Math.max(1, Math.floor(power * (match ? 1 : 0.5)));
    n.hp = Math.max(0, n.hp - dmg);
    this.opts.flash?.(
      match ? `HIT ${n.kind} −${dmg}` : `WEAK HIT ${n.kind} −${dmg}`,
      0.35,
    );
    if (n.hp <= 0) {
      n.broken = true;
      n.mesh.visible = false;
      this.opts.onBreak?.(id);
      this.respawnTimers.set(id, this.respawnSec);
      this.opts.flash?.(`BREAK · ${n.kind}`, 0.8);
      return { hit: true, broken: true, hp: 0, maxHp: n.maxHp };
    }
    return { hit: true, broken: false, hp: n.hp, maxHp: n.maxHp };
  }

  colliderPlans(): ColliderPlan[] {
    const out: ColliderPlan[] = [];
    for (const n of this.nodes.values()) {
      if (n.broken) continue;
      const box = new THREE.Box3().setFromObject(n.mesh);
      if (box.isEmpty()) continue;
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      out.push({
        id: n.id,
        position: center,
        halfExtents: size.multiplyScalar(0.5),
        mesh: n.mesh,
      });
    }
    return out;
  }

  update(dt: number) {
    for (const [id, left] of [...this.respawnTimers.entries()]) {
      const next = left - dt;
      if (next <= 0) {
        this.respawnTimers.delete(id);
        const n = this.nodes.get(id);
        if (n) {
          n.broken = false;
          n.hp = n.maxHp;
          n.mesh.visible = true;
          if (this.groundSampler) {
            const p = new THREE.Vector3();
            n.mesh.getWorldPosition(p);
            const y = this.groundSampler(p.x, p.z);
            if (y != null) n.mesh.position.y = y;
          }
          this.opts.onRespawn?.(id);
        }
      } else {
        this.respawnTimers.set(id, next);
      }
    }
  }
}
