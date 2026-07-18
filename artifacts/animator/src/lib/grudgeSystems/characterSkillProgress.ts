/**
 * Account character skill points — per tree domain pools, level/tier grants,
 * node activation (cost + prereqs), and aggregated effects.
 *
 * Domains: class · weapon · profession · mastery · camp
 * Storage: GrudgeSystemsState.skillProgress (local + Railway bag per character).
 */

import type { SkillNode, SkillTree } from "../../game/harvestCatalog";
import type { AttrKey, AttrMap } from "./statsEngine";
import { ATTR_KEYS } from "./statsEngine";

// ── Domains ──────────────────────────────────────────────────────────────────

export type SkillPointDomain =
  | "class"
  | "weapon"
  | "profession"
  | "mastery"
  | "camp";

export const SKILL_POINT_DOMAINS: readonly SkillPointDomain[] = [
  "class",
  "weapon",
  "profession",
  "mastery",
  "camp",
] as const;

export const DOMAIN_LABELS: Record<SkillPointDomain, string> = {
  class: "Class",
  weapon: "Weapon",
  profession: "Profession",
  mastery: "Mastery",
  camp: "Camp",
};

// ── Grant scheme (idempotent by grantedThroughLevel / weaponTierGranted) ─────

/** Levels that grant milestone bonuses (class path SSOT: L1/5/10/15/20). */
export const SKILL_MILESTONE_LEVELS = [1, 5, 10, 15, 20] as const;

/**
 * Point grant scheme for account characters.
 *
 * | When | class | weapon | profession | mastery | camp |
 * | --- | --- | --- | --- | --- | --- |
 * | Level 1 starter | 1 | 0 | 1 | 0 | 0 |
 * | Each level 2+ | 1 | 0 | 1 | 0 | 0 |
 * | Milestone 1/5/10/15/20 | +1 | 0 | 0 | +1 | +1 |
 * | Weapon tier 0 (first equip family) | 0 | 1 | 0 | 0 | 0 |
 * | Weapon tier 1–4 | 0 | 2 | 0 | 0 | 0 |
 * | Weapon tier 5 | 0 | 3 | 0 | 0 | 0 |
 *
 * L0 / `auto` nodes: free (no point cost). Other nodes spend `node.cost` (min 1).
 */
export const SKILL_POINT_GRANT = {
  starter: {
    class: 1,
    weapon: 0,
    profession: 1,
    mastery: 0,
    camp: 0,
  } satisfies Record<SkillPointDomain, number>,
  /** Granted once per level for every level ≥ 2. */
  perLevel: {
    class: 1,
    weapon: 0,
    profession: 1,
    mastery: 0,
    camp: 0,
  } satisfies Record<SkillPointDomain, number>,
  /** Extra on milestone levels (including L1 when first applied). */
  milestone: {
    class: 1,
    weapon: 0,
    profession: 0,
    mastery: 1,
    camp: 1,
  } satisfies Record<SkillPointDomain, number>,
  /** Points when a weapon family first reaches that tier (0–5). */
  weaponTier: [1, 2, 2, 2, 2, 3] as const,
} as const;

// ── Effects ──────────────────────────────────────────────────────────────────

export interface SkillEffects {
  /** Flat attribute bonuses (STR, VIT, …). */
  attrs: Partial<AttrMap>;
  maxHp: number;
  maxStamina: number;
  maxMana: number;
  /** Additive damage percent (10 = +10%). */
  damagePct: number;
  critPct: number;
  /** Multiplier on skill CDs (0.85 = 15% faster). Stacked by multiply. */
  cdMul: number;
  moveSpeedPct: number;
  harvestYieldPct: number;
  craftSpeedPct: number;
  /** Free-form tags (forms, procs, playstyle keys). */
  tags: string[];
  /** Active skill / form ids granted for hotbar & combat. */
  grantedSkills: string[];
  /** Raw sum of node.bonuses maps. */
  bonuses: Record<string, number>;
}

export function emptyEffects(): SkillEffects {
  return {
    attrs: {},
    maxHp: 0,
    maxStamina: 0,
    maxMana: 0,
    damagePct: 0,
    critPct: 0,
    cdMul: 1,
    moveSpeedPct: 0,
    harvestYieldPct: 0,
    craftSpeedPct: 0,
    tags: [],
    grantedSkills: [],
    bonuses: {},
  };
}

// ── Progress state ───────────────────────────────────────────────────────────

