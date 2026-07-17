# Documents FBX → weapon skill map

Source folder: `C:\Users\nugye\Documents\`.  
Runtime paths: `artifacts/animator/public/anim/animations/…`.

| Documents file | Project path | Weapon skill use | Status |
|----------------|--------------|------------------|--------|
| **lancespartan.fbx** | `spear/lance-spartan.fbx` | Spear **dash / finisher** (attack3, dashAttack); T0 special “Lance Spartan” | In pack · wired |
| **intoout.fbx** | `extra/intoout.fbx` | **Reaction / block hold** (not an attack skill); used as guard pose on some kits | In pack · wired as block |
| **Two Hand Sword Combo.fbx** | `greatsword/great-sword-combo.fbx` | Greatsword **LMB combo opener** (attack1); T0 “Two Hand Sword Combo” | In pack · wired |
| **One Hand Sword Combo.fbx** | `sword/one-hand-sword-combo.fbx` | Sword **LMB combo opener** (attack1); T0 “One Hand Sword Combo” | In pack · wired |
| **multiUpward Thrust.fbx** | `spear/upward-thrust.fbx` | Spear **LMB open / stab** (attack1, stab); T0 “Upward Thrust” | In pack · wired |
| **11Upward Thrust.fbx** | `spear/rising-thrust.fbx` | Spear **power poke / rising stab** (stab, T0 power) | In pack · wired |
| **spear1.fbx** | `spear/spear1.fbx` | Spear **F skill + mid combo** (skill, attack2); T0 “Spear Flurry” | **Imported** · wired |
| **knocked up.fbx** | `reactions/knocked-up.fbx` | **CC reaction** when launched (not a weapon skill) | In pack · reaction only |
| **greataxe.fbx** | `greataxe/great-axe-combo.fbx` | Greataxe **LMB combo** (attack1); T0 greataxe combo | In pack · wired |
| **quiickGreat Sword Slash.fbx** | `greatsword/quick-slash.fbx` | Greatsword **fast cut** (stab / T0 special “Quick GS Slash”) | In pack · wired |
| **Run With Sword.fbx** | `sword/run-with-sword.fbx` | Sword / 1H melee **run locomotion** (runF) | **Imported** · wired |
| **Dual Weapon Combo.fbx** | `knife/dual-weapon-combo.fbx` | F skill: dagger, sword+knife, 2H specials | In pack · wired |

## Recommended skill bar (1–4) by family

### Sword + knife
| Slot | Skill | Clip |
|------|--------|------|
| 1 Combo | One Hand Sword Combo | `one-hand-sword-combo` |
| 2 Special | Dual Weapon Combo | `dual-weapon-combo` |
| 3 Ranged | Run Slash (gap close while sprinting) | run + slash VFX |
| 4 Power | Blade Storm | nova VFX + attack4 |

### Greatsword
| Slot | Skill | Clip |
|------|--------|------|
| 1 Combo | Two Hand Sword Combo | `great-sword-combo` |
| 2 Special | Quick GS Slash | `quick-slash` |
| 3 Ranged | Slide Dash | `great-sword-slide-attack` |
| 4 Power | Judgement / Dual Combo | dual-weapon-combo or slam |

### Spear
| Slot | Skill | Clip |
|------|--------|------|
| 1 Combo | Upward Thrust | `upward-thrust` |
| 2 Special | Lance Spartan | `lance-spartan` (dash) |
| 3 Ability | Spear Flurry (spear1) | `spear1` |
| 4 Power | Rising Thrust | `rising-thrust` |

### Greataxe
| Slot | Skill | Clip |
|------|--------|------|
| 1 Combo | Greataxe Combo | `great-axe-combo` |
| 2 Special | Dual Weapon Combo | `dual-weapon-combo` |
| 3–4 | Cleave / Execute | existing dash/slam |

### Not weapon skills
- **knocked up** → victim reaction when launched  
- **intoout** → guard / stance hold (optional parry body)

## Notes
- Most Documents files were **byte-identical** to files already under `public/anim/animations/`.
- Only **spear1** and **Run With Sword** were missing; they are now imported.
- LMB chains play full combo clips where noted (duration-driven locks).
