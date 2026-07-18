/**
 * Camp / voxel outdoor hostiles — forest creeps for sailtest + forest-map.
 * Spawns textured GLB enemies around claim center; simple chase + contact damage.
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { fitCharacterHeight } from "../fitCharacterHeight";
import {
  expandCampSpawns,
  loadForestCreepCatalog,
  type ForestCreepCatalog,
  type ForestCreepUnit,
} from "./forestCreepCatalog";

export type CampEnemy = {
  id: string;
  unitId: string;
  root: THREE.Object3D;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  atkReach: number;
  atkCd: number;
  xp: number;
  buffOnKill: string | null;
  dead: boolean;
};

export type CampEnemyCallbacks = {
  flash?: (msg: string, t?: number) => void;
  onKill?: (enemy: CampEnemy, xp: number, buffId: string | null) => void;
  /** Damage player (Studio spar). */
  damagePlayer?: (amount: number, from: THREE.Vector3) => void;
};

export class CampEnemySystem {
  readonly group = new THREE.Group();
  private enemies: CampEnemy[] = [];
  private cat: ForestCreepCatalog | null = null;
  private templateCache = new Map<string, THREE.Object3D>();
  private readonly cbs: CampEnemyCallbacks;
  private nextId = 1;

  constructor(scene: THREE.Scene, cbs: CampEnemyCallbacks = {}) {
    this.cbs = cbs;
    this.group.name = "CampEnemySystem";
    scene.add(this.group);
  }

  get list(): readonly CampEnemy[] {
    return this.enemies;
  }

  clear() {
    for (const e of this.enemies) this.group.remove(e.root);
    this.enemies = [];
  }

  async spawnVoxelCamp(center: THREE.Vector3): Promise<number> {
    this.clear();
    this.cat = await loadForestCreepCatalog();
    const spawns = expandCampSpawns(this.cat, "voxel_camp", {
      x: center.x,
      z: center.z,
    });
    let n = 0;
    for (const s of spawns) {
      const ok = await this.spawnOne(s.unit, s.x, center.y, s.z);
      if (ok) n++;
    }
    this.cbs.flash?.(`CAMP HOSTILES · ${n} forest creeps`, 1.2);
    return n;
  }

  /**
   * Island events / neutral nodes — Golem_Free + Elf_Free packs.
   * campId: island_golem_node | island_elf_raid | island_iron_elite
   */
  async spawnIslandEventNodes(
    nodes: Array<{
      x: number;
      y: number;
      z: number;
      campId?: "island_golem_node" | "island_elf_raid" | "island_iron_elite";
    }>,
  ): Promise<number> {
    // Do not clear — append to tribes already spawned
    this.cat = await loadForestCreepCatalog();
    let n = 0;
    for (const node of nodes) {
      const campId = node.campId || "island_golem_node";
      const campDef = this.cat.camps[campId];
      if (!campDef) continue;
      const spawns = expandCampSpawns(this.cat, campId, { x: node.x, z: node.z });
      for (const s of spawns) {
        const ok = await this.spawnOne(s.unit, s.x, node.y, s.z);
        if (ok) n++;
      }
    }
    this.cbs.flash?.(`ISLAND EVENTS · ${n} golem/elf hostiles`, 1.3);
    return n;
  }

