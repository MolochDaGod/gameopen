# Skill Prefab Contract

Skills are **nested prefabs** under a weapon family. They never float without a weapon or class binding.

## Required fields

| Field | Rule |
|-------|------|
| `id` | Stable dotted id: `{family}.{action}` e.g. `sword.slash` |
| `animKey` | Stable key used by runtime (maps to FBX/JSON) |
| `anim.path` | Repo-relative or CDN path under `/anim/` or `/models/animations/` |
| `hotbarSlot` | 1–6 when on API hotbar |
| `slotKind` | `primary` \| `secondary` \| `ability` \| `ultimate` |
| `power` | Multiplier over weapon `baseDamage` (1.0 = normal hit) |
| `cost` | `{ stamina?: number, mana?: number }` |
| `cooldown` | Seconds |
| `hitWindows` | At least one window for melee/projectile |
| `vfx` | Cast/travel/impact colors + modes (see SkillVfxProfile) |
| `icon` | `{ path, status }` |

## Hit window convention

```json
{ "t": 0.22, "kind": "melee", "radius": 1.4, "angleDeg": 90 }
```

- `t` — seconds from skill start (align to swing contact frame)
- Melee skills: `kind: "melee"`
- Bow/gun: `kind: "projectile"` + optional `speed`

## VFX defaults by element

| Element | Color | Travel |
|---------|-------|--------|
| physical | `#d8c38a` | none |
| fire | `#ff7a1a` | directional |
| frost | `#5fd6ff` | none |
| arcane | `#b06bff` | directional |
| arrow | `#e8d9a0` | directional |

## Readiness

Skill is ready when: `data` + `anim` + `vfx` + `icon` are all `ready` or intentional `placeholder`.
