# Grudge Systems Panel (Creator → Open port)

**Live UX origin:** https://grudge6.grudge-studio.com/creator/ (`mainTabBar`)  
**Source pack:** `F:\GitHub\grudge-character-creator` (`GameData.js`, `StatsEngine.js`, `main.js`)  
**Open surface:** Danger Room + Test Play (`artifacts/animator`)

## What shipped

| Piece | Path |
|-------|------|
| Panel UI | `src/components/GrudgeSystemsPanel.tsx` + `grudgeSystemsPanel.css` |
| Game data | `src/lib/grudgeSystems/gameData.ts` |
| Stats / combat sim | `src/lib/grudgeSystems/statsEngine.ts` |
| Persist | `src/lib/grudgeSystems/persist.ts` |
| Wire-in | `src/App.tsx` (danger + play) |

## Tabs (same as Creator)

1. **Character** — 8 attrs, derived stats, combat dummy test  
2. **Class** — Warrior / Mage / Ranger / Worge + skill trees  
3. **Wpn Skills** — 17 weapon types + skill tiers (CDN icons from assets)  
4. **Professions** — mining / herbalism / woodcutting / skinning / fishing  
5. **Mastery** — per-weapon XP bars  

Footer **hotbar** mirrors live Danger Room slots (F / 1–4) with fleet CDN icons.

## Controls

| Input | Action |
|-------|--------|
| **K** | Toggle Systems panel |
| **I** | Loadout (closes Systems) |
| **Esc** | Close Systems or Loadout |
| Menubar **Systems** | Same as K |

## Data / production standards

| Layer | Behavior |
|-------|----------|
| Definitions | Creator trees in-repo; probes `info` `master-weaponSkills` for fleet health note |
| Icons | `assets.grudge-studio.com/icons/pack/...` |
| Saves | `localStorage` always; Railway `saveData.open.bags.grudgeSystems` when signed in |
| Combat HUD | Unchanged Open vitals / action bar — Systems is the spellbook/sheet |

## Next (not in this port)

- Merge fleet `master-weaponSkills` nodes into weapon trees by id  
- Spend skill points + revisioned progress API  
- Sync attribute-derived max HP into Studio vitals  
- Extract shared package used by Creator lab + Open  
