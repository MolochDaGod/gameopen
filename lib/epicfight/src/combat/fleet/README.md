# Fleet combat SSOT (`@workspace/epicfight/combat/fleet`)

Canonical combat for **Open**, **Voxel**, and **Warlords**.

| Module | Purpose |
|--------|---------|
| `constants.ts` | Input map, dodge/slide/parry/stamina numbers, slash mesh paths |
| `rules.ts` | `planDodge`, `resolveSlideContact`, parry fail plan, slash stage |
| `weaponSkill.ts` | `FleetWeaponSkill` — mesh, collider, VFX, CD, combo, readiness |
| `host.ts` | `FleetCombatHost` adapter + `fleetPlayerCombatPatch()` |

Full runbook: `docs/CANONICAL_COMBAT.md` (repo root of gameopen).

```ts
import {
  planDodge,
  FLEET_COMBAT_INPUT,
  fleetPlayerCombatPatch,
  type FleetWeaponSkill,
} from "@workspace/epicfight";
```
