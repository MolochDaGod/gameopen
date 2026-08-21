/**
 * Pro Melee Axe Pack + Male Injured Pack — fleet role SSOT.
 *
 * Source FBX: public/anim/pro-melee-axe/, public/anim/male-injured/
 * Bakes: public/anims/baked/pro_melee_axe/, pro_melee_axe_mirror/, male_injured/
 * Bake: node scripts/bake-pro-melee-axe-injured.mjs
 *
 * Best practices:
 *  - Every clip has a role; do not leave orphan FBX unused.
 *  - Locomotion cycles loop; attacks one-shot; injured pack = slowed/wounded gait.
 *  - Off-hand warrior: use pro_melee_axe_mirror/* (L/R bone swap + quat mirror).
 *  - Bip001 rotation-only; hip Y/XZ owned by controller.
 */

/** Bake pack folder under /anims/baked/ */
export type MeleeAxeBakePack = "pro_melee_axe" | "pro_melee_axe_mirror";
export type InjuredBakePack = "male_injured";

/** Primary 1H axe / melee attack set (right hand). */
export const PRO_MELEE_AXE_ATTACK_ROLES = {
  /** LMB primary */
  attack: "pro_melee_axe/attack",
  attackDown: "pro_melee_axe/attack_down",
  attackBackhand: "pro_melee_axe/attack_backhand",
  attack360High: "pro_melee_axe/attack_360_high",
  attack360Low: "pro_melee_axe/attack_360_low",
  kick1: "pro_melee_axe/attack_kick_1",
  kick2: "pro_melee_axe/attack_kick_2",
  combo1: "pro_melee_axe/combo_1",
  combo2: "pro_melee_axe/combo_2",
  combo3: "pro_melee_axe/combo_3",
  jumpAttack: "pro_melee_axe/jump_attack",
} as const;

