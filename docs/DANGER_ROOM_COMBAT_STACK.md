# Danger Room combat stack = combat mode (SSOT)

**Rule:** Activity mode **combat** uses the **existing Danger Room** systems only.  
Do **not** build a second character combat runtime, alternate loco, or parallel targeting.

Related: [DANGER_ROOM_UX_CONSOLIDATION.md](./DANGER_ROOM_UX_CONSOLIDATION.md) · skill progression is meta data only — [CHARACTER_SKILL_POINTS.md](./CHARACTER_SKILL_POINTS.md)

---

## What combat mode is

`Studio.activityMode === "combat"` (default; **Q** cycles away to harvest/build).

It is the same product as Danger Room play:

| Layer | Owner | Role in combat |
| --- | --- | --- |
| **Input** | `Studio` pointer + keys | Soft LMB select · hard RMB focus toggle · LMB attack when focused · X/C/E/F/1–4 |
| **Locomotion** | `Controller` | Walk/run/jump, camera-relative when soft; **strafe** when `setLockTarget` (hard focus) |
| **Targeting** | `Targets` / `DungeonEnemies` | Soft cone raycast, sticky selection, `lockPoint`, aggro AI |
| **Hard focus** | `Studio.locked` + `Controller.setLockTarget` | RMB toggle; body faces target; A/D pure strafe |
| **Soft lock** | Selection + free-aim reticle | LMB selects under crosshair; free walk; no hard lock |
| **Avatar** | `Character` / `GrudgeAvatar` | `setLocomotion` + `playRoleOnce(attack/hurt/…)` — DR anim packs |
| **Weapons / skills** | Arsenal + T0 kits + Studio `useSkill` | Same hit windows, VFX, CDs as Danger Room |
| **Combat authority** | `@workspace/epicfight` CC | Player + NPC health/poise/parry |
| **VFX / SFX** | `Vfx` / `CombatSfx` | Unchanged |

Harvest and build **only rebind tools** (LMB/RMB). They do not replace Controller, anims, or focus.

---

## Input contract (combat)

| Input | Soft lock (default) | Hard FOCUS (RMB toggle on) |
| --- | --- | --- |
| **LMB** | Select under free-aim crosshair | Attack / combo toward aim |
| **RMB** | Enter sticky hard FOCUS | Exit to soft lock |
| **WASD** | Camera-relative loco | Strafe around lock target |
| **X** | Dodge roll | same |
| **C / E** | Parry / forcefield guard | same (not RMB) |
| **F / 1–4** | Signature skills | same |

Implemented in `Studio.onMouseDown` / `toggleFocusMode` / `Controller.setLockTarget` — **do not reimplement** in Brawler forks without importing this path.

---

## What is *not* combat mode

| System | Role |
| --- | --- |
| Skill trees / skill points | Meta unlocks + stats bag — gates slots / bonuses only |
| Grudge Systems panel (K) | Attributes, trees UI — not a second move/attack loop |
| Harvest / build modes | Tool modes; combat skills gated off |
| WarlordGenesis / Mimic standalone | Separate scenes; when embedded in Open, prefer Studio |
| New “character combat controller” | **Forbidden** — extend `Controller` + `Studio` instead |

---

## Agent / code rules

1. **Extend** `Studio` + `Controller` + `Targets` + avatar `playRoleOnce` — never a parallel combat class for Open combat mode.
2. **Q → combat** must call `restoreDangerRoomCombatMode` (clear harvest approach, rebind focus lock).
3. Islands / dungeon / camp enemies still feed the same `CombatTargets` surface so soft/hard lock work.
4. Skill points may scale damage/CD via unlocks; they do **not** drive locomotion or targeting.
5. Brawler and arcade cabinets should **import** DR patterns (lock, focus, loco), not ship empty hubs or custom T-pose combat.

---

## Entry points

```
Studio.setActivityMode("combat")  → restoreDangerRoomCombatMode
Studio.toggleFocusMode()          → enterHardFocus / exitHardFocus
Controller.setLockTarget(p|null)  → hard strafe vs soft free loco
Character | GrudgeAvatar          → setLocomotion + attack one-shots
```

Smoke: load Danger Room → soft LMB select dummy → RMB focus → A/D strafe → LMB attack anim → X roll → Q harvest → Q combat restores DR stack.