export interface CharacterSkillProgress {
  version: 1;
  /** Highest character level fully processed by grant scheme. 0 = never. */
  grantedThroughLevel: number;
  /** Weapon family → highest tier (0–5) that already granted points. -1 = none. */
  weaponTierGranted: Record<string, number>;
  /** Unspent points per domain. */
  points: Record<SkillPointDomain, number>;
  /** Lifetime earned (audit). */
  earned: Record<SkillPointDomain, number>;
  /** Lifetime spent. */
  spent: Record<SkillPointDomain, number>;
  /** Activated node ids (all domains). */
  unlocked: string[];
  /** Optional exclusive picks: groupId → nodeId. */
  selections: Record<string, string>;
  /** Cached effects from activated nodes. */
  effects: SkillEffects;
}

function zeroPools(): Record<SkillPointDomain, number> {
  return { class: 0, weapon: 0, profession: 0, mastery: 0, camp: 0 };
}

export function defaultSkillProgress(): CharacterSkillProgress {
  return {
    version: 1,
    grantedThroughLevel: 0,
    weaponTierGranted: {},
    points: zeroPools(),
    earned: zeroPools(),
    spent: zeroPools(),
    unlocked: [],
    selections: {},
    effects: emptyEffects(),
  };
}

/** Normalize partial / legacy payloads. */
export function normalizeSkillProgress(
  raw: Partial<CharacterSkillProgress> | null | undefined,
): CharacterSkillProgress {
  const base = defaultSkillProgress();
  if (!raw || typeof raw !== "object") return base;
  const points = { ...base.points, ...(raw.points || {}) };
  const earned = { ...base.earned, ...(raw.earned || {}) };
  const spent = { ...base.spent, ...(raw.spent || {}) };
  for (const d of SKILL_POINT_DOMAINS) {
    points[d] = Math.max(0, Math.floor(Number(points[d]) || 0));
    earned[d] = Math.max(0, Math.floor(Number(earned[d]) || 0));
    spent[d] = Math.max(0, Math.floor(Number(spent[d]) || 0));
  }
  return {
    version: 1,
    grantedThroughLevel: Math.max(0, Math.floor(Number(raw.grantedThroughLevel) || 0)),
    weaponTierGranted: { ...(raw.weaponTierGranted || {}) },
    points,
    earned,
    spent,
    unlocked: Array.isArray(raw.unlocked)
      ? [...new Set(raw.unlocked.filter((x) => typeof x === "string"))]
      : [],
    selections:
      raw.selections && typeof raw.selections === "object" ? { ...raw.selections } : {},
    effects: mergeEffects(emptyEffects(), raw.effects || emptyEffects()),
  };
}

function mergeEffects(a: SkillEffects, b: Partial<SkillEffects>): SkillEffects {
  const attrs: Partial<AttrMap> = { ...a.attrs, ...(b.attrs || {}) };
  return {
    attrs,
    maxHp: (a.maxHp || 0) + (b.maxHp || 0),
    maxStamina: (a.maxStamina || 0) + (b.maxStamina || 0),
    maxMana: (a.maxMana || 0) + (b.maxMana || 0),
    damagePct: (a.damagePct || 0) + (b.damagePct || 0),
    critPct: (a.critPct || 0) + (b.critPct || 0),
    cdMul: (a.cdMul ?? 1) * (b.cdMul ?? 1),
    moveSpeedPct: (a.moveSpeedPct || 0) + (b.moveSpeedPct || 0),
    harvestYieldPct: (a.harvestYieldPct || 0) + (b.harvestYieldPct || 0),
    craftSpeedPct: (a.craftSpeedPct || 0) + (b.craftSpeedPct || 0),
    tags: [...new Set([...(a.tags || []), ...(b.tags || [])])],
    grantedSkills: [...new Set([...(a.grantedSkills || []), ...(b.grantedSkills || [])])],
    bonuses: { ...a.bonuses, ...(b.bonuses || {}) },
  };
}

// ── Domain resolution ────────────────────────────────────────────────────────

const PROFESSION_TREE_IDS = new Set([
  "harvest",
  "crafting",
  "building",
  "survival",
  "explorer",
  "mining",
  "woodcutting",
  "fishing",
  "cooking",
  "alchemy",
  "smithing",
]);

/**
 * Map a skill tree id → point domain.
 * class-* → class · weapon-combat / weapon-* → weapon · harvest trees → profession
 */
