# Weapon Prefab Contract (Grudge Open)

A **weapon prefab** is game-ready only when all four layers are green.
Agents and humans fill packages against this checklist — they do not invent new combat systems.

## Four layers

| Layer | Owns | Ready when |
|-------|------|------------|
| **data** | `content/items/*.json` + `content/weapons/*.json` | ids, stats, slots, family, skill list |
| **mesh** | R2 / client paths for GLB·FBX·OBJ + grip socket | file exists, grip tested or `placeholder` |
| **combat** | `content/skills/*.json` linked from weapon | ≥1 primary skill with anim + hit window |
| **present** | icons, SkillVfxProfile, tooltips | icon path + VFX profile present |

## Readiness status values

- `ready` — shippable
- `placeholder` — intentional stub (allowed in lab, not “ship” tag)
- `missing` — blocks ship

## Weapon JSON shape

See `content/schemas/weapon_def.schema.json`. Minimal required fields:

- `id` (`wpn_*`)
- `itemId` (`itm_*`)
- `family` (`sword` | `axe` | `bow` | …)
- `slot`, `baseDamage`, `skills[]`
- `mesh.path`, `mesh.status`
- `readiness` object with `data|mesh|combat|present`

## Skill JSON shape

See `content/schemas/skill_def.schema.json`. Each skill needs:

- `id`, `weaponFamily`, `label`, `hotbarSlot`, `slotKind`
- `animKey` + `anim.path` (relative to gameopen anim root)
- `power`, `cost`, `cooldown`, `damageType`
- `vfx` (SkillVfxProfile subset)
- `icon`, `hitWindows[]`
- `readiness`

## Gold standard

**`wpn_sword_iron_01`** — complete package under `content/weapons/` + linked skills.
New weapons should copy that file and replace ids/paths.

## Agent batch rule

```
Contract: content/docs/WEAPON_PREFAB.md
Gold: wpn_sword_iron_01
Fill missing readiness fields only. Do not change combat formulas.
Run: pnpm readiness:weapons
```

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm scaffold:weapon --family sword --slug steel_longsword` | Create item + weapon + 4 skill stubs |
| `pnpm readiness:weapons` | Print readiness table + exit 1 if any `ship` fails |
| `pnpm content:index` | Rebuild manifests from folder JSON |
