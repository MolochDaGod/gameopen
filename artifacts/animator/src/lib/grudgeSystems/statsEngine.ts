/**
 * 8-attribute + derived stats + combat pipeline.
 * Ported from grudge-character-creator StatsEngine (GrudgeBuilder SSOT).
 */

export const ATTRIBUTES = {
  STR: {
    name: "Strength",
    color: "#ef4444",
    icon: "⚔️",
    desc: "Physical power. Melee damage, health, block factor, defense.",
  },
  VIT: {
    name: "Vitality",
    color: "#22c55e",
    icon: "❤️",
    desc: "Toughness. Max HP, HP regen, damage reduction, defense.",
  },
  END: {
    name: "Endurance",
    color: "#14b8a6",
    icon: "🛡️",
    desc: "Stamina and defense. Block chance, CC resist, armor.",
  },
  INT: {
    name: "Intellect",
    color: "#8b5cf6",
    icon: "🔮",
    desc: "Arcane mastery. Spell damage, mana pool, cooldown reduction.",
  },
  WIS: {
    name: "Wisdom",
    color: "#3b82f6",
    icon: "📖",
    desc: "Insight. Mana, resistance, spell accuracy, status effects.",
  },
  DEX: {
    name: "Dexterity",
    color: "#f97316",
    icon: "🏹",
    desc: "Precision. Crit chance, accuracy, attack speed, evasion.",
  },
  AGI: {
    name: "Agility",
    color: "#eab308",
    icon: "💨",
    desc: "Speed and reflexes. Move speed, evasion, dodge, crit evasion.",
  },
  TAC: {
    name: "Tactics",
    color: "#ec4899",
    icon: "🎯",
    desc: "Strategy. Armor penetration, block break, combo cooldowns.",
  },
} as const;

export type AttrKey = keyof typeof ATTRIBUTES;
export const ATTR_KEYS = Object.keys(ATTRIBUTES) as AttrKey[];
export const MAX_POINTS = 160;

export type AttrMap = Record<AttrKey, number>;

export function defaultAttrs(): AttrMap {
  return { STR: 10, VIT: 10, END: 10, INT: 10, WIS: 10, DEX: 10, AGI: 10, TAC: 10 };
}

/** Diminishing returns: 1–25 full, 26–50 half, 51+ quarter. */
export function effectivePoints(raw: number): number {
  if (raw <= 25) return raw;
  if (raw <= 50) return 25 + (raw - 25) * 0.5;
  return 25 + 12.5 + (raw - 50) * 0.25;
}

export type DerivedStats = Record<string, number>;