export function domainForTreeId(treeId: string): SkillPointDomain {
  const id = (treeId || "").toLowerCase();
  if (id.startsWith("class-") || id === "class" || id.startsWith("mastery_class")) {
    return "class";
  }
  if (
    id === "weapon-combat" ||
    id.startsWith("weapon-") ||
    id.startsWith("wpn_") ||
    id.startsWith("weapon_")
  ) {
    return "weapon";
  }
  if (id.startsWith("camp") || id.startsWith("camp_")) return "camp";
  if (id.startsWith("mastery") || id.startsWith("mastery_")) return "mastery";
  if (id.startsWith("prof_") || PROFESSION_TREE_IDS.has(id)) return "profession";
  // Default harvest/content trees → profession
  if (!id.startsWith("class")) return "profession";
  return "class";
}

// ── Point grants ─────────────────────────────────────────────────────────────

function addPoints(
  progress: CharacterSkillProgress,
  domain: SkillPointDomain,
  amount: number,
): void {
  if (amount <= 0) return;
  progress.points[domain] = (progress.points[domain] || 0) + amount;
  progress.earned[domain] = (progress.earned[domain] || 0) + amount;
}

/**
 * Apply level-based grants up through `level` (idempotent).
 * Call on load, level-up, and systems level slider.
 */
export function grantPointsForLevel(
  progress: CharacterSkillProgress,
  level: number,
): CharacterSkillProgress {
  const next = normalizeSkillProgress(progress);
  const lv = Math.max(1, Math.min(100, Math.floor(level)));
  const from = next.grantedThroughLevel;

  // First-time: starter at level 1
  if (from < 1 && lv >= 1) {
    for (const d of SKILL_POINT_DOMAINS) {
      addPoints(next, d, SKILL_POINT_GRANT.starter[d]);
    }
    // L1 is a milestone — apply milestone bonus once when crossing to ≥1
    for (const d of SKILL_POINT_DOMAINS) {
      addPoints(next, d, SKILL_POINT_GRANT.milestone[d]);
    }
    next.grantedThroughLevel = 1;
  }

  // Levels 2..lv
  for (let L = Math.max(2, from + 1); L <= lv; L++) {
    for (const d of SKILL_POINT_DOMAINS) {
      addPoints(next, d, SKILL_POINT_GRANT.perLevel[d]);
    }
    if ((SKILL_MILESTONE_LEVELS as readonly number[]).includes(L)) {
      for (const d of SKILL_POINT_DOMAINS) {
        addPoints(next, d, SKILL_POINT_GRANT.milestone[d]);
      }
    }
    next.grantedThroughLevel = L;
  }

  return next;
}

/**
 * Grant weapon-domain points for tiers up through `tier` on a family (idempotent).
 * `tier` is 0–5 (weapon tree tier).
 */
export function grantPointsForWeaponTier(
  progress: CharacterSkillProgress,
  family: string,
  tier: number,
): CharacterSkillProgress {
  const next = normalizeSkillProgress(progress);
  const fam = (family || "sword").toLowerCase().replace(/\s+/g, "_");
  const t = Math.max(0, Math.min(5, Math.floor(tier)));
  const already = next.weaponTierGranted[fam] ?? -1;
  for (let i = already + 1; i <= t; i++) {
    const pts = SKILL_POINT_GRANT.weaponTier[i] ?? 1;
    addPoints(next, "weapon", pts);
    next.weaponTierGranted[fam] = i;
  }
  return next;
}

/**
 * Map systems mastery XP → weapon tier 0–5 and grant missing points.
 * Novice(1)→T0 … Expert(4)→T3 … Legend(7)→T5.
 */
export function grantPointsFromMasteryXp(
  progress: CharacterSkillProgress,
  family: string,
  xp: number,
  tierFromXp: (xp: number) => number,
): CharacterSkillProgress {
  const masteryTier = Math.max(1, tierFromXp(xp)); // 1–7
  const weaponTier = Math.min(5, Math.max(0, masteryTier - 1));
  return grantPointsForWeaponTier(progress, family, weaponTier);
}

// ── Node cost / free ─────────────────────────────────────────────────────────

/** L0 selection + auto nodes cost 0 skill points. */
export function nodePointCost(node: Pick<SkillNode, "cost" | "auto" | "requiredLevel">): number {
  if (node.auto || (node.requiredLevel ?? 0) === 0) return 0;
  const c = Number(node.cost);
  if (!Number.isFinite(c) || c < 0) return 1;
  return Math.floor(c);
}

export function canAfford(
  progress: CharacterSkillProgress,
  domain: SkillPointDomain,
  cost: number,
): boolean {
  if (cost <= 0) return true;
  return (progress.points[domain] || 0) >= cost;
}

// ── Activation ───────────────────────────────────────────────────────────────

export type ActivateResult =
  | { ok: true; progress: CharacterSkillProgress; effects: SkillEffects }
  | { ok: false; reason: string; progress: CharacterSkillProgress };

