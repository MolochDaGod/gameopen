/**
 * Resolve class actives (Shift+1–5) and passive buffs for upper HUD.
 * Sources: systems classId + harvest skill unlocks + class tree from loadSkillTrees.
 */

import {
  loadClassSkillTreesFromFleet,
  loadSkillUnlocks,
  type SkillNode,
  type SkillTree,
} from "../game/harvestCatalog";
import { resolveSkillNodeIconUrl } from "./skillTreeIcons";
import { loadSystemsState } from "./grudgeSystems/persist";
import { gameSession } from "../game/GameSession";

export type ClassSkillSlot = {
  slot: 1 | 2 | 3 | 4 | 5;
  /** Hotkey label */
  key: string;
  id: string;
  name: string;
  desc: string;
  kind: string;
  iconUrl?: string;
  /** Default CD seconds when cast */
  cooldownSec: number;
  empty?: boolean;
};

export type PassiveBuffIcon = {
  id: string;
  name: string;
  desc: string;
  kind: string;
  iconUrl?: string;
  glyph: string;
  color: string;
  /** Optional bonus summary for tooltip */
  bonusLine?: string;
};

const CLASS_COLORS: Record<string, string> = {
  warrior: "#ef4444",
  mage: "#8b5cf6",
  ranger: "#22c55e",
  worge: "#d97706",
};

const KIND_GLYPH: Record<string, string> = {
  passive: "◆",
  proc: "✦",
  form: "◎",
  selection: "◇",
  bridge: "•",
  milestone: "★",
  active: "▸",
};

let _treeCache: SkillTree[] | null = null;
let _treeCacheAt = 0;

export async function ensureClassTreesCached(): Promise<SkillTree[]> {
  if (_treeCache && Date.now() - _treeCacheAt < 60_000) return _treeCache;
  _treeCache = await loadClassSkillTreesFromFleet();
  _treeCacheAt = Date.now();
  return _treeCache;
}

export function getActiveClassId(characterId?: string | null): string | null {
  const id =
    characterId ||
    gameSession.snapshot.selectedCharacterId ||
    "guest";
  return loadSystemsState(id).classId;
}

function isPassiveNode(n: SkillNode): boolean {
  if (n.passive) return true;
  const k = n.kind || "";
  return k === "passive" || k === "proc" || k === "bridge";
}

function isActiveNode(n: SkillNode): boolean {
  if (isPassiveNode(n)) return false;
  const k = n.kind || "";
  return (
    k === "active" ||
    k === "milestone" ||
    k === "form" ||
    k === "selection" ||
    k === "placeable" ||
    k === "summon" ||
    !k
  );
}

function unlockedSet(): Set<string> {
  return new Set(loadSkillUnlocks());
}

/**
 * Build 5 upper class skill slots for Shift+1…5 from unlocked actives on the
 * selected class tree. Empty slots if no class / fewer unlocks.
 */
export function resolveClassSkillSlots(
  trees: SkillTree[],
  classId: string | null,
): ClassSkillSlot[] {
  const empty = (slot: 1 | 2 | 3 | 4 | 5): ClassSkillSlot => ({
    slot,
    key: `⇧${slot}`,
    id: "",
    name: "—",
    desc: classId ? "Unlock more class skills on the Path" : "Select a class (K → Class)",
    kind: "empty",
    empty: true,
    cooldownSec: 0,
  });

  if (!classId) {
    return [1, 2, 3, 4, 5].map((s) => empty(s as 1 | 2 | 3 | 4 | 5));
  }

  const tree =
    trees.find((t) => t.id === `class-${classId}` || t.classKey === classId) ||
    null;
  const unlocks = unlockedSet();
  // Always treat L0 / auto as available for binding
  const nodes = (tree?.nodes || []).filter(
    (n) => unlocks.has(n.id) || n.auto || n.requiredLevel === 0,
  );

  // Prefer true actives / forms / milestones for hotbar (not pure passives)
  let actives = nodes.filter(isActiveNode);
  // If sparse, allow L0 passives that are forms
  if (actives.length < 5) {
    const extra = nodes.filter(
      (n) => n.kind === "form" || (n.requiredLevel === 0 && !isPassiveNode(n)),
    );
    const seen = new Set(actives.map((a) => a.id));
    for (const e of extra) {
      if (!seen.has(e.id)) {
        actives.push(e);
        seen.add(e.id);
      }
    }
  }
  // Sort: lower requiredLevel first, then name
  actives = [...actives].sort(
    (a, b) => (a.requiredLevel ?? 0) - (b.requiredLevel ?? 0) || a.name.localeCompare(b.name),
  );

  const slots: ClassSkillSlot[] = [];
  for (let i = 0; i < 5; i++) {
    const slot = (i + 1) as 1 | 2 | 3 | 4 | 5;
    const n = actives[i];
    if (!n) {
      slots.push(empty(slot));
      continue;
    }
    const cd =
      typeof n.cost === "number" && n.cost > 0
        ? Math.min(30, 4 + n.cost * 2 + (n.requiredLevel ?? 0) * 0.15)
        : 6;
    slots.push({
      slot,
      key: `⇧${slot}`,
      id: n.id,
      name: n.name,
      desc: n.desc,
      kind: n.kind || "active",
      iconUrl: resolveSkillNodeIconUrl({
        icon: n.icon,
        iconUrl: n.iconUrl,
        id: n.id,
        kind: n.kind,
        treeId: tree?.id,
        classKey: classId || undefined,
      }),
      cooldownSec: Math.round(cd * 10) / 10,
      empty: false,
    });
  }
  return slots;
}

/** Unlocked passives for buff icon row (tooltips). */
export function resolvePassiveBuffs(
  trees: SkillTree[],
  classId: string | null,
): PassiveBuffIcon[] {
  if (!classId) return [];
  const tree =
    trees.find((t) => t.id === `class-${classId}` || t.classKey === classId) ||
    null;
  const unlocks = unlockedSet();
  const color = CLASS_COLORS[classId] || "#6ee7b7";
  const passives = (tree?.nodes || []).filter(
    (n) =>
      (unlocks.has(n.id) || n.auto || n.requiredLevel === 0) && isPassiveNode(n),
  );
  return passives.map((n) => {
    const bonusLine = n.bonuses
      ? Object.entries(n.bonuses)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ")
      : undefined;
    const iconUrl = resolveSkillNodeIconUrl({
      icon: n.icon,
      iconUrl: n.iconUrl,
      id: n.id,
      kind: n.kind,
      treeId: tree?.id,
      classKey: classId || undefined,
    });
    return {
      iconUrl,
      id: n.id,
      name: n.name,
      desc: n.desc,
      kind: n.kind || "passive",
      glyph: KIND_GLYPH[n.kind || "passive"] || "◆",
      color,
      bonusLine,
    };
  });
}

export function classAccent(classId: string | null): string {
  if (!classId) return "#6ee7b7";
  return CLASS_COLORS[classId] || "#6ee7b7";
}
