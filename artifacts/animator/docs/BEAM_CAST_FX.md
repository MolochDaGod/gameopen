# Beam Cast VFX + Physics

Locked multi-shader beam system for ranged skills, staffs, wand/tome, gun plasma, and 2H cast weapons.

## Flow

1. **Cast start** — aim freezes (crosshair / hard lock → planar dir). No re-aim for the rest of the cast.
2. **Charge** — ethereal spinning rings + cast aura + cast animation (`cast` / `magicAttack` / …).
3. **Release** — multi-layer locked beam fires at end of `castTime`.
4. **Ticks** — damage cylinder (radius **0.1–1 m**) along the frozen line; physics applied per profile.

## Multi-shader beam (`Vfx.lockedBeam`)

| Layer | Role |
|-------|------|
| Core | Near-white additive hot core (shader pulse) |
| Mid | Ethereal scroll-noise additive glow |
| Outer | Slightly opaque shell (reads in bright scenes) |
| Shell | Soft corona additive |

`beamChargeUp` runs during cast: spinning torii + cast aura + rising motes.

## Profiles (`three/combat/beamCast.ts`)

| Profile | Weapons | Physics |
|---------|---------|---------|
| `staff_default` | staff, staffHoly | stun |
| `staff_fire` | staffFire | **explode** (fly + splash) |
| `staff_ice` | staffIce | stun |
| `staff_nature` | staffNature | stun |
| `staff_storm` | staffStorm | **launch** |
| `wand` | wand | stun |
| `tome` | tome | **ragdoll** → fallen on land |
| `gun_beam` | pistol / rifle / guns | launch |
| `twohand_cast` | scythe, hammer2h, great* | explode |

## State management (enemies / NPCs / bosses)

`Targets.beamCylinder` applies per-hit:

- **Damage** through CombatController (block/parry still resolve).
- **stun** → `stunT` + `applyVulnerableState("stunned")` + stun reaction clip.
- **launch** → upward vel; clean launch (≥8) sets `launchPhase: rising` → falling → **fallen** on land.
- **explode** → shield-break + hard launch + residual splash (skips primary).
- **ragdoll** → clean knock-up → risen → **fallen** + KO pose on land.

Players use the same CC via SparringCombat (`stunned` / `fallen` + kip-up / Space smash recover).

## Studio wiring

| Entry | Behaviour |
|-------|-----------|
| Staff F / sig 1 (non-arcane, non-ice) | `doStaffBeamCast` |
| Wand / tome F & sig 1 | beam cast |
| Fire / storm elemental F | beam (element tint + status) |
| Multi-part skill beam ops | locked beam (or full session if charge-only) |
| Pistol sig 4 (hexaring) | locked plasma beam session |
| Scythe / laser-kind F | twohand_cast beam |

Weapon swap / character load **cancels** the active session.

## Key files

- `three/combat/beamCast.ts` — profiles, session, segment math
- `three/Vfx.ts` — `lockedBeam`, `beamChargeUp`, legacy tracking `beam`
- `three/Targets.ts` — `beamCylinder` damage + physics
- `three/Studio.ts` — session update, staff/gun/2H routes
