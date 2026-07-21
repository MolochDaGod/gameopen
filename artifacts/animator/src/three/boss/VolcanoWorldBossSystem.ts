/**
 * Spawns Shadow Flame Mantis world boss + ambient ghasts on volcano / Hellmaw /
 * boss-event islands when the context allows it.
 */

import * as THREE from "three";
import type { Vfx } from "../Vfx";
import { ShadowFlameMantisBoss } from "./ShadowFlameMantisBoss";
import { VolcanoGhastMinion } from "./VolcanoGhastMinion";
import {
  HELLMAW_WORLD_BOSS_SPAWN,
  SHADOW_FLAME_MANTIS,
  unitAllowedOn,
  VOLCANO_GHAST,
} from "./volcanoBossCatalog";

export type VolcanoBossContext = {
  archetype?: string;
  sectorId?: string;
  eventTags?: string[];
  /** Island local origin */
  origin?: THREE.Vector3;
};

export type VolcanoBossSystemCbs = {
  flash?: (msg: string, t?: number) => void;
  damagePlayer?: (amount: number, from: THREE.Vector3) => void;
  knockbackPlayer?: (dir: THREE.Vector3, speed: number, hop?: number) => void;
  onBossDeath?: () => void;
};

export class VolcanoWorldBossSystem {
  private boss: ShadowFlameMantisBoss | null = null;
  private ambient: VolcanoGhastMinion[] = [];
  private readonly scene: THREE.Scene;
  private readonly vfx: Vfx | null;
  private readonly cbs: VolcanoBossSystemCbs;

  constructor(scene: THREE.Scene, vfx: Vfx | null = null, cbs: VolcanoBossSystemCbs = {}) {
    this.scene = scene;
    this.vfx = vfx;
    this.cbs = cbs;
  }

  get mantis() {
    return this.boss;
  }

  /**
   * Returns true if this island/sector may host the mantis world boss.
   */
  static allowed(ctx: VolcanoBossContext): boolean {
    return unitAllowedOn(SHADOW_FLAME_MANTIS, ctx);
  }

  /**
   * Spawn world boss if context is volcanic / hellmaw / boss event.
   * Default pin: Hellmaw Depths sector `s`.
   */
  async spawnIfAllowed(ctx: VolcanoBossContext): Promise<boolean> {
    this.clear();
    if (!VolcanoWorldBossSystem.allowed(ctx)) return false;

    const pin = HELLMAW_WORLD_BOSS_SPAWN;
    const o = ctx.origin || new THREE.Vector3();
    const x = o.x + pin.x;
    const y = o.y + pin.y;
    const z = o.z + pin.z;

    this.boss = new ShadowFlameMantisBoss(this.scene, this.vfx, {
      flash: this.cbs.flash,
      damagePlayer: this.cbs.damagePlayer,
      knockbackPlayer: this.cbs.knockbackPlayer,
      onBossDeath: this.cbs.onBossDeath,
    });
    const ok = await this.boss.load(x, y, z);
    if (!ok) {
      this.boss.dispose();
      this.boss = null;
      return false;
    }

    // Ambient caldera ghasts (also allowed on volcano islands alone)
    if (unitAllowedOn(VOLCANO_GHAST, ctx)) {
      for (let i = 0; i < pin.ambientGhastCount; i++) {
        const ang = (i / pin.ambientGhastCount) * Math.PI * 2;
        const gx = x + Math.cos(ang) * pin.ambientGhastRadius;
        const gz = z + Math.sin(ang) * pin.ambientGhastRadius;
        const g = new VolcanoGhastMinion(this.scene, this.vfx, {
          flash: this.cbs.flash,
          damagePlayer: this.cbs.damagePlayer,
        });
        if (await g.load(gx, y + 2.5, gz)) this.ambient.push(g);
        else g.dispose();
      }
    }

    this.cbs.flash?.(
      `WORLD BOSS · ${SHADOW_FLAME_MANTIS.name} · ${ctx.sectorId || ctx.archetype || "volcano"}`,
      2.5,
    );
    return true;
  }

  /** Force spawn for tests / editor (skips allow gate). */
  async spawnForced(x: number, y: number, z: number): Promise<ShadowFlameMantisBoss | null> {
    this.clear();
    this.boss = new ShadowFlameMantisBoss(this.scene, this.vfx, this.cbs);
    const ok = await this.boss.load(x, y, z);
    if (!ok) {
      this.boss.dispose();
      this.boss = null;
    }
    return this.boss;
  }

  update(dt: number, playerPos: THREE.Vector3 | null) {
    this.boss?.update(dt, playerPos);
    for (const g of this.ambient) g.update(dt, playerPos);
  }

  clear() {
    this.boss?.dispose();
    this.boss = null;
    for (const g of this.ambient) g.dispose();
    this.ambient = [];
  }
}
