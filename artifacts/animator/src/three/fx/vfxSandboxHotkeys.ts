/**
 * Deploy https://vfxgrudge.puter.site/ sandbox effects into Open combat Vfx.
 * Alt+V/B/F/G/T/C + Alt+Space (Getsuga) — never steals bare combat keys.
 */

import * as THREE from "three";
import type { Vfx } from "../Vfx";
import {
  VFX_SANDBOX_SHORTCUTS,
  vfxCatalogById,
  type VfxEffectId,
} from "./vfxEffectCatalog";
import { SLASH_VARIANTS } from "./slashProjectileVariants";

export type DeploySandboxOpts = {
  origin: THREE.Vector3;
  forward: THREE.Vector3;
  /** Optional aim point (hard/soft lock). */
  aim?: THREE.Vector3 | null;
  /** Weapon grip→tip for Getsuga trail (world). */
  weaponEdge?: (() => { base: THREE.Vector3; tip: THREE.Vector3 } | null) | null;
  onHit?: (p: THREE.Vector3) => void;
};

/**
 * Resolve a keyboard code + Alt state to a sandbox effectId, or null if not a
 * sandbox binding (caller should fall through to normal combat keys).
 */
export function sandboxEffectForKey(code: string, altHeld: boolean): VfxEffectId | null {
  if (!altHeld) return null;
  const row = VFX_SANDBOX_SHORTCUTS.find((s) => s.code === code && s.alt);
  return row?.effectId ?? null;
}

/** Human flash label for HUD. */
export function sandboxLabelForEffect(effectId: string): string {
  const row = VFX_SANDBOX_SHORTCUTS.find((s) => s.effectId === effectId);
  if (row) return `VFX · ${row.label}`;
  const cat = vfxCatalogById(effectId);
  return cat ? `VFX · ${cat.name}` : `VFX · ${effectId}`;
}

/**
 * Cast one catalog effect at the player using existing Vfx primitives / models.
 * Purely visual + optional onHit for path damage; no skill CD.
 */