export function canActivateNode(
  progress: CharacterSkillProgress,
  node: SkillNode,
  opts: { playerLevel: number; treeId: string; domain?: SkillPointDomain },
): { ok: boolean; reason?: string; cost: number; domain: SkillPointDomain } {
  const domain = opts.domain ?? domainForTreeId(opts.treeId);
  const cost = nodePointCost(node);
  if (progress.unlocked.includes(node.id)) {
    return { ok: false, reason: "Already active", cost, domain };
  }
  const needLv = node.requiredLevel ?? 0;
  if (needLv > opts.playerLevel) {
    return { ok: false, reason: `Need level ${needLv}`, cost, domain };
  }
  const reqOk = (node.requires || []).every((r) => progress.unlocked.includes(r));
  if (!reqOk) {
    return { ok: false, reason: "Requires prior nodes", cost, domain };
  }
  if (!canAfford(progress, domain, cost)) {
    return {
      ok: false,
      reason: `Need ${cost} ${DOMAIN_LABELS[domain]} point${cost === 1 ? "" : "s"}`,
      cost,
      domain,
    };
  }
  return { ok: true, cost, domain };
}

/**
 * Activate (unlock) a node: spend points, add to unlocked, recompute effects.
 * Free nodes (L0/auto) still get granted without spend.
 */
export function activateNode(
  progress: CharacterSkillProgress,
  node: SkillNode,
  opts: {
    playerLevel: number;
    treeId: string;
    domain?: SkillPointDomain;
    /** All loaded trees — used to rebuild effects from node definitions. */
    allNodes?: SkillNode[];
  },
): ActivateResult {
  const gate = canActivateNode(progress, node, opts);
  if (!gate.ok) {
    return { ok: false, reason: gate.reason || "Cannot activate", progress };
  }

  const next = normalizeSkillProgress(progress);
  if (gate.cost > 0) {
    next.points[gate.domain] = Math.max(0, (next.points[gate.domain] || 0) - gate.cost);
    next.spent[gate.domain] = (next.spent[gate.domain] || 0) + gate.cost;
  }
  next.unlocked = [...new Set([...next.unlocked, node.id])];

  // Selection group: exclusive pick for L0 / selection kind under tree
  if (node.kind === "selection" || (node.requiredLevel ?? 0) === 0) {
    next.selections[opts.treeId] = node.id;
  }

  // Rebuild effects from known node list when provided
  const catalog = opts.allNodes || [node];
  next.effects = computeEffectsFromUnlocks(next.unlocked, catalog);

  return { ok: true, progress: next, effects: next.effects };
}

/** Grant free auto/L0 nodes without spending points. */
export function grantFreeNodes(
  progress: CharacterSkillProgress,
  tree: SkillTree,
): CharacterSkillProgress {
  const next = normalizeSkillProgress(progress);
  let changed = false;
  for (const n of tree.nodes) {
    if ((n.auto || (n.requiredLevel ?? 0) === 0) && !next.unlocked.includes(n.id)) {
      next.unlocked.push(n.id);
      changed = true;
    }
  }
  if (changed) {
    next.effects = computeEffectsFromUnlocks(next.unlocked, tree.nodes);
  }
  return next;
}

// ── Effect import from node definitions ──────────────────────────────────────

const ATTR_ALIASES: Record<string, AttrKey> = {
  str: "STR",
  strength: "STR",
  vit: "VIT",
  vitality: "VIT",
  end: "END",
  endurance: "END",
  int: "INT",
  intellect: "INT",
  intelligence: "INT",
  wis: "WIS",
  wisdom: "WIS",
  dex: "DEX",
  dexterity: "DEX",
  agi: "AGI",
  agility: "AGI",
  tac: "TAC",
  tactics: "TAC",
};

/**
 * Parse a single node into effect deltas.
 * Uses `bonuses` map + formId + kind tags.
 */
