# Danger Room — T0 equipment skills, MM, block/parry tick

Reviewed reference art (stored under `artifacts/animator/docs/ref-combat/`):

| File | Content |
|------|---------|
| `t0-equipment-skills-1.png` | Full T0 skill kits (Combo / Special / Ranged / Power) per weapon family |
| `t0-equipment-skills-2.png` | **MM** scale: +100 melee gap-close → −100 ranged keep-distance |
| `block-parry-1.png` | Danger Room MM trajectory diagram (θgap / θaway / θup) |
| `block-parry-2.png` | Enemy attack timeline + player reaction windows |

---

## Best practices (combat timer & tick)

### 1. Attack phases (authoritative telegraphs)

Every enemy / player heavy swing should expose:

| Phase | Ratio (ref 1.7s) | Purpose |
|-------|------------------|---------|
| **Windup** | ~0.8 / 1.7 | Readable telegraph; parry window opens late windup |
| **Active** | ~0.3 / 1.7 | Hit query / damage |
| **Recovery** | ~0.6 / 1.7 | Punishable; block still useful |

Constants: `T0_ATTACK_PHASE` in `arsenal/t0WeaponSkills.ts`.

### 2. Reaction hierarchy (player defense)

From the reaction timeline ref:

| Reaction | Window feel | Code |
|----------|-------------|------|
| **Parry** | **Narrow** ~0.30s | `PARRY_DEFLECT_WINDOW = 0.30`, perfect `0.12` |
| **Block** | **Wide** (hold) | Continuous while held; force vs attack force |
| **Dodge** | **Widest** | i-frames `0.04–0.42` of `0.55` dodge |

**Tip (ref):** Parry for an opening · Block when unsure · Dodge for max safety.

### 3. Block chip (not all-or-nothing)

When `block.force < attack.force`, resolve **chip** (`BLOCK_CHIP_FRACTION = 0.4`) instead of full damage — block remains the safe option.

When `block.force >= attack.force` → `blockStop` (0 damage).

### 4. Tick process (host loop)

Recommended order each frame (`dt`):

1. **Input** buffer (parry / block raise / dodge / attack)  
2. **`CombatController.update(dt)`** — advance state timers, i-frames, stamina  
3. **Hit queries** only while `isHitActive()` (active frames)  
4. **`applyAttack` / `resolveDefense`** with defender `age` = seconds in parry/block/dodge  
5. **Reactions** (stagger / crit window / knockback from `outcomeForceScale`)  
6. **VFX / HUD** observe results (no second damage math)

### 5. MM (motion-math) on skills

- Scale: **100 MM = 1 m** (`MM_TO_M = 0.01` in Studio)  
- **+MM** → dash toward aim (gap-close)  
- **−MM** → dash away / kite (ranged kits)  
- T0 skill MM from sheet 2; applied on signature cast in Studio  

Data: `arsenal/t0WeaponSkills.ts`  
HUD 1–4 labels: `Studio.signatureSkills()` / `slotDefault` use T0 kit for equipped weapon.

---

## T0 kit families (equipment sheet)

Unarmed · Sword+Shield · Great Sword · Battle Axe · Daggers · Spear · War Hammer · Long Bow · Arcane Staff · Pistol · Rifle · Tower Shield  

Each: **1 Combo · 2 Special · 3 Ranged · 4 Power Move**

---

## Controls (Danger Room)

| Key | Action |
|-----|--------|
| LMB | Primary / combo |
| Q | Parry (narrow) |
| E / hold | Block (wide) |
| X | Dodge (widest i-frames) |
| 1–4 / F | T0 weapon skills |
| R | Heavy / shield-break |

---

## Files touched

- `lib/epicfight/src/combat/defense.ts` — windows + chip block  
- `lib/epicfight/src/combat/movesets.ts` — dodge i-frames + parry defaults  
- `artifacts/animator/src/three/arsenal/t0WeaponSkills.ts` — catalog  
- `artifacts/animator/src/three/Studio.ts` — T0 HUD + MM on skill cast  
- `artifacts/animator/src/three/combatModel.ts` — boss parry align  
