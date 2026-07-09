# Grudge Open — Content SSOT

Authoritative **templates** for weapons, skills, items, and armor.

| Folder | Purpose |
|--------|---------|
| `docs/` | Contracts (read before editing) |
| `schemas/` | JSON Schema for each entity |
| `items/` | Item templates (`itm_*`) |
| `weapons/` | Weapon defs (`wpn_*`) |
| `skills/` | Skill defs (`family.action`) |
| `armor/` | Armor defs (`arm_*`) |
| `manifests/` | Generated indexes + readiness (do not hand-edit) |

## Commands

```bash
pnpm content:index              # rebuild manifests
pnpm readiness:weapons          # table + ship gate
pnpm scaffold:weapon -- --family axe --slug iron_greataxe
```

## Gold standard

Copy **`weapons/wpn_sword_iron_01.json`** + its four `skills/sword.*.json` when adding a family.

## API

When the Railway API is running:

- `GET /api/content`
- `GET /api/content/weapons`
- `GET /api/content/weapons/wpn_sword_iron_01`
- `GET /api/content/skills`
- `GET /api/content/readiness`

## Forge scenes

```bash
pnpm scenes:build
```

Open in **Forge** (editable + AI):

| Scene | Link |
|-------|------|
| Weapon Lab | [Forge edit](https://forge.grudge-studio.com/editor?scene=https://gameopen-production.up.railway.app/api/content/scenes/weapon-lab&edit=1) |
| Combat Sandbox | [Forge edit](https://forge.grudge-studio.com/editor?scene=https://gameopen-production.up.railway.app/api/content/scenes/combat-sandbox&edit=1) |
| Catalog Plaza | [Forge edit](https://forge.grudge-studio.com/editor?scene=https://gameopen-production.up.railway.app/api/content/scenes/catalog-plaza&edit=1) |

Play live: https://gameopen.vercel.app/  
Docs: `content/docs/FORGE_SCENES.md`

## Agent prompt

```
Contract: content/docs/WEAPON_PREFAB.md
Gold: wpn_sword_iron_01
Fill missing readiness for family:sword only.
Run pnpm readiness:weapons && pnpm scenes:build.
Do not invent combat systems.
```