export function effectsFromNode(node: SkillNode): SkillEffects {
  const e = emptyEffects();
  const b = node.bonuses || {};

  for (const [rawKey, rawVal] of Object.entries(b)) {
    const key = rawKey.toLowerCase().replace(/\s+/g, "");
    const val = Number(rawVal);
    if (!Number.isFinite(val)) continue;

    e.bonuses[rawKey] = (e.bonuses[rawKey] || 0) + val;

    const attr = ATTR_ALIASES[key] || (ATTR_KEYS.includes(rawKey as AttrKey) ? (rawKey as AttrKey) : null);
    if (attr) {
      e.attrs[attr] = (e.attrs[attr] || 0) + val;
      continue;
    }

    switch (key) {
      case "hp":
      case "maxhp":
      case "health":
        e.maxHp += val;
        break;
      case "stamina":
      case "maxstamina":
        e.maxStamina += val;
        break;
      case "mana":
      case "maxmana":
        e.maxMana += val;
        break;
      case "damage":
      case "dmg":
      case "damagepct":
      case "dmgpct":
        e.damagePct += val;
        break;
      case "crit":
      case "critpct":
      case "critchance":
        e.critPct += val;
        break;
      case "cdr":
      case "cooldown":
      case "cdmul":
        // bonuses.cdr 10 → 0.90 mul; bonuses.cdMul 0.9 used as-is if < 1
        if (val > 0 && val < 1) e.cdMul *= val;
        else if (val > 0) e.cdMul *= Math.max(0.5, 1 - val / 100);
        break;
      case "movespeed":
      case "speed":
      case "movespeedpct":
        e.moveSpeedPct += val;
        break;
      case "harvest":
      case "harvestyield":
      case "yield":
        e.harvestYieldPct += val;
        break;
      case "craft":
      case "craftspeed":
        e.craftSpeedPct += val;
        break;
      default:
        break;
    }
  }

  if (node.formId) {
    e.grantedSkills.push(node.formId);
    e.tags.push(`form:${node.formId}`);
  }
  if (node.kind === "proc") e.tags.push(`proc:${node.id}`);
  if (node.kind === "passive" || node.passive) e.tags.push(`passive:${node.id}`);
  if (node.kind === "active") e.grantedSkills.push(node.id);
  // Always tag activated node for systems queries
  e.tags.push(node.id);

  return e;
}

/** Rebuild full effects from unlocked node ids + catalog nodes. */
export function computeEffectsFromUnlocks(
  unlocked: string[],
  catalog: SkillNode[],
): SkillEffects {
  const byId = new Map(catalog.map((n) => [n.id, n]));
  let acc = emptyEffects();
  for (const id of unlocked) {
    const node = byId.get(id);
    if (!node) {
      // Unknown id — still keep as tag so hotbar gates work
      acc.tags.push(id);
      continue;
    }
    acc = mergeEffects(acc, effectsFromNode(node));
  }
  // Sum bonuses maps properly (mergeEffects overwrites; re-sum)
  const bonuses: Record<string, number> = {};
  for (const id of unlocked) {
    const node = byId.get(id);
    if (!node?.bonuses) continue;
    for (const [k, v] of Object.entries(node.bonuses)) {
      bonuses[k] = (bonuses[k] || 0) + Number(v || 0);
    }
  }
  acc.bonuses = bonuses;
  return acc;
}

/**
 * Apply skill effects onto base attrs for derived stats.
 */
export function attrsWithSkillEffects(base: AttrMap, effects: SkillEffects): AttrMap {
  const out = { ...base };
  for (const k of ATTR_KEYS) {
    out[k] = (out[k] || 0) + (effects.attrs[k] || 0);
  }
  return out;
}

/** CD multiplier combining weapon master flag + skill tree effects. */
export function combinedCdMul(
  effects: SkillEffects,
  unlocks: string[],
): number {
  let m = effects.cdMul || 1;
  if (unlocks.includes("w_master")) m *= 0.85;
  return Math.max(0.5, Math.min(1, m));
}

// ── Migration / ensure ───────────────────────────────────────────────────────

/**
 * Ensure progress is granted through current level and free nodes applied.
 * Call whenever character systems state loads or level changes.
 */
export function ensureProgressSynced(
  progress: CharacterSkillProgress,
  level: number,
  trees?: SkillTree[],
): CharacterSkillProgress {
  let next = grantPointsForLevel(progress, level);
  if (trees?.length) {
    const allNodes: SkillNode[] = [];
    for (const t of trees) {
      next = grantFreeNodes(next, t);
      allNodes.push(...t.nodes);
    }
    next.effects = computeEffectsFromUnlocks(next.unlocked, allNodes);
  }
  return next;
}

/**
 * Migrate legacy flat unlock list into progress (merge, no double-spend).
 */
export function mergeLegacyUnlocks(
  progress: CharacterSkillProgress,
  legacyUnlocks: string[],
  catalog?: SkillNode[],
): CharacterSkillProgress {
  const next = normalizeSkillProgress(progress);
  const set = new Set([...next.unlocked, ...legacyUnlocks]);
  next.unlocked = [...set];
  if (catalog?.length) {
    next.effects = computeEffectsFromUnlocks(next.unlocked, catalog);
  }
  return next;
}
