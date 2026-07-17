# Class skill path — existing SSOT + additive bridges

**Do not invent parallel class systems.** Class combat content stays in fleet catalogs.

## Canonical sources

| Source | Role |
|--------|------|
| https://character.grudge-studio.com/skills | Character Studio skills page |
| `master-skillTrees.json` | Milestone bands L1 / L5 / L10 / L15 / L20 |
| `class-skill-bridges.json` | **Additive** L0 + bridge nodes (passives/procs/HP) between milestones |
| `classes.json` | Class abilities / icons |
| `class-relic-skillTrees.json` | Relics (e.g. Worge Bear start) |
| `ClassSkillTreePanel` | Path · Book · Talents UI |

## Progression (system in place)

1. **Select one class** from the row (unless special cases like Worge starting forms).  
2. **L0** auto-granted on selection (`w_l0_*` / `m_l0_*` / `r_l0_*` / `wr_l0_bear`).  
3. **L1** starting band from existing master-skillTrees.  
4. **Bridge nodes** at levels 2–4, 6–9, 11–14, 16–19 — choose passives, procs, health, selections.  
5. **Milestones L5 / L10 / L15 / L20** from existing master-skillTrees.  

Gated by character level + prior node `requires` (same unlock store as harvest skill book).

## UI

- **Path** (default): horizontal milestone rail + bridge columns  
- **Book** / **Talents**: existing Craftpix layouts  

Open: **K → Class**, or **P → Skill trees**.
