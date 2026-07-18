/**
 * Periodic bandit boat raids for Island Life survival.
 * Voxel boat approaches coast, unloads 3–5 Bandits_Free polyart enemies, they rush base.
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { fitCharacterHeight } from "../fitCharacterHeight";
import {
  DEFAULT_RAID,
  ISLAND_ENEMY_UNITS,
  type RaidConfig,
} from "../../game/islandLife/catalog";
import type { CampEnemy, CampEnemyCallbacks } from "./CampEnemySystem";

const RAIDER_IDS = ["bandit_poacher", "bandit_scavenger", "bandit_thug"] as const;

export class RaiderBoatSystem {
  readonly group = new THREE.Group();
  private boat: THREE.Group | null = null;
  private raiders: CampEnemy[] = [];
  private templateCache = new Map<string, THREE.Object3D>();
  private timer = 0;
  private phase: "idle" | "approach" | "unload" | "raid" = "idle";
  private cfg: RaidConfig;
  private base = new THREE.Vector3(0, 0, 0);
  private nextId = 1;
  private readonly cbs: CampEnemyCallbacks;
  private approachFrom = new THREE.Vector3();
  private approachTo = new THREE.Vector3();
  private approachT = 0;
  private unloadLeft = 0;

  constructor(scene: THREE.Scene, cbs: CampEnemyCallbacks = {}, cfg: Partial<RaidConfig> = {}) {
    this.cbs = cbs;
    this.cfg = { ...DEFAULT_RAID, ...cfg };
    this.group.name = "RaiderBoatSystem";
    scene.add(this.group);
    this.timer = this.cfg.firstDelaySec;
    this.buildBoat();
  }

  setBase(pos: THREE.Vector3) {
    this.base.copy(pos);
  }

  get enemies(): readonly CampEnemy[] {
    return this.raiders;
  }

  private buildBoat() {
    const boat = new THREE.Group();
    boat.name = "voxel_raider_boat";
    // Voxel hull
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.7, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.9 }),
    );
    hull.position.y = 0.35;
    hull.castShadow = true;
    const prow = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.5, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.88 }),
    );
    prow.position.set(2.2, 0.4, 0);
    const mast = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 2.4, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x3a2818 }),
    );
    mast.position.set(0, 1.4, 0);
    const sail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.4, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xc4b89a, roughness: 0.85 }),
    );
    sail.position.set(0.1, 1.6, 0);
    boat.add(hull, prow, mast, sail);
    boat.visible = false;
    this.boat = boat;
    this.group.add(boat);
  }

  /** Call each frame. */
  update(dt: number, playerPos: THREE.Vector3 | null) {
    this.timer -= dt;

    if (this.phase === "idle" && this.timer <= 0) {
      this.beginApproach();
    }

    if (this.phase === "approach" && this.boat) {
      this.approachT += dt / 8; // ~8s sail-in
      const t = Math.min(1, this.approachT);
      this.boat.position.lerpVectors(this.approachFrom, this.approachTo, t);
      this.boat.lookAt(this.base.x, this.boat.position.y, this.base.z);
      if (t >= 1) {
        this.phase = "unload";
        this.unloadLeft = 0.4;
        void this.spawnRaiders();
      }
    }

    if (this.phase === "unload") {
      this.unloadLeft -= dt;
      if (this.unloadLeft <= 0) {
        this.phase = "raid";
        if (this.boat) this.boat.visible = true;
        this.cbs.flash?.(
          `RAIDERS · boat unloaded ${this.raiders.filter((r) => !r.dead).length} bandits!`,
          2,
        );
      }
    }

    // Chase player / base
    if (this.phase === "raid" || this.phase === "unload") {
      const target = playerPos ?? this.base;
      for (const e of this.raiders) {
        if (e.dead) continue;
        e.atkCd = Math.max(0, e.atkCd - dt);
        const p = e.root.position;
        const dx = target.x - p.x;
        const dz = target.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.2) {
          p.x += (dx / dist) * e.speed * dt;
          p.z += (dz / dist) * e.speed * dt;
          e.root.rotation.y = Math.atan2(dx, dz);
        }
        if (playerPos && dist < e.atkReach && e.atkCd <= 0) {
          e.atkCd = 1.05;
          this.cbs.damagePlayer?.(e.damage, p.clone());
        }
      }
      // All dead → sail away + reschedule
      if (this.raiders.length && this.raiders.every((r) => r.dead)) {
        this.endRaid();
      }
    }
  }

  private beginApproach() {
    const angle = Math.random() * Math.PI * 2;
    const dist = this.cfg.approachDistance + 18;
    this.approachFrom.set(
      this.base.x + Math.cos(angle) * dist,
      0.15,
      this.base.z + Math.sin(angle) * dist,
    );
    this.approachTo.set(
      this.base.x + Math.cos(angle) * (this.cfg.approachDistance * 0.45),
      0.15,
      this.base.z + Math.sin(angle) * (this.cfg.approachDistance * 0.45),
    );
    if (this.boat) {
      this.boat.visible = true;
      this.boat.position.copy(this.approachFrom);
    }
    this.approachT = 0;
    this.phase = "approach";
    this.cbs.flash?.("HORIZON · raider boat inbound…", 1.5);
  }

  private async spawnRaiders() {
    // clear living from previous
    for (const r of this.raiders) {
      if (!r.dead) this.group.remove(r.root);
    }
    this.raiders = [];
    const n =
      this.cfg.minRaiders +
      Math.floor(Math.random() * (this.cfg.maxRaiders - this.cfg.minRaiders + 1));
    const land = this.approachTo.clone();
    for (let i = 0; i < n; i++) {
      const id = RAIDER_IDS[i % RAIDER_IDS.length]!;
      const unit = ISLAND_ENEMY_UNITS[id];
      try {
        let tpl = this.templateCache.get(unit.id);
        if (!tpl) {
          const { scene } = await loadGltfFirst([...unit.meshKeys], sharedGltfLoader(), {
            prepMaterials: true,
          });
          fitCharacterHeight(scene, unit.heightM);
          this.templateCache.set(unit.id, scene);
          tpl = scene;
        }
        const root = tpl.clone(true);
        const ox = (Math.random() - 0.5) * 3;
        const oz = (Math.random() - 0.5) * 3;
        root.position.set(land.x + ox, 0, land.z + oz);
        root.name = `raider:${unit.id}`;
        root.userData.campEnemy = true;
        root.userData.unitId = unit.id;
        root.userData.selectable = "hostile";
        this.group.add(root);
        this.raiders.push({
          id: `raid_${this.nextId++}`,
          unitId: unit.id,
          root,
          hp: unit.hp,
          maxHp: unit.hp,
          speed: unit.speed,
          damage: unit.damage,
          atkReach: unit.atkReach,
          atkCd: 0.3 + Math.random() * 0.4,
          xp: unit.xp,
          buffOnKill: null,
          dead: false,
        });
      } catch (err) {
        console.warn("[RaiderBoat] spawn fail", unit.id, err);
        // Capsule fallback
        const root = new THREE.Group();
        const mesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
          new THREE.MeshStandardMaterial({ color: 0x5a3a2a }),
        );
        mesh.position.y = 1;
        root.add(mesh);
        root.position.set(land.x + i, 0, land.z);
        this.group.add(root);
        this.raiders.push({
          id: `raid_${this.nextId++}`,
          unitId: unit.id,
          root,
          hp: unit.hp,
          maxHp: unit.hp,
          speed: unit.speed,
          damage: unit.damage,
          atkReach: unit.atkReach,
          atkCd: 0.5,
          xp: unit.xp,
          buffOnKill: null,
          dead: false,
        });
      }
    }
  }

  private endRaid() {
    this.phase = "idle";
    this.timer = this.cfg.intervalSec * (0.85 + Math.random() * 0.3);
    if (this.boat) this.boat.visible = false;
    this.cbs.flash?.("RAID CLEARED · next boat later…", 1.4);
  }

  damageInRadius(center: THREE.Vector3, radius: number, dmg: number): number {
    let kills = 0;
    for (const e of this.raiders) {
      if (e.dead) continue;
      if (e.root.position.distanceTo(center) > radius) continue;
      e.hp -= dmg;
      if (e.hp <= 0) {
        e.dead = true;
        e.root.visible = false;
        kills++;
        this.cbs.onKill?.(e, e.xp, e.buffOnKill);
      }
    }
    return kills;
  }

  dispose() {
    this.group.removeFromParent();
    this.raiders = [];
  }
}
