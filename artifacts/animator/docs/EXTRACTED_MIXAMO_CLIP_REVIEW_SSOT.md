# Extracted Mixamo clip review SSOT

**Source dir:** `C:\Users\nugye\Documents\_extracted\`  
**Skeleton (all 16 listed):** Mixamo `mixamorig*` (25 bones), clips named `mixamo.com`, **have hip position tracks** → bake **Bip001 rotation-only** (strip root position).

**Already in fleet (do not invent parallel paths):**  
`public/anim/animations/{swim,climb,bow,knife,pistol,reactions,spear,extra}/`  
Bakes: `anims/baked/{swim,climb,locomotion,pistol,polearm,dual_wield}/`  
Roles: `anims.ts` TRAVERSAL + dodge + thrust.

---

## Master matrix (your 16 files)

| # | File | Dur (s) | Domain | Direction / axis | Loop? | Best fleet role | Pack / path | Notes |
|---|------|--------:|--------|------------------|-------|-----------------|-------------|--------|
| 1 | **Quick Formal Bow.fbx** | 2.73 | Ambient / social | Facing +Z (Mixamo forward) | No | `emote_bow` / `taunt` / dialogue | ambient / gestures | **Not** longbow combat. Formal bow of respect. Use for NPC greet / quest accept. |
| 2 | **Shooting.fbx** | 1.17 | Ranged fire | Forward aim (chest + arms) | No | `attack` / `shoot` | rifle / longbow | Generic rifle/bow fire. Prefer family-specific if better; good shared one-shot. |
| 3 | **shootingGunplay.fbx** | **0.20** | Gun flair | Upper body | No | `gunplay` / skill flourish | **pistol** | Very short — likely a **snip/transition**, not full fire cycle. Pair with full shoot or use as additive flash. Already mirrored as `animations/pistol/gunplay.fbx` + bake. |
| 4 | **Shootingpistol.fbx** | 1.17 | Pistol fire | Forward, one-hand | No | `attack` / `shoot` | **pistol** | Same family as Ultimate Guns pistol. Prefer over generic Shooting for sidearm. |
| 5 | **Stabbing.fbx** | 2.13 | Knife / spear thrust | Forward linear | No | `attack` / `stab` / `thrust` | **knife** / spear | Classic thrust. Fleet already has `knife/stabbing.fbx`. Dual-wield / ghost `chain_stab` for specials. |
| 6 | **Standing Dodge Backward.fbx** | 1.63 | Combat mobility | **−Z / back** | No | `dodgeB` | **locomotion** / shared | Directional: **back only**. Pair with F/L/R dodges. Fleet has `locomotion/dodge_back` + bow dodges. |
| 7 | **Standing Melee Punch.fbx** | 1.00 | Unarmed | Forward right punch | No | `attack` / `punch` | **unarmed** / striker | 1H punch one-shot. Not axe/sword. Use striker / unarmed LMB. |
| 8 | **Standing Torch Run Forward.fbx** | 0.67 | Carry loco | **+Z run**, left arm torch pose | **Yes** | `run` (torch stance) | locomotion / ambient | **Armed-with-prop run**, not combat. Use when torch/lantern equipped; else normal run. Partial bake already: `uploads_2026_06/locomotion/torch run forward`. |
| 9 | **Start Climbing Ladder.fbx** | 2.03 | Traversal | Upward mount | No | `climbStart` / `ladder_mount` | **climb** | **Enter** ladder only. Loop climb uses wall climb set. Fleet has wall climb; this fills **ladder start** gap. |
| 10 | **Stunned.fbx** | 2.13 | Reaction / CC | In place | Soft loop | `stunned` / `dizzy` | **reactions** | Status stun/shock. Already `animations/reactions/stunned.fbx`. |
| 11 | **Swimming To Edge.fbx** | 5.00 | Water exit | Toward shore, forward | No | `swimExit` / `to_edge` | **swim** | One-shot exit. Fleet role `swimExit` → `swim/to_edge`. Prefer bake of this if better than current. |
| 12 | **Swimming.fbx** | 4.53 | Water loco | Forward stroke | **Yes** | `swim` | **swim** | Primary swim cycle. Already `swim/swimming`. |
| 13 | **Swinging.fbx** | 2.43 | Melee / prop | Arc slash (ambiguous) | No | `attack` / `swing` | axe/sword/2H **or** rope swing | Name only: could be weapon swing **or** vine/rope. Inspect motion: if hip arcs with hands high → traversal rope; if arms slash mid → melee. Fleet also has `extra/start-swinging.fbx`. |
| 14 | **Taunt Gesture.fbx** | 1.97 | Emote | In place | No | `taunt` | ambient / dual_wield | Combat taunt. Axe pack also has battlecry/chest thump. |
| 15 | **Thrust Slash.fbx** | 3.00 | Spear / sword | Forward then slash | No | `attack` / `thrust` / skill | **spear** / polearm / sword | Hybrid thrust→slash. Best for **spear/polearm skill** or 1H finisher. Fleet has `spear/rising-thrust`, `polearm/thrust`. |
| 16 | **Treading Water.fbx** | 3.00 | Water idle | Vertical bob | **Yes** | `tread` | **swim** | Zero horizontal speed in water. Fleet `swim/treading`. |

---

## Grouped by system (best placement)

### 1. Locomotion (ground)

| Clip | Role | When |
|------|------|------|
| Standing Torch Run Forward | `run_torch` | Torch/lantern equip only |
| Standing Dodge Backward | `dodgeB` | Combat evade back |
| Standing Melee Punch | not loco | unarmed attack |

**Do not** put swim/climb into ground loco blend.

### 2. Traversal

| Clip | Role | Direction |
|------|------|-----------|
| Start Climbing Ladder | `ladder_start` / `climbStart` | Mount up |
| Swimming | `swim` | Forward cycle |
| Treading Water | `tread` | In place |
| Swimming To Edge | `swimExit` | Exit one-shot |
| Swinging | TBD | rope vs melee (see above) |

Fleet already: wall climb up/down/to_top. **Ladder start** is the useful gap from this list.

### 3. Ranged / guns (Ultimate Guns pack)

| Clip | Weapon | Role |
|------|--------|------|
| Shootingpistol | pistol | primary fire |
| Shooting | rifle/bow generic | fire / fallback |
| shootingGunplay | pistol | short flourish (0.2 s) |

Wire to `pistol` / `rifle` anim sets; keep Ultimate Guns **meshes** separate.

### 4. Knife / spear / melee skills

| Clip | Best weapon | Role |
|------|-------------|------|
| Stabbing | knife, spear | `stab` / `thrust` |
| Thrust Slash | spear, 1H sword | skill / heavy attack |
| Swinging | 1H/2H if slash; else rope | `slash` or traversal |
| Standing Melee Punch | unarmed | `punch` |

### 5. Reactions / status

| Clip | Status / event |
|------|----------------|
| Stunned | stun, shock, heavy hit |
| Taunt Gesture | taunt button / AI boast |
| Quick Formal Bow | social / non-combat |

### 6. Climbing ladders

```
Start Climbing Ladder  → climbStart (one-shot)
Climbing Up Wall*      → climbUp loop   (already in pack)
Climbing Down Wall*    → climbDown loop
Climbing To Top*       → climbMantle
```

\*Additional FBX already in `_extracted` (not in your 16) — same Mixamo family; include in full climb bake.

---

## Directional cheat-sheet

| Token in name | World direction (Mixamo +Z face) |
|---------------|----------------------------------|
| Forward / Run Forward | +Z |
| Backward / Dodge Backward | −Z |
| Left / Right (if present) | ±X strafe |
| Jump / Climb / Ladder | +Y emphasis |
| Swim / Tread | water plane; no ground plant |

Controller must match: `dodgeB` only when input is back; do not play backward dodge for forward roll.

---

## Overlap vs inventing

| File | Fleet already has? | Action |
|------|--------------------|--------|
| Swimming, Treading, To Edge | Yes `anim/swim/*` + bakes | Diff quality; replace bake if this set is better |
| Climb wall set | Yes `anim/climb/*` | Keep; add **ladder start** from this list |
| Stabbing | Yes `knife/stabbing` | Prefer one SSOT path |
| Dodge Backward | Yes locomotion + bow | Unify as shared `dodgeB` |
| Stunned | Yes reactions | Unify |
| Torch run | Partial upload bake | Promote to `locomotion/torch_run` |
| Shooting / pistol / gunplay | pistol + longbow partial | Wire gunClass shoot roles |
| Quick Formal Bow | Missing as formal bow | New ambient role |
| Thrust Slash | Partial spear thrusts | New spear skill if distinct |

---

## Deploy / bake recommendation

1. **Stage** into existing folders (no new systems):

```
public/anim/incoming_extracted/
  swim/     Swimming.fbx, Treading Water.fbx, Swimming To Edge.fbx
  climb/    Start Climbing Ladder.fbx  (+ wall set from _extracted if desired)
  pistol/   Shootingpistol.fbx, shootingGunplay.fbx
  rifle/    Shooting.fbx
  knife/    Stabbing.fbx
  spear/    Thrust Slash.fbx
  unarmed/  Standing Melee Punch.fbx
  locomotion/ Standing Dodge Backward.fbx, Standing Torch Run Forward.fbx
  reactions/ Stunned.fbx
  ambient/  Quick Formal Bow.fbx, Taunt Gesture.fbx
  extra/    Swinging.fbx  (classify after visual check)
```

2. **Bake** Mixamo → Bip001 (same as axe/injured): strip position, quaternion only.  
3. **Roles** in `anims.ts` / pack maps — extend existing TRAVERSAL + weapon packs only.  
4. **Mirror** only melee that needs off-hand (Stabbing / Thrust Slash / Punch) if dual-wield warrior.

### Priority order (gameplay value)

| P | Clips | Why |
|---|-------|-----|
| P0 | Swim / Tread / To Edge | Water volume already in Vox |
| P0 | Dodge Backward | Shared combat evade |
| P0 | Shootingpistol + Shooting | Guns pack just shipped |
| P1 | Stabbing, Thrust Slash | Knife/spear skills |
| P1 | Ladder start | Completes climb stack |
| P1 | Stunned | Status FX pairing |
| P2 | Torch run | Prop loco |
| P2 | Punch, Taunt, Formal Bow | Unarmed / social |
| P2 | Gunplay 0.2 s | Optional flourish |
| P3 | Swinging | Confirm rope vs melee first |

---

## Creation purpose (author intent → game)

| Author name intent | Game systems |
|--------------------|--------------|
| Formal bow | Social / non-combat emote |
| Shooting* | Ranged fire one-shots |
| Stabbing / Thrust Slash | Close-range pierce skills |
| Dodge Backward | Directional evade (−Z) |
| Melee Punch | Unarmed strike |
| Torch Run Forward | Carry-prop locomotion |
| Start Climbing Ladder | Traversal enter |
| Stunned | CC reaction |
| Swimming* / Treading | Water loco + idle |
| Swinging | Melee arc **or** swing traversal |
| Taunt Gesture | Emote / AI |

---

## Hard rules

- ❌ Do not invent a second climb/swim system — extend `climb/` + `swim/` + SurfaceLocomotion.  
- ❌ Do not use swim clips as ground run.  
- ❌ Do not use Formal Bow as longbow draw.  
- ✅ One mixer; bake Bip001; strip hip position.  
- ✅ Directional names map to controller axes (F/B/L/R).  

## Verify after bake

1. Water: swim loop + tread when speed≈0 + exit to edge.  
2. Ladder: start clip then climb loop.  
3. Gun equip: pistol fire uses Shootingpistol bake.  
4. Dodge only fires back when input is back.  
5. No float (position tracks stripped).  