export function calculateDerivedStats(attrs: Partial<AttrMap>, level = 1): DerivedStats {
  const e: Record<string, number> = {};
  for (const key of ATTR_KEYS) {
    e[key] = effectivePoints(attrs[key] || 0);
  }

  const stats: DerivedStats = {};
  stats.meleeAttack = Math.floor(
    level * 2 +
      e.STR * 3 +
      e.DEX * 3 +
      e.AGI * 3 +
      e.VIT * 2 +
      e.TAC * 3 +
      20 * (e.STR * 0.02 + e.DEX * 0.018 + e.AGI * 0.016 + e.VIT * 0.001 + e.TAC * 0.002),
  );
  stats.rangedAttack = Math.floor(level * 2 + e.DEX * 4 + e.AGI * 2 + e.TAC * 1.5);
  stats.spellPower = Math.floor(
    level * 2 + e.INT * 4 + e.WIS * 2 + 20 * (e.INT * 0.025 + e.WIS * 0.015),
  );
  stats.attackSpeed = Math.min(2.5, 1.0 + e.DEX * 0.015 + e.AGI * 0.005);
  stats.critChance = Math.min(75, 5 + e.DEX * 0.5 + e.AGI * 0.42 + e.STR * 0.32 + e.TAC * 0.02);
  stats.critDamage = 150 + e.STR * 1.1 + e.DEX * 0.2 + 150 * (e.STR * 0.015);
  stats.defenseBreak = e.TAC * 0.1 + e.STR * 0.3;

  stats.maxHP = Math.floor(
    100 + level * 10 + e.STR * 26 + e.VIT * 25 + e.END * 10 + e.WIS * 10 + e.AGI * 2 + e.TAC * 10,
  );
  stats.maxMana = Math.floor(50 + level * 5 + e.INT * 5 + e.VIT * 2 + e.WIS * 20);
  stats.maxStamina = Math.floor(100 + e.VIT * 5 + e.END * 1 + e.AGI * 5 + e.TAC * 1);
  stats.defense = Math.floor(
    10 +
      level +
      e.STR * 12 +
      e.VIT * 12 +
      e.END * 12 +
      e.INT * 2 +
      e.WIS * 2 +
      e.DEX * 10 +
      e.AGI * 5 +
      e.TAC * 5,
  );
  stats.magicResist = Math.floor(
    e.INT * 0.38 + e.VIT * 0.5 + e.END * 0.46 + e.WIS * 0.5 + 10 * (e.INT * 0.17),
  );
  stats.blockChance = Math.min(
    75,
    e.STR * 0.5 +
      e.END * 0.11 +
      e.DEX * 0.41 +
      e.TAC * 0.27 +
      5 * (e.STR * 0.05 + e.END * 0.735 + e.DEX * 0.01 + e.TAC * 0.008),
  );
  stats.blockFactor = Math.min(80, 20 + e.STR * 0.5 + e.VIT * 0.3);
  stats.dodgeChance = Math.min(50, e.DEX * 0.125 + e.AGI * 0.225);
  stats.critEvasion = Math.min(50, e.AGI * 0.25 + e.WIS * 0.2);

  stats.hpRegen = +(1 + e.VIT * 0.06 + e.END * 0.02 + e.STR * 0.02).toFixed(1);
  stats.manaRegen = +(1 + e.WIS * 0.4 + e.INT * 0.04).toFixed(1);
  stats.staminaRegen = +(5 + e.END * 0.5 + e.VIT * 0.1).toFixed(1);

  stats.moveSpeed = +(5 + e.AGI * 0.15).toFixed(2);
  stats.sprintDuration = +(3 + e.END * 0.1).toFixed(1);

  stats.drainHealth = Math.min(50, e.STR * 0.075 + e.VIT * 0.1);
  stats.reflectDamage = Math.min(50, e.STR * 0.15 + e.VIT * 0.1);
  stats.absorbFactor = Math.min(50, e.VIT * 0.2 + e.END * 0.1);
  stats.armorPenetration = Math.min(75, e.TAC * 0.2);
  stats.blockPenetration = Math.min(75, e.TAC * 0.175);
  stats.accuracy = Math.min(
    100,
    e.INT * 0.12 + e.DEX * 0.7 + 50 * (e.INT * 0.338 + e.DEX * 0.015),
  );
  stats.carryWeight = Math.floor(50 + e.STR * 3 + e.END * 2);
  stats.cooldownReduction = Math.min(40, e.INT * 0.075 + e.TAC * 0.05 + e.WIS * 0.3);
  stats.ccResistance = Math.min(75, e.END * 0.1);
  stats.abilityCostRed = Math.min(30, e.TAC * 0.075 + e.INT * 0.05);
  stats.comboCooldownRed = Math.min(25, e.TAC * 0.125);
  stats.miningBonus = +(e.STR * 0.2 + e.END * 0.1).toFixed(1);
  stats.craftingBonus = +(e.DEX * 0.2 + e.INT * 0.1).toFixed(1);
  stats.harvestBonus = +(e.END * 0.2 + e.VIT * 0.1).toFixed(1);

  const physDps =
    stats.meleeAttack *
    (1 + (stats.critChance / 100) * (stats.critDamage / 100)) *
    (1 + stats.attackSpeed / 100);
  const ehp = stats.maxHP * (1 + stats.defense / 1000) * (1 + stats.magicResist / 100);
  const utility = stats.moveSpeed * 2 + stats.dodgeChance * 3 + stats.blockChance * 2;
  stats.combatPower = Math.floor(ehp * 0.4 + physDps * 2.5 + utility * 5);

  return stats;
}

export type CombatSimResult = { damage: number; crit: boolean; blocked: boolean; log: string[] };

