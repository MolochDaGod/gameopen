# Item / Weapon / Armor Database

## Principles (uMMORPG-inspired)

1. **Template vs instance** — catalog rows never store owner; inventory holds `templateId` + instance fields.
2. **Single SSOT folder** — `content/` in this repo is the authoring SSOT; ObjectStore/R2 are distribution.
3. **Id prefixes**
   - `itm_` items
   - `wpn_` weapons (combat extension of item)
   - `arm_` armor
   - skills: dotted `family.action` (no prefix)

## Collections (files)

| Path | Collection |
|------|------------|
| `content/items/*.json` | Item templates |
| `content/weapons/*.json` | Weapon defs |
| `content/armor/*.json` | Armor defs |
| `content/skills/*.json` | Skill defs |
| `content/manifests/*.json` | Generated indexes + readiness |

## Instance shape (runtime / save — not authored here)

```json
{
  "instanceId": "uuid",
  "templateId": "itm_sword_iron_01",
  "ownerId": "char_…",
  "slot": "mainHand",
  "durability": 100
}
```

## Sync targets (later)

| Target | Use |
|--------|-----|
| ObjectStore | Public catalog API |
| R2 `gameopen/` | Binary meshes, icons, anims |
| Railway gameopen API | `/api/content/*` serves this folder |
| GrudgeBuilder | Character inventory instances only |

## Naming

- Filenames match ids: `wpn_sword_iron_01.json`
- Human labels in `name` / `label` fields only
