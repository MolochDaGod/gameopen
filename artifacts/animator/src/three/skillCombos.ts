/**
 * Multi-part weapon skills (2–3 stages) + VFX recipes.
 *
 * Albion-like: press the same slot again inside `window` to continue the chain;
 * each part can change anim / VFX / damage. Independent per-slot cooldowns still
 * arm only when the chain finishes or the window expires.
 *
 * VFX recipes are executed by Studio via enhanced Vfx helpers (charged bolts,
 * beams, charge rings, fire aura).
 */
import type { WeaponId } from "./types";
import type { CombatContextSnapshot, CombatSituation } from "./combatContext";

export type SkillVfxOp =
  | { op: "muzzle"; color?: number }
  | { op: "charge"; color: number; scale?: number }
  | { op: "bolt"; color: number; charged?: boolean; speed?: number; range?: number; scale?: number }
  | { op: "beam"; color: number; length?: number; life?: number }
  | { op: "hexaring"; color: number; life?: number }
  | { op: "fireAura"; scale?: number }
  | { op: "aoeBlast"; color: number; radius: number }
  | { op: "shockwave"; color: number; radius: number }
  | { op: "castAura"; color: number }
  | { op: "slash"; color: number }
  | { op: "afterimage"; color: number };

export interface SkillPartDef {
  /** 0-based part index within the chain. */
  part: number;
  label: string;
  /** Clip candidates by combat situation (state-dependent). */
  clips: Partial<Record<CombatSituation, string[]>>;
  fallbackClips: string[];
  /** Seconds after this part during which the next part can chain. */
  window: number;
  /** Optional cast delay before damage (telegraph). */
  castTime?: number;
  damage: number;
  radius?: number;
  forceMul?: number;
  /** Motion-math-ish dash (m); negative = backstep. */
  dash?: number;
  hop?: number;
  vfx: SkillVfxOp[];
  /** Launch targets on hit. */
  launch?: boolean;
  shieldBreak?: boolean;
}

export interface MultiPartSkill {
  weaponId: WeaponId | "*";
  /** Hotbar slot 0–3. */
  slot: number;
  /** Full chain cooldown after last part or window timeout (s). */
  cooldown: number;
  parts: SkillPartDef[];
}

