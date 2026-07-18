# Account character skill points & trees

**SSOT module:** `artifacts/animator/src/lib/grudgeSystems/characterSkillProgress.ts`  
**Persist:** `GrudgeSystemsState.skillProgress` in bag `grudgeSystems` (local + Railway per character)  
**Bridge:** `skillProgressBridge.ts` — active character unlocks for combat/HUD

> **Not a combat runtime.** Skill points / trees only unlock nodes and feed stat/effect bonuses.  
> **Combat mode** (loco, soft lock, RMB focus, attack anims) is the **Danger Room stack** — see [DANGER_ROOM_COMBAT_STACK.md](./DANGER_ROOM_COMBAT_STACK.md).

## Domains (separate point pools)

| Domain | Trees | Spent on |
| --- | --- | --- |
| **class** | `class-warrior` / mage / ranger / worge | Path nodes (milestones + bridges) |
| **weapon** | `weapon-combat`, `weapon-*`, mastery-linked families | Weapon skill nodes |
| **profession** | harvest / crafting / building / … | Profession tree nodes |
| **mastery** | mastery_* | Mastery passives |
| **camp** | camp_claim / farm / build / … | Camp account trees |

## Grant scheme (idempotent)

Points are granted **once** when a character first reaches a level or weapon tier (`grantedThroughLevel`, `weaponTierGranted`).

| When | class | weapon | profession | mastery | camp |
| --- | ---: | ---: | ---: | ---: | ---: |
| **Starter (L1 first time)** | 1 | 0 | 1 | 0 | 0 |
| **Each level ≥ 2** | 1 | 0 | 1 | 0 | 0 |
| **Milestone L1 / L5 / L10 / L15 / L20** | +1 | 0 | 0 | +1 | +1 |
| **Weapon tier 0** (family first) | 0 | 1 | 0 | 0 | 0 |
| **Weapon tier 1–4** | 0 | 2 | 0 | 0 | 0 |
| **Weapon tier 5** | 0 | 3 | 0 | 0 | 0 |

Weapon tiers also advance from **mastery XP** (systems Mastery tab): mastery tier N → weapon tier N−1 (capped 0–5).

**Example L1 new character:** class **2**, profession **1**, mastery **1**, camp **1**.  
**Example L5:** class **7**, profession **5**, mastery **2**, camp **2**.

## Node selection & activation

1. **Free:** `requiredLevel === 0` or `auto: true` (class L0 on class select) — no point cost.
2. **Gates:** character level ≥ `requiredLevel`, all `requires[]` already unlocked, enough domain points.
3. **Cost:** `node.cost` (default 1 if missing); paid from the tree’s domain pool.
4. **Activation:** spend points → append node id to `unlocked` → rebuild **effects**.

UI: `ClassSkillTreePanel` (Path / Book / Talents) + Systems → Class / Wpn Skills.

## Effects (imported from nodes)

From each activated node’s `bonuses` map (+ `formId` / kind):

| Bonus keys | Applied as |
| --- | --- |
| `str` / `STR` / … (8 attrs) | Flat attrs → derived stats |
| `hp` / `maxHp` | +max HP |
| `stamina` / `mana` | +pools |
| `damage` / `damagePct` | +% melee/ranged/spell |
| `crit` / `critPct` | +crit chance |
| `cdr` | CD multiplier |
| `moveSpeed` / `harvest` / `craft` | % bonuses |
| `formId` / `kind: active` | `grantedSkills` for hotbar |
| `kind: proc/passive` | tags for systems |

Effects live on `skillProgress.effects` and feed Systems derived stats.

## Account / character storage

```
saveData.open.bags.grudgeSystems = {
  attrs, level, classId, masteryXp,
  unlocked: string[],          // flat mirror
  skillProgress: {
    version: 1,
    grantedThroughLevel,
    weaponTierGranted,
    points, earned, spent,     // per domain
    unlocked, selections,
    effects
  }
}
```

Legacy global `harvest:skillUnlocks:v1` still mirrored for old readers; **load prefers active character progress**.

## Correct times to call grants

| Event | API |
| --- | --- |
| Character load / systems open | `loadSystemsState` → `ensureProgressSynced` |
| Level change | `grantPointsForLevel(progress, level)` |
| Mastery XP / weapon family open | `grantPointsFromMasteryXp` / `grantPointsForWeaponTier` |
| Class chip select | `grantFreeNodes` + `grantClassSelectionSkills` |
| Node click | `activateNode` |

## Related

- Trees registry: `game/inventory/trees.ts`
- Class path UI: `components/hud/ClassSkillTreePanel.tsx`
- Systems panel: `components/GrudgeSystemsPanel.tsx`
- Fleet trees: `master-skillTrees.json` + bridges
