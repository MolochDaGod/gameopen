# Documents FBX → weapon skill / locomotion map

Source folder: `C:\Users\nugye\Documents\`.  
Runtime paths: `artifacts/animator/public/anim/animations/…`.

## Placement legend

| Bucket | Meaning |
|--------|---------|
| **Weapon skill** | Attack / skill / dash-attack / block on a weapon class |
| **Locomotion** | Movement, dodge, roll, wall-run, jump, death, get-up |
| **Both** | Used as a skill *and* as shared movement/reaction |
| **Defense** | Guard / parry / block-react (class-independent) |

## Full Documents review (this batch)

| Documents file | Project path | Placement | Wiring |
|----------------|--------------|-----------|--------|
| **Right Block.fbx** | `block/right-block.fbx` | **Defense** | `blockRight` GLOBAL_REACTIONS |
| **Standing Block React Large.fbx** | `block/standing-block-react-large.fbx` | **Defense** | `blockReact` GLOBAL_REACTIONS |
| **parry.fbx** | `block/parry.fbx` | **Defense** | `parryReact` GLOBAL_REACTIONS · C key |
| **Sword And Shield Block.fbx** | `sword/sword-and-shield-block.fbx` | **Weapon** | Sword / 1H `blockStart` |
| **Agony.fbx** | `reactions/agony.fbx` | **Locomotion (reaction)** | `agony` heavy take-hit (recoil > 8) |
| **Slash Advance.fbx** | `sword/slash-advance.fbx` | **Weapon** | Sword `dashAttack` + GLOBAL `slashAdvance` |
| **Running Arc.fbx** | `extra/running-arc.fbx` | **Locomotion** | `runningArc` UNIVERSAL_MOVEMENT |
| **rollRunning.fbx** | `extra/roll-running.fbx` | **Locomotion** | `rollRun` — X-roll while sprinting |
| **Wall Run.fbx** | `climb/wall-run.fbx` | **Locomotion** | `wallRun` on wall-run start / loop |
| **parry handsKnee Jabs To Uppercut.fbx** | `striker/knee-jabs-to-uppercut.fbx` | **Weapon** | Unarmed `comboHit2` |
| **2Getting Up.fbx** | `reactions/get-up.fbx` | **Locomotion (reaction)** | `getUp` recover after knockdown |
| **Flip Kick.fbx** | `striker/flip-kick.fbx` | **Weapon** | Unarmed `skill` / `flipKick` |
| **archer after shotStanding Dodge Backward.fbx** | `bow/standing-dodge-backward.fbx` | **Locomotion** | Bow `dodgeB` (archer-specific) |
| **Standing Melee Attack Backhand.fbx** | `sword/melee-attack-backhand.fbx` | **Weapon** | Sword `attack3` / `outsideSlash` |
| **2Gunplay.fbx** | `pistol/gunplay.fbx` | **Weapon** | Pistol `attack1` |
| **St1able Sword Inward Slash.fbx** | `sword/inward-slash.fbx` | **Weapon** | Sword `attack4` / `insideSlash` |
| **quickkick.fbx** | `striker/quick-kick.fbx` | **Both** | Unarmed `attack2` + `dashAttack` + UNIVERSAL `quickKick` |
| **Standing Death Forward 01.fbx** | `bow/standing-death-forward-01.fbx` | **Locomotion** | Unarmed / bow / knife `death` |
| **2Standing Melee Run Jump Attack.fbx** | `extra/run-jump-attack.fbx` | **Both** | `jumpAttack` sword / knife / unarmed + UNIVERSAL |
| **Jump Away.fbx** | `extra/jump-away.fbx` | **Locomotion** | `jumpAway` wall-kick / leap-off |

## Earlier Documents pack (still valid)

| Documents file | Project path | Placement | Status |
|----------------|--------------|-----------|--------|
| **lancespartan.fbx** | `spear/lance-spartan.fbx` | Weapon | Spear dash / finisher |
| **intoout.fbx** | `extra/intoout.fbx` | Defense | Guard pose (bow / some kits) |
| **Two Hand Sword Combo.fbx** | `greatsword/great-sword-combo.fbx` | Weapon | GS LMB opener |
| **One Hand Sword Combo.fbx** | `sword/one-hand-sword-combo.fbx` | Weapon | Sword LMB opener |
| **multiUpward Thrust.fbx** | `spear/upward-thrust.fbx` | Weapon | Spear LMB |
| **11Upward Thrust.fbx** | `spear/rising-thrust.fbx` | Weapon | Spear power poke |
| **spear1.fbx** | `spear/spear1.fbx` | Weapon | Spear F skill |
| **knocked up.fbx** | `reactions/knocked-up.fbx` | Loco reaction | Launch take-hit |
| **knocked up and back.fbx** | `reactions/knocked-up-and-back.fbx` | Loco reaction | Directional launch |
| **Hit On Side Of Head.fbx** | `reactions/hit-on-side-of-head.fbx` | Loco reaction | Default flinch |
| **greataxe.fbx** | `greataxe/great-axe-combo.fbx` | Weapon | Greataxe LMB |
| **quiickGreat Sword Slash.fbx** | `greatsword/quick-slash.fbx` | Weapon | GS fast cut |
| **Run With Sword.fbx** | `sword/run-with-sword.fbx` | Locomotion | Sword / 1H `runF` |
| **Dual Weapon Combo.fbx** | `knife/dual-weapon-combo.fbx` | Weapon | Dual / 2H F skill |

## Recommended skill bar (1–4) by family

### Sword + knife
| Slot | Skill | Clip |
|------|--------|------|
| 1 Combo | One Hand Sword Combo | `one-hand-sword-combo` |
| 2 Special | Dual Weapon Combo | `dual-weapon-combo` |
| 3 Gap close | Slash Advance | `slash-advance` (dashAttack) |
| 4 Finisher | Inward Slash / Backhand | `inward-slash` / `melee-attack-backhand` |

### Greatsword
| Slot | Skill | Clip |
|------|--------|------|
| 1 Combo | Two Hand Sword Combo | `great-sword-combo` |
| 2 Special | Quick GS Slash | `quick-slash` |
| 3 Ranged | Slide Dash | `great-sword-slide-attack` |
| 4 Power | Dual Combo | `dual-weapon-combo` |

### Unarmed / striker
| Slot | Skill | Clip |
|------|--------|------|
| 1 Combo | Punch→Elbow | `punch-to-elbow-combo` |
| 2 Combo | Knee jabs → uppercut | `knee-jabs-to-uppercut` |
| 3 Kick | Quick kick | `quick-kick` |
| 4 Special | Flip Kick | `flip-kick` |

### Pistol
| Slot | Skill | Clip |
|------|--------|------|
| 1 Fire | Gunplay | `gunplay` |
| 2–4 | Whip / kick / charged | existing kiter kit |

### Locomotion (any loadout)
| Verb | Clip | When |
|------|------|------|
| Sprint X-roll | `roll-running` | Forward roll while moving |
| Back dodge | `dodging-back` / bow `standing-dodge-backward` | X / dodge B |
| Wall run | `wall-run` | Shift + air + wall |
| Jump away | `jump-away` | Wall jump / leap-off |
| Run jump attack | `run-jump-attack` | Air strike / gap close |
| Running arc | `running-arc` | Combat sprint flourish |
| Get up | `get-up` | After knockdown |
| Agony | `agony` | Heavy non-launch hit |
| Death | `standing-death-forward-01` | Unarmed/bow/knife KO |

## Notes
- Defense clips (Right Block, Standing Block React Large, parry) are **class-independent** via `GLOBAL_REACTIONS` so every weapon soaks hits with a real animation.
- **Both** means the same FBX is useful as a skill *and* as shared locomotion (e.g. quickkick dash-attack + unarmed LMB; run-jump as air skill + universal jumpAttack).
- LMB chains play full combo clips where noted (duration-driven locks).
