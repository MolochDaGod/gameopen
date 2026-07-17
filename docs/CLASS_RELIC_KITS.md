# Class relic kits — edits only on existing SSOT

**Canonical file:** `ObjectStore/api/v1/class-relic-skillTrees.json`  
**Also:** `master-classRelics.json`, `master-skillTrees.json`, `classes.json`

Most class design was already in place (Warbound Grip, Wand recipes, Grimoire forms, Ranger tempo).  
**Only the following deltas were intentional:**

| Class | Already canonical | Small edit added |
|-------|-------------------|------------------|
| **Mage** | Wand, recipe slots 1–3, Place Teleport, heals/utility | Explicit **Fire + Water** schools + **crafting benefits**; portal/mobility/buff/heal called out on summary |
| **Worge** | Grimoire, Bear start, form slots Shift+1/3/5, future forms | Display name **Nature Grimoire**; **Root Portal** (party → camp); **Grove Husbandry** farm assist |
| **Warrior** | Dual wield, shield, 1H-greatweapon, aim, push | **Battle Forms** list (bulwark/onslaught/bloodward/dread/colossus) + larger parry/block/stamina note |
| **Ranger** | Quick Fingers, long dodge, ranged flow | Rename **Ranger's Log** (not Nimble Book); **sidearm half-slot**; **quick swap on ranged CD**; **auto poison** + **invisible** path notes |

Do not replace these files wholesale. Prefer additive fields on the existing relics.