  /**
   * Island Life: Orc tribe + outlaw camps anchored at red-mushroom world positions.
   * Units use converted polyart GLBs (Orc_Free / Bandits_Free).
   */
  async spawnIslandMushroomTribes(
    camps: Array<{ x: number; y: number; z: number; tribe: "orc_tribe" | "outlaw_camp" }>,
  ): Promise<number> {
    this.clear();
    this.cat = await loadForestCreepCatalog();
    let n = 0;
    for (const camp of camps) {
      const campId = camp.tribe === "orc_tribe" ? "island_orc_tribe" : "island_outlaw_camp";
      // Prefer catalog camps; fall back to explicit unit lists
      const campDef = this.cat.camps[campId];
      if (campDef) {
        const spawns = expandCampSpawns(this.cat, campId, { x: camp.x, z: camp.z });
        for (const s of spawns) {
          const ok = await this.spawnOne(s.unit, s.x, camp.y, s.z);
          if (ok) n++;
        }
      } else {
        const unitIds =
          camp.tribe === "orc_tribe"
            ? ["orc_ash_walker", "orc_bone_whittler", "orc_ironbound"]
            : ["bandit_thug", "bandit_poacher", "bandit_scavenger"];
        for (let i = 0; i < unitIds.length; i++) {
          const unit = this.cat.units.find((u) => u.id === unitIds[i]);
          if (!unit) continue;
          const a = (i / unitIds.length) * Math.PI * 2;
          const r = 3 + i * 1.2;
          const ok = await this.spawnOne(
            unit,
            camp.x + Math.cos(a) * r,
            camp.y,
            camp.z + Math.sin(a) * r,
          );
          if (ok) n++;
        }
      }
    }
    this.cbs.flash?.(`ISLAND TRIBES · ${n} hostiles near red mushrooms`, 1.4);
    return n;
  }

  private async spawnOne(
    unit: ForestCreepUnit,
    x: number,
    y: number,
    z: number,
  ): Promise<boolean> {
    try {
      let tpl = this.templateCache.get(unit.id);
      if (!tpl) {
        const { scene } = await loadGltfFirst(unit.meshKeys, sharedGltfLoader(), {
          prepMaterials: true,
        });
        fitCharacterHeight(scene, unit.heightM);
        this.templateCache.set(unit.id, scene);
        tpl = scene;
      }
      const root = tpl.clone(true);
      root.position.set(x, y, z);
      root.name = `camp-enemy:${unit.id}`;
      root.userData.campEnemy = true;
      root.userData.unitId = unit.id;
      root.userData.selectable = "hostile";
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      this.group.add(root);
      this.enemies.push({
        id: `ce_${this.nextId++}`,
        unitId: unit.id,
        root,
        hp: unit.hp,
        maxHp: unit.hp,
        speed: unit.speed,
        damage: unit.damage,
        atkReach: unit.atkReach,
        atkCd: 0,
        xp: unit.xp,
        buffOnKill: unit.buffOnKill,
        dead: false,
      });
      return true;
    } catch (err) {
      console.warn("[CampEnemy] spawn fail", unit.id, err);
      return false;
    }
  }

  /** Chase player + contact damage. */
  update(dt: number, playerPos: THREE.Vector3 | null) {
    if (!playerPos) return;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.atkCd = Math.max(0, e.atkCd - dt);
      const p = e.root.position;
      const dx = playerPos.x - p.x;
      const dz = playerPos.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.15) {
        const nx = dx / dist;
        const nz = dz / dist;
        p.x += nx * e.speed * dt;
        p.z += nz * e.speed * dt;
        e.root.rotation.y = Math.atan2(nx, nz);
      }
      if (dist < e.atkReach && e.atkCd <= 0) {
        e.atkCd = 1.1;
        this.cbs.damagePlayer?.(e.damage, p.clone());
      }
    }
  }

  /** Apply damage from player attacks in radius. */
  damageInRadius(center: THREE.Vector3, radius: number, dmg: number): number {
    let kills = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.root.position.distanceTo(center) > radius) continue;
      e.hp -= dmg;
      if (e.hp <= 0) {
        e.dead = true;
        e.root.visible = false;
        kills++;
        this.cbs.onKill?.(e, e.xp, e.buffOnKill);
        this.cbs.flash?.(
          `KILL · ${e.unitId} · +${e.xp} XP${e.buffOnKill ? ` · ${e.buffOnKill}` : ""}`,
          0.8,
        );
      }
    }
    return kills;
  }

  /** Positions for tower AI etc. */
  livingPositions(): THREE.Vector3[] {
    return this.enemies.filter((e) => !e.dead).map((e) => e.root.position.clone());
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
  }
}