/** Off-hand mirror (same roles under pro_melee_axe_mirror/). */
export function mirrorAxeRole(bakeRel: string): string {
  return bakeRel.replace(/^pro_melee_axe\//, "pro_melee_axe_mirror/");
}

export const PRO_MELEE_AXE_LOCO = {
  idle: "pro_melee_axe/idle",
  idleLook1: "pro_melee_axe/idle_look_1",
  idleLook2: "pro_melee_axe/idle_look_2",
  walk: "pro_melee_axe/walk",
  walkBack: "pro_melee_axe/walk_back",
  walkLeft: "pro_melee_axe/walk_left",
  walkRight: "pro_melee_axe/walk_right",
  run: "pro_melee_axe/run",
  runBack: "pro_melee_axe/run_back",
  jump: "pro_melee_axe/jump",
  turnLeft: "pro_melee_axe/turn_left",
  turnRight: "pro_melee_axe/turn_right",
  crouchIdle: "pro_melee_axe/crouch_idle",
  crouchStand: "pro_melee_axe/crouch_stand",
} as const;

export const PRO_MELEE_AXE_DEFENSE = {
  blockIdle: "pro_melee_axe/block_idle",
  blockHit: "pro_melee_axe/block_hit",
  hitLeft: "pro_melee_axe/hit_left",
  hitRight: "pro_melee_axe/hit_right",
  hitGut: "pro_melee_axe/hit_gut",
} as const;

export const PRO_MELEE_AXE_UTILITY = {
  equipShoulder: "pro_melee_axe/equip_shoulder",
  equipUnderarm: "pro_melee_axe/equip_underarm",
  disarmShoulder: "pro_melee_axe/disarm_shoulder",
  disarmUnderarm: "pro_melee_axe/disarm_underarm",
  tauntBattlecry: "pro_melee_axe/taunt_battlecry",
  tauntChest: "pro_melee_axe/taunt_chest",
} as const;

/** Unarmed subset inside the same pack (sheathed / switch). */
export const PRO_MELEE_AXE_UNARMED = {
  idle: "pro_melee_axe/unarmed_idle",
  walk: "pro_melee_axe/unarmed_walk",
  walkBack: "pro_melee_axe/unarmed_walk_back",
  run: "pro_melee_axe/unarmed_run",
  runBack: "pro_melee_axe/unarmed_run_back",
  jump: "pro_melee_axe/unarmed_jump",
  jumpRun: "pro_melee_axe/unarmed_jump_run",
  turnLeft: "pro_melee_axe/unarmed_turn_left",
  turnRight: "pro_melee_axe/unarmed_turn_right",
} as const;

/**
 * Male Injured Pack — use for:
 *  - wounded (low HP)
 *  - slowed (status slow / root residual)
 * Do NOT use as default healthy loco.
 */
export const MALE_INJURED_ROLES = {
  idle: "male_injured/idle",
  hurtIdle: "male_injured/hurt_idle",
  stumbleIdle: "male_injured/stumble_idle",
  waveIdle: "male_injured/wave_idle",
  walk: "male_injured/walk",
  walkBack: "male_injured/walk_back",
  walkLeft: "male_injured/walk_left",
  walkRight: "male_injured/walk_right",
  run: "male_injured/run",
  runBack: "male_injured/run_back",
  runLeft: "male_injured/run_left",
  runRight: "male_injured/run_right",
  runBackLeft: "male_injured/run_back_left",
  runBackRight: "male_injured/run_back_right",
  turnLeft: "male_injured/turn_left",
  turnRight: "male_injured/turn_right",
  turnBackLeft: "male_injured/turn_back_left",
  turnBackRight: "male_injured/turn_back_right",
  jump: "male_injured/jump",
  runJump: "male_injured/run_jump",
} as const;

/** Explorer axe weapon class wiring (paths relative to anim/ or baked/). */
export const EXPLORER_AXE_CLIP_MAP = {
  loco: {
    idle: "pro_melee_axe/idle",
    walkF: "pro_melee_axe/walk",
    walkB: "pro_melee_axe/walk_back",
    walkL: "pro_melee_axe/walk_left",
    walkR: "pro_melee_axe/walk_right",
    runF: "pro_melee_axe/run",
    runB: "pro_melee_axe/run_back",
  },
  actions: {
    attack1: "pro_melee_axe/combo_1",
    attack2: "pro_melee_axe/combo_2",
    attack3: "pro_melee_axe/combo_3",
    attack4: "pro_melee_axe/attack",
    attack5: "pro_melee_axe/attack_down",
    attack6: "pro_melee_axe/attack_backhand",
    skill: "pro_melee_axe/attack_360_high",
    skill2: "pro_melee_axe/attack_360_low",
    dashAttack: "pro_melee_axe/jump_attack",
    kick: "pro_melee_axe/attack_kick_1",
    kick2: "pro_melee_axe/attack_kick_2",
    blockStart: "pro_melee_axe/block_idle",
    blockIdle: "pro_melee_axe/block_idle",
    hit: "pro_melee_axe/hit_gut",
    turnL: "pro_melee_axe/turn_left",
    turnR: "pro_melee_axe/turn_right",
    draw: "pro_melee_axe/equip_underarm",
    sheath: "pro_melee_axe/disarm_underarm",
  },
  /** LMB chain — every combo clip used in order */
  combo: ["attack1", "attack2", "attack3", "attack4"] as const,
};

/**
 * Gait selector: healthy axe loco vs injured (slow/wound).
 * Call from controller when status slow or hp% low.
 */
export function selectLocoPack(opts: {
  slowed?: boolean;
  wounded?: boolean;
  hpFrac?: number;
}): "pro_melee_axe" | "male_injured" {
  if (opts.slowed) return "male_injured";
  if (opts.wounded) return "male_injured";
  if (opts.hpFrac != null && opts.hpFrac < 0.35) return "male_injured";
  return "pro_melee_axe";
}

/** Off-hand attack path for dual-wield warrior (mirror bake). */
export function offhandAxeAttackRel(role: keyof typeof PRO_MELEE_AXE_ATTACK_ROLES): string {
  return mirrorAxeRole(PRO_MELEE_AXE_ATTACK_ROLES[role]);
}
