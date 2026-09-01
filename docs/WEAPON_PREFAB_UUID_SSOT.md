# Weapon prefab UUID graph (shared combat packages / Open)

**Status:** SSOT 2026-08  
**Pairs with:** `content/docs/WEAPON_PREFAB.md` · `docs/FLEET_ERA_CODEX_UUID_SSOT.md` · `docs/VOXEL_ERA_AVATAR_GEAR_WIRING.md`

Templates live in **content / ObjectStore**. **Instances** (player bag rows) live on **Railway**.

This graph is for **weapon packages** (`wpn_*` / skills / icons). It is **not** the voxel avatar look graph (`voxelLook`) and **not** a second character UUID scheme.

---

## 1. Identity graph

```
ITEM-template (itm_* / catalog)
    │
    ├─► wpn_*  weapon prefab (combat package)
    │       ├─► SKIL-* / content skills (sword.slash, gun_grudge_shot, …)
    │       ├─► ICON-* / icons/pack/… CDN
    │       ├─► mesh asset key (models/weapons/…) → D1 asset_registry optional
    │       └─► RECP-* craft recipe (ObjectStore) when craftable
    │
    └─► bag instance (Railway ledger / grudgeUuid)
            owner = account or character scope per inventory SSOT
```

| Node | Prefix / form | Store |
|------|----------------|--------|
| Item template | `itm_*` or catalog `ITEM-…` | content + ObjectStore |
| Weapon prefab | `wpn_*` | `content/weapons` |
| Skill template | `family.action` or master uuid | content + master-weaponSkills |
| Icon | path + `cdnUrl` | R2 |
| Recipe | `RECP-*` / ObjectStore recipes | definitions |
| **Instance** | Railway uuid / ledger grudgeUuid | **Postgres only** |

Do **not** mint player instances into content JSON.

---

## 2. Prefab export envelope (Unity / Warlords / Forge)

When exporting a weapon prefab for another client:

```json
{
  "prefabId": "wpn_sword_iron_01",
  "era": "warlords",
  "layers": {
    "identity": { "id": "wpn_sword_iron_01", "itemId": "itm_sword_iron_01", "family": "sword" },
    "stats": { "baseDamage": 18, "attackSpeed": 1.0 },
    "skills": ["sword.slash", "sword.two_hit", "sword.spin_high", "sword.dash"],
    "assets": {
      "mesh": "models/weapons/sword.glb",
      "icon": "https://assets.grudge-studio.com/icons/pack/weapons/Sword_01.png"
    },
    "runtime": {
      "spine": { "tip": [0, 1.12, 0], "blade": [0, 0.55, 0] },
      "animPack": "sword_shield"
    },
    "loadout": { "slot": "mainHand", "twoHanded": false }
  },
  "uuids": {
    "item": "itm_sword_iron_01",
    "skills": ["sword.slash", "sword.two_hit", "sword.spin_high", "sword.dash"],
    "iconSource": "objectstore-master-weaponSkills@3.1.0"
  }
}
```

---

## 3. Seven jobs (UUID touchpoints)

| Job | Template id | Instance id |
|-----|-------------|-------------|
| bag / drop | `itm_*` | ledger mint |
| equip | `wpn_*` + mesh | character equipment row |
| controller anim | `animPack` string | — |
| hotbar | skill ids | character progress / loadout |
| combat | skill + spine | runtime ent_ projectiles |
| craft | RECP / materials | consume bag stacks |
| export | full envelope | strip instance secrets |

---

## 4. Era

Warlords-era playables use `gameEra: warlords` on characters. Weapon **templates** are shared design data; filter skills/weapons by era only when catalog marks era tags — default Open content is Warlords-compatible combat sandbox.

---

## 5. Register path (next wire)

1. Author / scaffold content package  
2. `pnpm readiness:weapons`  
3. Optional: ObjectStore `build:weapon-pipeline` / `generate:master` (when wired)  
4. CDN upload mesh if not already on R2  
5. Export envelope for Unity/Warlords client if needed  

Do not invent a second UUID mint for templates.