export function deploySandboxVfx(vfx: Vfx, effectId: VfxEffectId | string, opts: DeploySandboxOpts): void {
  const origin = opts.origin.clone();
  const fwd = opts.forward.clone();
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
  fwd.normalize();
  const cast = origin.clone().setY(origin.y + 1.1);
  const front = cast.clone().addScaledVector(fwd, 1.2);
  const ground = new THREE.Vector3(origin.x, 0.05, origin.z);
  const aim = opts.aim?.clone() ?? front.clone().addScaledVector(fwd, 8);
  const hit = opts.onHit;

  switch (effectId) {
    case "ice_lightning_burst": {
      // Ice Serpent (Alt+V) — frost plate + lightning crackle + ice burst
      vfx.frostGround(ground, 3.4, 0x9fdcff, 1.0);
      vfx.lightning(front, 1.3);
      vfx.nova(front, 0x9fdcff);
      vfx.burst(front, 0x7ec8ff, 28, 4.5);
      vfx.impact(front, 0x9fdcff, 1.1);
      hit?.(front);
      break;
    }
    case "moon_beam": {
      // Moon Beam (Alt+B) — vertical holy column + soft ground ring
      const beamPos = aim.clone();
      beamPos.y = 0.1;
      vfx.auraRing(beamPos, 0xd0e8ff, 1.6, 0.9);
      vfx.castAura(beamPos.clone().setY(1.2), 0xd0e8ff);
      vfx.nova(beamPos.clone().setY(1.4), 0xe8f4ff);
      vfx.burst(beamPos.clone().setY(2.2), 0xd0e8ff, 18, 2.4);
      // Soft tall blaster as vertical beam read
      vfx.slashBlaster(beamPos.clone().setY(1.2), new THREE.Vector3(0, 1, 0.01).normalize(), {
        color: 0xd0e8ff,
        range: 0.5,
        duration: 0.55,
        lane: 0,
      });
      hit?.(beamPos.clone().setY(1));
      break;
    }
    case "frost_wave": {
      // Frost Wave (Alt+F)
      const radius = 4.2;
      vfx.frostGround(ground, radius, 0x9fdcff, 1.15);
      vfx.shockwave(ground.clone(), 0xa0d8ff, radius * 1.05, 0.75);
      vfx.burst(front, 0x9fdcff, 22, 3.5);
      hit?.(front);
      break;
    }
    case "earth_surge": {
      // Earth Surge (Alt+T) — heavier ground read
      const radius = 5.2;
      vfx.shockwave(ground.clone(), 0xc4a574, radius, 0.9);
      vfx.shockwave(ground.clone().setY(0.08), 0x8b7355, radius * 0.7, 0.65);
      vfx.frostGround(ground, radius * 0.55, 0xb8a070, 0.7);
      vfx.burst(front, 0xc4a574, 26, 4);
      hit?.(front);
      break;
    }
    case "fire_aura": {
      // Aura Ring (Alt+G)
      vfx.fireAura(cast, 1.25);
      vfx.auraRing(ground, 0xff5510, 2.4, 0.85);
      vfx.castAura(cast, 0xff6a1e);
      break;
    }
    case "fireball": {
      // Fireball (Alt+C)
      const dir = aim.clone().sub(cast);
      if (dir.lengthSq() < 1e-4) dir.copy(fwd);
      dir.normalize();
      vfx.castAura(cast, 0xff6a1e);
      vfx.castFireball(cast, dir, 0xff6a1e, (p) => {
        hit?.(p);
      });
      break;
    }
    case "getsuga_slash": {
      // Getsuga (Alt+Space) — production slashblue mesh, crescent faces aim
      const dir = aim.clone().sub(cast);
      if (dir.lengthSq() < 1e-4) dir.copy(fwd);
      dir.normalize();
      const edge = opts.weaponEdge?.();
      const muzzle = edge?.tip?.clone() ?? front;
      const blue = SLASH_VARIANTS.slashblue;
      vfx.getsugaSlash(muzzle, dir, {
        variant: "slashblue",
        color: blue.mid,
        aim,
        speed: 16,
        range: 9,
        contactRadius: 0.95,
        followWeapon: opts.weaponEdge ?? undefined,
        followDuration: 0.12,
        onPathTick: (p) => hit?.(p),
        onHit: (p) => {
          vfx.impact(p, blue.mid, 0.9);
          hit?.(p);
        },
      });
      break;
    }
    case "inferno": {
      vfx.nova(front, 0xff6a1e);
      vfx.blastImpact(front, 0xff6a1e, 1.8);
      vfx.shockwave(ground, 0xff6a1e, 3.5, 0.7);
      vfx.fireAura(front, 1.4);
      hit?.(front);
      break;
    }
    case "arcane_swirl": {
      vfx.castAura(cast, 0xb070ff);
      vfx.castSwirl(cast, 0xb070ff, 0.7, 1.1);
      vfx.auraRing(ground, 0xb070ff, 1.8, 0.7);
      break;
    }
    case "fire_wisps":
    case "fire_hand": {
      vfx.castAura(cast, 0xff6020);
      vfx.fireAura(cast, 0.9);
      vfx.burst(cast, 0xff6020, 14, 2);
      break;
    }
    case "holy_hands": {
      vfx.castAura(cast, 0xffe08a);
      vfx.nova(cast, 0xffe08a);
      break;
    }
    case "arcane_hands": {
      vfx.castAura(cast, 0xb070ff);
      vfx.burst(cast, 0xb070ff, 16, 2.2);
      break;
    }
    case "poison_cloud": {
      vfx.auraRing(ground, 0x7cff3a, 2.8, 1.2);
      vfx.burst(front, 0x7cff3a, 20, 3);
      hit?.(front);
      break;
    }
    case "chain_lightning": {
      vfx.lightning(front, 1.5);
      vfx.burst(front, 0x7ec8ff, 24, 4);
      vfx.impact(front, 0x7ec8ff, 0.9);
      hit?.(front);
      break;
    }
    default: {
      const cat = vfxCatalogById(effectId);
      const color = cat?.color ?? 0x9fd0ff;
      vfx.castAura(cast, color);
      vfx.nova(front, color);
      hit?.(front);
    }
  }
}