/** Flagship multi-part kits — expand per weapon over time. */
export const MULTI_PART_SKILLS: MultiPartSkill[] = [
  // ── Sword slot 1: 3-hit light chain (skill version of combo) ─────────────
  {
    weaponId: "sword",
    slot: 0,
    cooldown: 4.0,
    parts: [
      {
        part: 0,
        label: "Slash",
        clips: {
          ground: ["attack", "attack1", "meleeCombo1"],
          air: ["jumpAttack", "attack"],
          after_damage: ["attack", "blockReact"],
        },
        fallbackClips: ["attack"],
        window: 0.85,
        damage: 16,
        radius: 1.8,
        forceMul: 0.7,
        dash: 0.6,
        vfx: [{ op: "slash", color: 0x9fe8ff }, { op: "muzzle", color: 0x9fe8ff }],
      },
      {
        part: 1,
        label: "Cross Slash",
        clips: {
          ground: ["attack2", "meleeCombo2", "attack"],
          air: ["jumpAttack", "attack"],
          after_skill: ["attack2", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0.9,
        damage: 20,
        radius: 2.0,
        forceMul: 0.9,
        dash: 0.9,
        vfx: [
          { op: "slash", color: 0xb0f0ff },
          { op: "shockwave", color: 0x88e0ff, radius: 1.4 },
        ],
      },
      {
        part: 2,
        label: "Finisher",
        clips: {
          ground: ["attack3", "meleeCombo1", "attack"],
          air: ["jumpAttack", "uppercut", "attack"],
          enemy_attacking: ["attack3", "parryReact", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0,
        damage: 28,
        radius: 2.3,
        forceMul: 1.4,
        dash: 1.2,
        launch: true,
        vfx: [
          { op: "slash", color: 0xffe080 },
          { op: "fireAura", scale: 1.1 },
          { op: "shockwave", color: 0xffd060, radius: 2.2 },
          { op: "aoeBlast", color: 0xffc040, radius: 1.8 },
        ],
      },
    ],
  },
  // ── Pistol slot 1: charged fan → beam (2–3 parts) ───────────────────────
  {
    weaponId: "pistol",
    slot: 0,
    cooldown: 5.5,
    parts: [
      {
        part: 0,
        label: "Charge Shot",
        clips: {
          ground: ["chargedShot", "attack"],
          hover: ["chargedShot", "attack"],
          air: ["airDodge", "chargedShot", "attack"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 1.0,
        castTime: 0.18,
        damage: 18,
        radius: 1.0,
        forceMul: 0.55,
        vfx: [
          { op: "charge", color: 0xfff2a8, scale: 1.0 },
          { op: "muzzle", color: 0xfff2a8 },
          { op: "bolt", color: 0xfff2a8, charged: true, speed: 52, range: 24, scale: 1.2 },
        ],
      },
      {
        part: 1,
        label: "Fan Burst",
        clips: {
          ground: ["chargedShot", "attack"],
          hover: ["chargedShot", "attack"],
          after_skill: ["chargedShot", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0.95,
        damage: 12,
        radius: 0.95,
        forceMul: 0.45,
        vfx: [
          { op: "muzzle", color: 0xffe080 },
          { op: "bolt", color: 0xffe080, charged: true, speed: 50, range: 20, scale: 0.95 },
          { op: "bolt", color: 0xffd060, charged: true, speed: 48, range: 18, scale: 0.9 },
          { op: "bolt", color: 0xffc040, charged: true, speed: 48, range: 18, scale: 0.9 },
        ],
      },
      {
        part: 2,
        label: "Plasma Beam",
        clips: {
          ground: ["chargedShot", "attack"],
          hover: ["chargedShot", "attack"],
          after_skill: ["chargedShot"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 0,
        castTime: 0.22,
        damage: 14,
        radius: 1.2,
        forceMul: 0.7,
        vfx: [
          { op: "charge", color: 0x7fd8ff, scale: 1.3 },
          { op: "hexaring", color: 0x9fd8ff, life: 0.9 },
          { op: "beam", color: 0x7fd8ff, length: 18, life: 0.55 },
          { op: "fireAura", scale: 1.0 },
        ],
      },
    ],
  },
  // ── Crossbow slot 1: charge → scatter → knockback blast ─────────────────
  {
    weaponId: "crossbow",
    slot: 0,
    cooldown: 5.0,
    parts: [
      {
        part: 0,
        label: "Charge",
        clips: {
          ground: ["chargedShot", "attack"],
          air: ["jumpAttack", "chargedShot"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 0.9,
        castTime: 0.2,
        damage: 10,
        radius: 1.0,
        vfx: [
          { op: "charge", color: 0xff9a40, scale: 1.2 },
          { op: "castAura", color: 0xff9a40 },
          { op: "bolt", color: 0xffc070, charged: true, speed: 42, range: 16, scale: 1.15 },
        ],
      },
      {
        part: 1,
        label: "Scatter",
        clips: {
          ground: ["chargedShot", "attack"],
          after_skill: ["chargedShot", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0.85,
        castTime: 0.15,
        damage: 11,
        radius: 1.1,
        forceMul: 1.1,
        vfx: [
          { op: "muzzle", color: 0xff9a40 },
          { op: "bolt", color: 0xffb050, charged: true, speed: 48, range: 12, scale: 0.85 },
          { op: "bolt", color: 0xffa040, charged: true, speed: 46, range: 12, scale: 0.85 },
          { op: "bolt", color: 0xff9040, charged: true, speed: 46, range: 12, scale: 0.85 },
          { op: "shockwave", color: 0xff8030, radius: 1.8 },
        ],
      },
      {
        part: 2,
        label: "Siege Blast",
        clips: {
          ground: ["chargedShot", "attack"],
          after_skill: ["chargedShot"],
          enemy_attacking: ["chargedShot", "attack"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 0,
        castTime: 0.28,
        damage: 24,
        radius: 2.4,
        forceMul: 1.5,
        shieldBreak: true,
        launch: true,
        vfx: [
          { op: "charge", color: 0xb070ff, scale: 1.5 },
          { op: "hexaring", color: 0xb070ff, life: 0.7 },
          { op: "bolt", color: 0xb070ff, charged: true, speed: 38, range: 14, scale: 1.5 },
          { op: "aoeBlast", color: 0xb070ff, radius: 2.6 },
          { op: "fireAura", scale: 1.3 },
        ],
      },
    ],
  },
  // ── Greatsword slot 2: 2-part heavy ─────────────────────────────────────
  {
    weaponId: "greatsword",
    slot: 1,
    cooldown: 6.5,
    parts: [
      {
        part: 0,
        label: "Heavy Windup",
        clips: {
          ground: ["attack", "attack1"],
          air: ["jumpAttack", "attack"],
          after_damage: ["attack"],
        },
        fallbackClips: ["attack"],
        window: 1.1,
        castTime: 0.2,
        damage: 22,
        radius: 2.2,
        forceMul: 1.0,
        dash: 0.8,
        vfx: [
          { op: "charge", color: 0xffb24d, scale: 1.1 },
          { op: "slash", color: 0xffb24d },
        ],
      },
      {
        part: 1,
        label: "Crush",
        clips: {
          ground: ["attack2", "attack3", "attack"],
          air: ["jumpAttack", "attack"],
          after_skill: ["attack3", "attack"],
          knockdown: ["attack"],
        },
        fallbackClips: ["attack"],
        window: 0,
        damage: 36,
        radius: 2.6,
        forceMul: 1.6,
        dash: 1.4,
        launch: true,
        shieldBreak: true,
        vfx: [
          { op: "slash", color: 0xff9040 },
          { op: "shockwave", color: 0xff8020, radius: 2.8 },
          { op: "aoeBlast", color: 0xff7020, radius: 2.4 },
          { op: "fireAura", scale: 1.25 },
        ],
      },
    ],
  },
  // ── Dagger slot 1: 3-part ambush (air / after-damage variants) ──────────
  {
    weaponId: "dagger",
    slot: 0,
    cooldown: 4.2,
    parts: [
      {
        part: 0,
        label: "Flick",
        clips: {
          ground: ["attack", "attack1", "meleeCombo1"],
          air: ["jumpAttack", "attack"],
          after_damage: ["attack", "blockReact"],
          enemy_attacking: ["attack", "parryReact"],
        },
        fallbackClips: ["attack"],
        window: 0.75,
        damage: 12,
        radius: 1.4,
        forceMul: 0.5,
        dash: 1.1,
        vfx: [
          { op: "slash", color: 0xc8a0ff },
          { op: "afterimage", color: 0xc8a0ff },
        ],
      },
      {
        part: 1,
        label: "Twin Cut",
        clips: {
          ground: ["attack2", "meleeCombo2", "attack"],
          air: ["jumpAttack", "attack"],
          after_skill: ["attack2", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0.8,
        damage: 14,
        radius: 1.5,
        forceMul: 0.55,
        dash: 0.9,
        vfx: [
          { op: "slash", color: 0xd8b0ff },
          { op: "slash", color: 0xb080ff },
          { op: "muzzle", color: 0xc8a0ff },
        ],
      },
      {
        part: 2,
        label: "Shadow Ambush",
        clips: {
          ground: ["attack3", "attack"],
          air: ["jumpAttack", "attack"],
          after_skill: ["attack3"],
          stunned: ["attack"],
        },
        fallbackClips: ["attack"],
        window: 0,
        castTime: 0.1,
        damage: 26,
        radius: 1.8,
        forceMul: 1.1,
        dash: 1.6,
        launch: true,
        vfx: [
          { op: "charge", color: 0x9060ff, scale: 1.1 },
          { op: "afterimage", color: 0x9060ff },
          { op: "slash", color: 0xe0c0ff },
          { op: "aoeBlast", color: 0xa070ff, radius: 1.6 },
          { op: "fireAura", scale: 1.0 },
        ],
      },
    ],
  },
  // ── Spear slot 1: thrust → sweep → skewer ───────────────────────────────
  {
    weaponId: "spear",
    slot: 0,
    cooldown: 4.8,
    parts: [
      {
        part: 0,
        label: "Thrust",
        clips: {
          ground: ["attack", "attack1", "thrust"],
          air: ["jumpAttack", "attack"],
          enemy_attacking: ["attack", "parryReact"],
        },
        fallbackClips: ["attack"],
        window: 0.9,
        damage: 18,
        radius: 2.0,
        forceMul: 0.85,
        dash: 1.4,
        vfx: [
          { op: "slash", color: 0x9fe8ff },
          { op: "afterimage", color: 0x9fe8ff },
        ],
      },
      {
        part: 1,
        label: "Sweep",
        clips: {
          ground: ["attack2", "slash", "attack"],
          after_skill: ["attack2", "attack"],
          air: ["jumpAttack", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0.95,
        damage: 16,
        radius: 2.4,
        forceMul: 0.9,
        dash: 0.5,
        vfx: [
          { op: "slash", color: 0xb0f0ff },
          { op: "shockwave", color: 0x88e0ff, radius: 2.0 },
        ],
      },
      {
        part: 2,
        label: "Skewer",
        clips: {
          ground: ["attack3", "attack"],
          after_skill: ["attack3"],
          air: ["jumpAttack", "attack"],
          knockdown: ["attack"],
        },
        fallbackClips: ["attack"],
        window: 0,
        castTime: 0.15,
        damage: 30,
        radius: 2.2,
        forceMul: 1.35,
        dash: 1.8,
        launch: true,
        shieldBreak: true,
        vfx: [
          { op: "charge", color: 0x70d0ff, scale: 1.15 },
          { op: "slash", color: 0xffe080 },
          { op: "shockwave", color: 0xffd060, radius: 2.2 },
          { op: "fireAura", scale: 1.15 },
        ],
      },
    ],
  },
  // ── Axe slot 2: spin windup → cleave ────────────────────────────────────
  {
    weaponId: "axe",
    slot: 1,
    cooldown: 5.5,
    parts: [
      {
        part: 0,
        label: "Spin Windup",
        clips: {
          ground: ["attack", "attack1"],
          air: ["jumpAttack", "attack"],
          after_damage: ["attack"],
        },
        fallbackClips: ["attack"],
        window: 1.0,
        castTime: 0.18,
        damage: 14,
        radius: 2.0,
        forceMul: 0.8,
        dash: 0.4,
        vfx: [
          { op: "charge", color: 0xff8040, scale: 1.2 },
          { op: "slash", color: 0xff9040 },
          { op: "hexaring", color: 0xff7040, life: 0.5 },
        ],
      },
      {
        part: 1,
        label: "Carnage Cleave",
        clips: {
          ground: ["attack2", "attack3", "attack"],
          after_skill: ["attack3", "attack"],
          air: ["jumpAttack", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0,
        damage: 32,
        radius: 2.6,
        forceMul: 1.45,
        dash: 1.0,
        launch: true,
        shieldBreak: true,
        vfx: [
          { op: "slash", color: 0xff6020 },
          { op: "aoeBlast", color: 0xff5020, radius: 2.5 },
          { op: "shockwave", color: 0xff7030, radius: 2.8 },
          { op: "fireAura", scale: 1.3 },
        ],
      },
    ],
  },
  // ── Greataxe mirrors axe heavy (slot 2) ─────────────────────────────────
  {
    weaponId: "greataxe",
    slot: 1,
    cooldown: 5.8,
    parts: [
      {
        part: 0,
        label: "Carnage Spin",
        clips: {
          ground: ["attack", "attack1"],
          air: ["jumpAttack", "attack"],
        },
        fallbackClips: ["attack"],
        window: 1.05,
        castTime: 0.2,
        damage: 16,
        radius: 2.2,
        forceMul: 0.9,
        vfx: [
          { op: "charge", color: 0xff6040, scale: 1.3 },
          { op: "slash", color: 0xff8050 },
        ],
      },
      {
        part: 1,
        label: "Execute",
        clips: {
          ground: ["attack2", "attack3", "attack"],
          after_skill: ["attack3"],
          knockdown: ["attack"],
        },
        fallbackClips: ["attack"],
        window: 0,
        damage: 38,
        radius: 2.8,
        forceMul: 1.55,
        dash: 1.2,
        launch: true,
        shieldBreak: true,
        vfx: [
          { op: "slash", color: 0xff4020 },
          { op: "aoeBlast", color: 0xff3010, radius: 2.8 },
          { op: "shockwave", color: 0xff5020, radius: 3.0 },
          { op: "fireAura", scale: 1.4 },
        ],
      },
    ],
  },
  // ── Hammer slot 1: pound → meteor ───────────────────────────────────────
  {
    weaponId: "hammer",
    slot: 0,
    cooldown: 5.2,
    parts: [
      {
        part: 0,
        label: "Ground Pound",
        clips: {
          ground: ["attack", "attack1"],
          air: ["jumpAttack", "attack"],
          after_damage: ["attack"],
        },
        fallbackClips: ["attack"],
        window: 1.0,
        castTime: 0.15,
        damage: 20,
        radius: 2.2,
        forceMul: 1.1,
        dash: 0.6,
        vfx: [
          { op: "charge", color: 0xffc060, scale: 1.15 },
          { op: "shockwave", color: 0xffb040, radius: 2.0 },
          { op: "slash", color: 0xffd080 },
        ],
      },
      {
        part: 1,
        label: "Meteor Smash",
        clips: {
          ground: ["attack2", "attack3", "attack"],
          air: ["jumpAttack", "attack"],
          after_skill: ["attack3"],
          knockdown: ["attack"],
        },
        fallbackClips: ["attack"],
        window: 0,
        castTime: 0.22,
        damage: 34,
        radius: 2.8,
        forceMul: 1.6,
        hop: 0.6,
        launch: true,
        shieldBreak: true,
        vfx: [
          { op: "charge", color: 0xff9040, scale: 1.4 },
          { op: "aoeBlast", color: 0xff8020, radius: 2.8 },
          { op: "shockwave", color: 0xffa040, radius: 3.2 },
          { op: "fireAura", scale: 1.35 },
        ],
      },
    ],
  },
  // ── hammer2h same kit ───────────────────────────────────────────────────
  {
    weaponId: "hammer2h",
    slot: 0,
    cooldown: 5.4,
    parts: [
      {
        part: 0,
        label: "Quake",
        clips: {
          ground: ["attack", "attack1"],
          air: ["jumpAttack", "attack"],
        },
        fallbackClips: ["attack"],
        window: 1.05,
        castTime: 0.18,
        damage: 22,
        radius: 2.4,
        forceMul: 1.15,
        vfx: [
          { op: "charge", color: 0xffb050, scale: 1.2 },
          { op: "shockwave", color: 0xffa030, radius: 2.2 },
        ],
      },
      {
        part: 1,
        label: "Anvil Drop",
        clips: {
          ground: ["attack2", "attack3", "attack"],
          after_skill: ["attack3"],
          air: ["jumpAttack", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0,
        castTime: 0.25,
        damage: 36,
        radius: 3.0,
        forceMul: 1.65,
        hop: 0.7,
        launch: true,
        shieldBreak: true,
        vfx: [
          { op: "charge", color: 0xff8030, scale: 1.5 },
          { op: "aoeBlast", color: 0xff7020, radius: 3.0 },
          { op: "shockwave", color: 0xff9020, radius: 3.4 },
          { op: "fireAura", scale: 1.4 },
        ],
      },
    ],
  },
  // ── Bow slot 1: charge → multi → piercing volley ────────────────────────
  {
    weaponId: "bow",
    slot: 0,
    cooldown: 5.0,
    parts: [
      {
        part: 0,
        label: "Aimed Charge",
        clips: {
          ground: ["chargedShot", "attack", "bowDraw"],
          air: ["jumpAttack", "chargedShot", "attack"],
          hover: ["chargedShot", "attack"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 1.0,
        castTime: 0.22,
        damage: 16,
        radius: 0.9,
        forceMul: 0.5,
        vfx: [
          { op: "charge", color: 0xa0e080, scale: 1.1 },
          { op: "bolt", color: 0xb0f090, charged: true, speed: 50, range: 28, scale: 1.1 },
        ],
      },
      {
        part: 1,
        label: "Multi Shot",
        clips: {
          ground: ["chargedShot", "attack"],
          after_skill: ["chargedShot", "attack"],
          air: ["jumpAttack", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0.9,
        damage: 10,
        radius: 0.85,
        forceMul: 0.4,
        vfx: [
          { op: "muzzle", color: 0xa0e080 },
          { op: "bolt", color: 0xb0f090, charged: true, speed: 52, range: 24, scale: 0.9 },
          { op: "bolt", color: 0x90d070, charged: true, speed: 50, range: 22, scale: 0.85 },
          { op: "bolt", color: 0x80c060, charged: true, speed: 50, range: 22, scale: 0.85 },
        ],
      },
      {
        part: 2,
        label: "Piercing Volley",
        clips: {
          ground: ["chargedShot", "attack"],
          after_skill: ["chargedShot"],
          enemy_attacking: ["chargedShot", "attack"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 0,
        castTime: 0.2,
        damage: 14,
        radius: 1.1,
        forceMul: 0.7,
        vfx: [
          { op: "charge", color: 0xd0ff90, scale: 1.3 },
          { op: "hexaring", color: 0xc0ff80, life: 0.7 },
          { op: "beam", color: 0xa0ff70, length: 20, life: 0.4 },
          { op: "bolt", color: 0xe0ffb0, charged: true, speed: 60, range: 30, scale: 1.25 },
          { op: "fireAura", scale: 1.0 },
        ],
      },
    ],
  },
  // ── Rifle slot 1: burst → suppress → dump ───────────────────────────────
  {
    weaponId: "rifle",
    slot: 0,
    cooldown: 5.5,
    parts: [
      {
        part: 0,
        label: "3-Round Burst",
        clips: {
          ground: ["chargedShot", "attack"],
          air: ["airDodge", "chargedShot", "attack"],
          hover: ["chargedShot", "attack"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 0.95,
        castTime: 0.1,
        damage: 11,
        radius: 0.9,
        forceMul: 0.45,
        vfx: [
          { op: "charge", color: 0x80c8ff, scale: 0.9 },
          { op: "muzzle", color: 0x80c8ff },
          { op: "bolt", color: 0x90d0ff, charged: true, speed: 58, range: 26, scale: 0.95 },
          { op: "bolt", color: 0x80c0ff, charged: true, speed: 56, range: 24, scale: 0.9 },
          { op: "bolt", color: 0x70b0ff, charged: true, speed: 56, range: 24, scale: 0.9 },
        ],
      },
      {
        part: 1,
        label: "Suppress",
        clips: {
          ground: ["chargedShot", "attack"],
          after_skill: ["chargedShot"],
          enemy_attacking: ["chargedShot", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0.9,
        damage: 9,
        radius: 1.0,
        forceMul: 0.55,
        vfx: [
          { op: "muzzle", color: 0x70b8ff },
          { op: "bolt", color: 0x80c8ff, charged: true, speed: 54, range: 22, scale: 0.85 },
          { op: "bolt", color: 0x70b0f0, charged: true, speed: 52, range: 20, scale: 0.8 },
          { op: "shockwave", color: 0x60a0e0, radius: 1.5 },
        ],
      },
      {
        part: 2,
        label: "Full Auto Dump",
        clips: {
          ground: ["chargedShot", "attack"],
          after_skill: ["chargedShot"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 0,
        castTime: 0.15,
        damage: 12,
        radius: 1.2,
        forceMul: 0.65,
        vfx: [
          { op: "charge", color: 0x50a0ff, scale: 1.35 },
          { op: "hexaring", color: 0x70c0ff, life: 0.85 },
          { op: "beam", color: 0x60b8ff, length: 22, life: 0.55 },
          { op: "fireAura", scale: 1.1 },
        ],
      },
    ],
  },
  // ── hunter-rifle mirrors rifle ──────────────────────────────────────────
  {
    weaponId: "hunter-rifle",
    slot: 0,
    cooldown: 5.6,
    parts: [
      {
        part: 0,
        label: "Marked Burst",
        clips: {
          ground: ["chargedShot", "attack"],
          air: ["airDodge", "chargedShot"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 0.95,
        castTime: 0.12,
        damage: 12,
        radius: 0.95,
        forceMul: 0.5,
        vfx: [
          { op: "charge", color: 0xffb060, scale: 1.0 },
          { op: "bolt", color: 0xffc070, charged: true, speed: 60, range: 28, scale: 1.05 },
          { op: "bolt", color: 0xffb050, charged: true, speed: 58, range: 26, scale: 0.95 },
          { op: "bolt", color: 0xffa040, charged: true, speed: 58, range: 26, scale: 0.95 },
        ],
      },
      {
        part: 1,
        label: "Marked Shot",
        clips: {
          ground: ["chargedShot", "attack"],
          after_skill: ["chargedShot"],
        },
        fallbackClips: ["attack"],
        window: 0.9,
        castTime: 0.18,
        damage: 22,
        radius: 1.0,
        forceMul: 0.7,
        vfx: [
          { op: "charge", color: 0xff9040, scale: 1.2 },
          { op: "hexaring", color: 0xffa050, life: 0.6 },
          { op: "bolt", color: 0xffe080, charged: true, speed: 62, range: 30, scale: 1.3 },
        ],
      },
      {
        part: 2,
        label: "Plasma Dump",
        clips: {
          ground: ["chargedShot", "attack"],
          after_skill: ["chargedShot"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 0,
        castTime: 0.2,
        damage: 14,
        radius: 1.3,
        forceMul: 0.8,
        vfx: [
          { op: "charge", color: 0xff7030, scale: 1.4 },
          { op: "beam", color: 0xff9040, length: 24, life: 0.5 },
          { op: "aoeBlast", color: 0xff8020, radius: 1.8 },
          { op: "fireAura", scale: 1.2 },
        ],
      },
    ],
  },
  // ── Shotgun slot 1: pump → wide cone → knockback finisher ───────────────
  {
    weaponId: "shotgun",
    slot: 0,
    cooldown: 5.0,
    parts: [
      {
        part: 0,
        label: "Pump",
        clips: {
          ground: ["chargedShot", "attack"],
          air: ["jumpAttack", "chargedShot"],
          after_damage: ["chargedShot", "attack"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 0.9,
        castTime: 0.1,
        damage: 14,
        radius: 1.6,
        forceMul: 1.0,
        vfx: [
          { op: "muzzle", color: 0xffb070 },
          { op: "shockwave", color: 0xff9040, radius: 1.8 },
          { op: "bolt", color: 0xffc090, charged: true, speed: 36, range: 8, scale: 0.85 },
          { op: "bolt", color: 0xffb070, charged: true, speed: 34, range: 8, scale: 0.8 },
          { op: "bolt", color: 0xffa060, charged: true, speed: 34, range: 8, scale: 0.8 },
        ],
      },
      {
        part: 1,
        label: "Wide Cone",
        clips: {
          ground: ["chargedShot", "attack"],
          after_skill: ["chargedShot"],
        },
        fallbackClips: ["attack"],
        window: 0.85,
        castTime: 0.12,
        damage: 12,
        radius: 2.2,
        forceMul: 1.2,
        vfx: [
          { op: "muzzle", color: 0xff9040 },
          { op: "shockwave", color: 0xff8030, radius: 2.4 },
          { op: "bolt", color: 0xffb070, charged: true, speed: 38, range: 9, scale: 0.75 },
          { op: "bolt", color: 0xffa060, charged: true, speed: 36, range: 9, scale: 0.7 },
          { op: "bolt", color: 0xff9050, charged: true, speed: 36, range: 9, scale: 0.7 },
          { op: "bolt", color: 0xff8040, charged: true, speed: 34, range: 8, scale: 0.7 },
          { op: "bolt", color: 0xff7030, charged: true, speed: 34, range: 8, scale: 0.7 },
        ],
      },
      {
        part: 2,
        label: "Breach Blast",
        clips: {
          ground: ["chargedShot", "attack"],
          after_skill: ["chargedShot"],
          enemy_attacking: ["chargedShot", "attack"],
        },
        fallbackClips: ["chargedShot", "attack"],
        window: 0,
        castTime: 0.18,
        damage: 28,
        radius: 2.8,
        forceMul: 1.55,
        launch: true,
        shieldBreak: true,
        vfx: [
          { op: "charge", color: 0xff5020, scale: 1.35 },
          { op: "aoeBlast", color: 0xff6020, radius: 2.8 },
          { op: "shockwave", color: 0xff7040, radius: 3.0 },
          { op: "fireAura", scale: 1.3 },
        ],
      },
    ],
  },
  // ── Scythe slot 1: reaping chain ────────────────────────────────────────
  {
    weaponId: "scythe",
    slot: 0,
    cooldown: 5.0,
    parts: [
      {
        part: 0,
        label: "Reaping Slash",
        clips: {
          ground: ["attack", "attack1"],
          air: ["jumpAttack", "attack"],
          after_damage: ["attack"],
        },
        fallbackClips: ["attack"],
        window: 0.9,
        damage: 18,
        radius: 2.2,
        forceMul: 0.85,
        dash: 0.8,
        vfx: [
          { op: "slash", color: 0xb070ff },
          { op: "afterimage", color: 0x9060d0 },
        ],
      },
      {
        part: 1,
        label: "Soul Harvest",
        clips: {
          ground: ["attack2", "attack"],
          after_skill: ["attack2"],
          air: ["jumpAttack", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0.95,
        castTime: 0.12,
        damage: 16,
        radius: 2.4,
        forceMul: 0.9,
        vfx: [
          { op: "charge", color: 0x8040c0, scale: 1.15 },
          { op: "slash", color: 0xc080ff },
          { op: "hexaring", color: 0xa060ff, life: 0.6 },
          { op: "castAura", color: 0x9060e0 },
        ],
      },
      {
        part: 2,
        label: "Grim Reaper",
        clips: {
          ground: ["attack3", "attack"],
          after_skill: ["attack3"],
          knockdown: ["attack"],
          stunned: ["attack"],
        },
        fallbackClips: ["attack"],
        window: 0,
        castTime: 0.2,
        damage: 32,
        radius: 2.8,
        forceMul: 1.4,
        dash: 1.3,
        launch: true,
        vfx: [
          { op: "charge", color: 0x7020c0, scale: 1.4 },
          { op: "slash", color: 0xe0a0ff },
          { op: "aoeBlast", color: 0x8040d0, radius: 2.6 },
          { op: "shockwave", color: 0x9060e0, radius: 2.8 },
          { op: "fireAura", scale: 1.25 },
        ],
      },
    ],
  },
  // ── Gunblade slot 1: slash → blast slash → lion heart ───────────────────
  {
    weaponId: "gunblade",
    slot: 0,
    cooldown: 5.2,
    parts: [
      {
        part: 0,
        label: "Gunblade Slash",
        clips: {
          ground: ["attack", "attack1"],
          air: ["jumpAttack", "attack"],
          after_damage: ["attack"],
        },
        fallbackClips: ["attack"],
        window: 0.85,
        damage: 16,
        radius: 1.9,
        forceMul: 0.8,
        dash: 0.7,
        vfx: [
          { op: "slash", color: 0xffd060 },
          { op: "muzzle", color: 0xffd060 },
        ],
      },
      {
        part: 1,
        label: "Blast Slash",
        clips: {
          ground: ["attack2", "attack"],
          after_skill: ["attack2"],
          air: ["jumpAttack", "attack"],
        },
        fallbackClips: ["attack"],
        window: 0.9,
        castTime: 0.1,
        damage: 18,
        radius: 2.0,
        forceMul: 0.95,
        vfx: [
          { op: "slash", color: 0xffc040 },
          { op: "muzzle", color: 0xff9040 },
          { op: "bolt", color: 0xffb050, charged: true, speed: 40, range: 10, scale: 1.1 },
          { op: "shockwave", color: 0xff8030, radius: 1.8 },
        ],
      },
      {
        part: 2,
        label: "Lion Heart",
        clips: {
          ground: ["attack3", "attack"],
          after_skill: ["attack3"],
          enemy_attacking: ["attack3", "parryReact"],
        },
        fallbackClips: ["attack"],
        window: 0,
        castTime: 0.18,
        damage: 28,
        radius: 2.5,
        forceMul: 1.35,
        dash: 1.2,
        launch: true,
        vfx: [
          { op: "charge", color: 0xffe080, scale: 1.35 },
          { op: "slash", color: 0xfff0a0 },
          { op: "aoeBlast", color: 0xffc040, radius: 2.4 },
          { op: "beam", color: 0xffd060, length: 8, life: 0.35 },
          { op: "fireAura", scale: 1.25 },
        ],
      },
    ],
  },
  // ── Shield slot 1: bash → phalanx pulse ─────────────────────────────────
  {
    weaponId: "shield",
    slot: 0,
    cooldown: 4.5,
    parts: [
      {
        part: 0,
        label: "Shield Bash",
        clips: {
          ground: ["attack", "block", "attack1"],
          after_damage: ["blockReact", "attack"],
          enemy_attacking: ["parryReact", "attack"],
          parry: ["parryReact", "attack"],
        },
        fallbackClips: ["attack", "block"],
        window: 0.95,
        damage: 14,
        radius: 1.8,
        forceMul: 1.2,
        dash: 1.0,
        shieldBreak: true,
        vfx: [
          { op: "shockwave", color: 0xa0c8ff, radius: 1.8 },
          { op: "castAura", color: 0x90b8ff },
        ],
      },
      {
        part: 1,
        label: "Phalanx",
        clips: {
          ground: ["block", "attack"],
          after_skill: ["block", "attack"],
          block: ["block"],
        },
        fallbackClips: ["block", "attack"],
        window: 0,
        castTime: 0.15,
        damage: 10,
        radius: 2.6,
        forceMul: 0.9,
        vfx: [
          { op: "charge", color: 0x80b0ff, scale: 1.4 },
          { op: "hexaring", color: 0xa0d0ff, life: 0.9 },
          { op: "aoeBlast", color: 0x70a0ff, radius: 2.4 },
          { op: "shockwave", color: 0x90c0ff, radius: 2.8 },
        ],
      },
    ],
  },
  // ── Staff Storm slot 1: spark → chain → tempest beam ────────────────────
  {
    weaponId: "staffStorm",
    slot: 0,
    cooldown: 5.5,
    parts: [
      {
        part: 0,
        label: "Spark",
        clips: {
          ground: ["cast", "attack", "chargedShot"],
          air: ["jumpAttack", "cast", "attack"],
        },
        fallbackClips: ["cast", "attack"],
        window: 0.95,
        castTime: 0.15,
        damage: 14,
        radius: 1.0,
        vfx: [
          { op: "charge", color: 0xa0d0ff, scale: 1.0 },
          { op: "bolt", color: 0xc0e8ff, charged: true, speed: 48, range: 20, scale: 1.0 },
        ],
      },
      {
        part: 1,
        label: "Chain Lightning",
        clips: {
          ground: ["cast", "attack"],
          after_skill: ["cast", "attack"],
        },
        fallbackClips: ["cast", "attack"],
        window: 0.9,
        castTime: 0.12,
        damage: 12,
        radius: 1.2,
        vfx: [
          { op: "muzzle", color: 0xb0e0ff },
          { op: "bolt", color: 0xd0f0ff, charged: true, speed: 55, range: 16, scale: 0.9 },
          { op: "bolt", color: 0x90c8ff, charged: true, speed: 50, range: 14, scale: 0.85 },
          { op: "bolt", color: 0x70b0ff, charged: true, speed: 48, range: 12, scale: 0.8 },
          { op: "hexaring", color: 0xa0d8ff, life: 0.5 },
        ],
      },
      {
        part: 2,
        label: "Tempest",
        clips: {
          ground: ["cast", "attack"],
          after_skill: ["cast"],
        },
        fallbackClips: ["cast", "attack"],
        window: 0,
        castTime: 0.25,
        damage: 16,
        radius: 1.4,
        forceMul: 0.8,
        vfx: [
          { op: "charge", color: 0x70c0ff, scale: 1.5 },
          { op: "hexaring", color: 0x90d8ff, life: 1.0 },
          { op: "beam", color: 0x80d0ff, length: 20, life: 0.6 },
          { op: "aoeBlast", color: 0x60b0ff, radius: 2.2 },
          { op: "fireAura", scale: 1.15 },
        ],
      },
    ],
  },
  // ── Wand slot 1: missile → pulse → meteor tip ───────────────────────────
  {
    weaponId: "wand",
    slot: 0,
    cooldown: 5.0,
    parts: [
      {
        part: 0,
        label: "Magic Missile",
        clips: {
          ground: ["cast", "attack"],
          air: ["jumpAttack", "cast"],
        },
        fallbackClips: ["cast", "attack"],
        window: 0.9,
        castTime: 0.12,
        damage: 14,
        radius: 0.95,
        vfx: [
          { op: "charge", color: 0xd0a0ff, scale: 0.95 },
          { op: "bolt", color: 0xe0b0ff, charged: true, speed: 46, range: 20, scale: 1.05 },
        ],
      },
      {
        part: 1,
        label: "Arcane Pulse",
        clips: {
          ground: ["cast", "attack"],
          after_skill: ["cast"],
        },
        fallbackClips: ["cast", "attack"],
        window: 0.85,
        castTime: 0.15,
        damage: 12,
        radius: 2.0,
        forceMul: 0.7,
        vfx: [
          { op: "castAura", color: 0xc090ff },
          { op: "hexaring", color: 0xd0a0ff, life: 0.6 },
          { op: "shockwave", color: 0xb080ff, radius: 2.0 },
          { op: "aoeBlast", color: 0xa070f0, radius: 1.8 },
        ],
      },
      {
        part: 2,
        label: "Void Bolt",
        clips: {
          ground: ["cast", "attack"],
          after_skill: ["cast"],
        },
        fallbackClips: ["cast", "attack"],
        window: 0,
        castTime: 0.22,
        damage: 24,
        radius: 1.2,
        forceMul: 0.9,
        vfx: [
          { op: "charge", color: 0x8040c0, scale: 1.3 },
          { op: "bolt", color: 0xa060ff, charged: true, speed: 40, range: 22, scale: 1.4 },
          { op: "beam", color: 0x9060e0, length: 14, life: 0.35 },
          { op: "fireAura", scale: 1.15 },
        ],
      },
    ],
  },
];

export function multiPartFor(weaponId: WeaponId, slot: number): MultiPartSkill | null {
  return (
    MULTI_PART_SKILLS.find((s) => s.weaponId === weaponId && s.slot === slot) ??
    MULTI_PART_SKILLS.find((s) => s.weaponId === "*" && s.slot === slot) ??
    null
  );
}

/** Next part index if chain is live, else 0. */
export function nextSkillPart(
  skill: MultiPartSkill,
  lastSlot: number,
  currentPart: number,
  windowLeft: number,
  pressedSlot: number,
): number {
  if (pressedSlot !== skill.slot) return 0;
  if (lastSlot !== skill.slot || windowLeft <= 0) return 0;
  const next = currentPart + 1;
  return next < skill.parts.length ? next : 0;
}

export function partForContext(
  skill: MultiPartSkill,
  partIndex: number,
  _ctx: CombatContextSnapshot,
): SkillPartDef {
  return skill.parts[Math.min(partIndex, skill.parts.length - 1)]!;
}
