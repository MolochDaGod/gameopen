# uMMORPG Concept Adoption (Grudge Open)

Careful, purposeful — **concepts and pipelines**, not Mirror/Unity ports.

## Adopted

| Concept | How we implement it |
|---------|---------------------|
| Scriptable item templates | `content/items/*.json` |
| Equipment slots | `slot` on weapon/armor defs |
| Skills bound to weapon family | `content/skills` + `weapon.skills[]` |
| Hotbar 1–6 | `hotbarSlot` + `slotKind` |
| Template vs inventory instance | Templates in content/; instances on character API later |
| Damage ≈ base × power | `baseDamage` × skill `power` |
| CD + resource cost | `cooldown`, `cost.stamina/mana` |

## Deferred

| Concept | Why |
|---------|-----|
| Full server-authoritative Mirror combat | Local sandbox feel first |
| 200+ item spreadsheet dump | Finish 8 families green first |
| Auction / mail / guild banks | Out of scope for Open combat lab |
| Exact uMMORPG skill UI | Use Grudge HUD patterns |

## Never

- Hard-code mesh paths inside combat systems
- Store full item templates inside character save blobs
- Invent a second skill system parallel to `content/skills`

## Reference (local)

Unity uMMORPG sandbox may exist at `Documents/ummorpgdev` for **reading** slot/skill ideas only.