export function simulateCombat(
  attackerStats: DerivedStats,
  defenderStats: DerivedStats,
  opts: { variance?: boolean; isSpell?: boolean } = {},
): CombatSimResult {
  const log: string[] = [];
  let baseDmg = opts.isSpell ? attackerStats.spellPower : attackerStats.meleeAttack;
  log.push(`1. Base Damage: ${baseDmg}`);

  const effectiveDefense = Math.max(0, defenderStats.defense - (attackerStats.defenseBreak || 0));
  log.push(`2. Defense Break: ${defenderStats.defense} → ${effectiveDefense.toFixed(0)}`);

  const mitigation = Math.min(90, Math.sqrt(effectiveDefense));
  let damage = baseDmg * (100 - mitigation) / 100;
  log.push(`3. Mitigation: √${effectiveDefense.toFixed(0)} = ${mitigation.toFixed(1)}% → ${damage.toFixed(0)}`);

  if (opts.variance !== false) {
    const roll = 0.75 + Math.random() * 0.5;
    damage *= roll;
    log.push(`4. Variance ×${roll.toFixed(2)} → ${damage.toFixed(0)}`);
  } else {
    log.push(`4. Variance skipped`);
  }

  let crit = false;
  if (Math.random() * 100 < (attackerStats.critChance || 0)) {
    crit = true;
    damage *= (attackerStats.critDamage || 150) / 100;
    log.push(`5. CRITICAL ×${((attackerStats.critDamage || 150) / 100).toFixed(2)} → ${damage.toFixed(0)}`);
  } else {
    log.push(`5. No crit`);
  }

  let blocked = false;
  if (Math.random() * 100 < (defenderStats.blockChance || 0)) {
    blocked = true;
    const factor = (defenderStats.blockFactor || 20) / 100;
    damage *= 1 - factor;
    log.push(`6. BLOCKED −${(factor * 100).toFixed(0)}% → ${damage.toFixed(0)}`);
  } else {
    log.push(`6. Not blocked`);
  }

  if (Math.random() * 100 < (defenderStats.dodgeChance || 0) * 0.5) {
    damage = 0;
    log.push(`7. DODGED → 0`);
  } else {
    log.push(`7. Hit connects`);
  }

  damage = Math.max(0, Math.floor(damage));
  log.push(`8. Final damage: ${damage}`);
  return { damage, crit, blocked, log };
}

export const DERIVED_SECTIONS: Array<{
  title: string;
  css: string;
  stats: Record<string, string>;
}> = [
  {
    title: "⚔️ Offense",
    css: "offense",
    stats: {
      meleeAttack: "Melee ATK",
      rangedAttack: "Ranged ATK",
      spellPower: "Spell Power",
      attackSpeed: "ATK Speed",
      critChance: "Crit %",
      critDamage: "Crit DMG %",
      defenseBreak: "Def Break",
      armorPenetration: "Armor Pen",
      accuracy: "Accuracy",
    },
  },
  {
    title: "🛡️ Defense",
    css: "defense",
    stats: {
      maxHP: "Max HP",
      maxMana: "Max Mana",
      maxStamina: "Max Stamina",
      defense: "Defense",
      magicResist: "Magic Res",
      blockChance: "Block %",
      blockFactor: "Block Factor",
      dodgeChance: "Dodge %",
      critEvasion: "Crit Evasion",
      ccResistance: "CC Resist",
      absorbFactor: "Absorb %",
    },
  },
  {
    title: "💚 Regen",
    css: "regen",
    stats: {
      hpRegen: "HP / sec",
      manaRegen: "Mana / sec",
      staminaRegen: "Stam / sec",
    },
  },
  {
    title: "⚡ Utility",
    css: "utility",
    stats: {
      moveSpeed: "Move Speed",
      cooldownReduction: "CDR %",
      abilityCostRed: "Cost Reduce %",
      comboCooldownRed: "Combo CDR %",
      carryWeight: "Carry Weight",
      miningBonus: "Mining +",
      craftingBonus: "Crafting +",
      harvestBonus: "Harvest +",
    },
  },
  {
    title: "💀 Summary",
    css: "offense",
    stats: { combatPower: "Combat Power" },
  },
];
