/**
 * Arc Raiders-like TPS gun feel on top of existing gunCombat loadouts.
 *
 * Host responsibilities:
 *  - Call {@link update} each frame with dt, moving, sprinting, adsHeld, firePressed
 *  - Fire hits via existing Studio gun / projectile path when {@link consumeFire} true
 *  - Drive camera FOV toward {@link desiredFov}
 *
 * Does not own THREE scene — pure state machine for ADS, clip, reserve, spread.
 */
import type { WeaponId } from "../types";
import { gunLoadout, isGunWeapon, type GunLoadout } from "../gunCombat";
import {
  AMMO_STACK_MAX,
  TPS_ARC_RAIDERS,
  ammoTypeForWeaponId,
  defaultReserveForWeapon,
  loadoutForUltimateGun,
  type AmmoTypeId,
  ultimateGunById,
  type UltimateGunDef,
} from "./ultimateGuns";

export interface GunTpsState {
  weaponId: WeaponId | null;
  /** ug_* skin when set */
  skinId: string | null;
  loadout: GunLoadout | null;
  ammoType: AmmoTypeId;
  clip: number;
  reserve: number;
  ads: number;
  reloading: boolean;
  reloadT: number;
  fireCd: number;
  /** Current hip/ads blend spread (radians-ish scalar for aim cone) */
  spread: number;
}

export class GunTpsController {
  private state: GunTpsState = {
    weaponId: null,
    skinId: null,
    loadout: null,
    ammoType: "medium",
    clip: 0,
    reserve: 0,
    ads: 0,
    reloading: false,
    reloadT: 0,
    fireCd: 0,
    spread: 0.04,
  };

  /** Per-type reserve bags (shared across guns of same ammo). */
  private bags: Record<AmmoTypeId, number> = {
    light: 45,
    medium: 60,
    heavy: 16,
    shell: 16,
  };

  get snapshot(): Readonly<GunTpsState> {
    return this.state;
  }

  get desiredFov(): number {
    const a = this.state.ads;
    return THREE_LERP(TPS_ARC_RAIDERS.hipFov, TPS_ARC_RAIDERS.adsFov, a);
  }

  get isAds(): boolean {
    return this.state.ads > 0.55;
  }

  equip(weaponId: WeaponId | null, skinId?: string | null) {
    if (!weaponId || !isGunWeapon(weaponId)) {
      this.state.weaponId = null;
      this.state.skinId = null;
      this.state.loadout = null;
      return;
    }
    this.state.weaponId = weaponId;
    this.state.skinId = skinId ?? null;
    const skin = skinId ? ultimateGunById(skinId) : undefined;
    this.state.loadout = skin
      ? loadoutForUltimateGun(skin)
      : gunLoadout(weaponId);
    this.state.ammoType = skin?.ammo ?? ammoTypeForWeaponId(weaponId);
    const lo = this.state.loadout!;
    this.state.clip = lo.clip;
    // Pull from bag; seed bag if empty
    if (this.bags[this.state.ammoType] <= 0) {
      this.bags[this.state.ammoType] = skin?.reserveDefault ?? defaultReserveForWeapon(weaponId);
    }
    this.state.reserve = this.bags[this.state.ammoType];
    this.state.reloading = false;
    this.state.reloadT = 0;
    this.state.fireCd = 0;
  }

  grantAmmo(ammo: AmmoTypeId, amount: number) {
    const max = AMMO_STACK_MAX[ammo];
    this.bags[ammo] = Math.min(max, this.bags[ammo] + amount);
    if (this.state.ammoType === ammo) this.state.reserve = this.bags[ammo];
  }

  /** Inventory bags for HUD */
  ammoBags(): Record<AmmoTypeId, number> {
    return { ...this.bags };
  }

  /**
   * Frame update. Returns whether a primary fire should spawn this frame.
   */
  update(opts: {
    dt: number;
    adsHeld: boolean;
    firePressed: boolean;
    reloadPressed: boolean;
    moving: boolean;
    sprinting: boolean;
  }): { fire: boolean; skin: UltimateGunDef | null } {
    const dt = opts.dt;
    const lo = this.state.loadout;
    const skin = this.state.skinId ? ultimateGunById(this.state.skinId) ?? null : null;
    if (!lo || !this.state.weaponId) {
      this.state.ads = Math.max(0, this.state.ads - dt / TPS_ARC_RAIDERS.adsBlendSec);
      return { fire: false, skin: null };
    }

    // ADS blend
    const adsTarget = opts.adsHeld && !opts.sprinting ? 1 : 0;
    const adsSpeed = 1 / TPS_ARC_RAIDERS.adsBlendSec;
    if (this.state.ads < adsTarget) this.state.ads = Math.min(1, this.state.ads + dt * adsSpeed);
    else if (this.state.ads > adsTarget) this.state.ads = Math.max(0, this.state.ads - dt * adsSpeed);

    // Spread
    const hip = skin?.hipSpread ?? 0.04;
    const ads = skin?.adsSpread ?? 0.012;
    let sp = THREE_LERP(hip, ads, this.state.ads);
    if (opts.moving) sp *= TPS_ARC_RAIDERS.moveAdsSpreadMul;
    if (opts.sprinting && this.state.ads < 0.2) sp *= TPS_ARC_RAIDERS.sprintHipFirePenalty;
    this.state.spread = sp;

    // Reload
    if (this.state.reloading) {
      this.state.reloadT -= dt;
      if (this.state.reloadT <= 0) {
        this.finishReload();
      }
    } else if (opts.reloadPressed && this.state.clip < lo.clip && this.state.reserve > 0) {
      this.state.reloading = true;
      this.state.reloadT = lo.reloadTime;
    }

    // Fire CD
    if (this.state.fireCd > 0) this.state.fireCd -= dt;

    let fire = false;
    if (
      opts.firePressed &&
      !this.state.reloading &&
      this.state.fireCd <= 0 &&
      this.state.clip > 0 &&
      !opts.sprinting
    ) {
      const cost = Math.min(lo.burst, this.state.clip);
      this.state.clip -= cost;
      this.state.fireCd = lo.fireLock;
      fire = true;
      // Auto-reload when empty
      if (this.state.clip <= 0 && this.state.reserve > 0) {
        this.state.reloading = true;
        this.state.reloadT = lo.reloadTime;
      }
    }

    // Sync bag
    this.bags[this.state.ammoType] = this.state.reserve;

    return { fire, skin };
  }

  private finishReload() {
    const lo = this.state.loadout;
    if (!lo) {
      this.state.reloading = false;
      return;
    }
    const need = lo.clip - this.state.clip;
    const take = Math.min(need, this.state.reserve);
    this.state.clip += take;
    this.state.reserve -= take;
    this.bags[this.state.ammoType] = this.state.reserve;
    this.state.reloading = false;
    this.state.reloadT = 0;
  }
}

function THREE_LERP(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}
