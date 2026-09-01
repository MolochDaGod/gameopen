# Fleet DRC Completion Plan

**Purpose:** Ordered steps to finish **Danger Room Controls (DRC)**, kill duplication, ship correct weapon skills, and use **ui.grudge-studio.com** as the HUD SSOT across games.

**Not a URL.** DRC = four layers every host implements the same way.

| Layer | Name | SSOT |
|-------|------|------|
| **L1** | Input map | `@workspace/epicfight` `FLEET_COMBAT_INPUT` + Open Studio binds |
| **L2** | Combat anim | Bip001 baked packs + `AnimationDirector` + `fleetAnimSsot` |
| **L3** | Weapon skills | `FleetWeaponSkill` + `content/skills` + ObjectStore master-weaponSkills |
| **L4** | HUD / frames | **ui.grudge-studio.com** HYDRA packs + CraftPix textures |

**Related:** `CANONICAL_COMBAT.md` · `ANIMATION_FLEET_SSOT.md` · `WEAPON_LIVE_ANIMS.md` · `FLEET_EDITORS_AND_UI.md`

---

## North star (definition of done)

A game is **DRC-complete** when:

1. Same keys do the same things (parry/dodge/skills/slide).
2. Equip weapon X loads the **same** pack roles + skill ids on every host.
3. Skills pass `assessWeaponSkillReadiness` (anim + collider + VFX + CD).
4. HUD is a **named pack** from ui.grudge-studio.com (or embedded runtime), not a one-off React strip.
5. No second combat FSM / skill table / anim lane invented in that game.

---

## Phase 0 — Freeze & inventory (1–2 days)

**Goal:** Stop new forks; know what exists.

| Step | Action | Output |
|------|--------|--------|
| 0.1 | Declare hosts: **Open Studio** = combat reference binary; **Avernus** = The-ENGINE host; **GRUDOX** = shell; **controller Vercel** = deprecate fork | Fleet doc table |
| 0.2 | Freeze new skill JSON outside `content/skills` + master-weaponSkills | PR rule / CODEOWNERS |
| 0.3 | Inventory matrix: weapon id × pack id × bake ready × skill slots × HUD pack | Spreadsheet or `content/manifests/drc-matrix.json` |
| 0.4 | List duplicate combat FSMs (Open Studio, Avernus RoleControls, controller) | Kill list |

**Weapons already in live-packs (29):** none, sword, shield, axe, dagger, mace, hammer, spear, javelin, greatsword, greataxe, hammer2h, scythe, bow, longbow, crossbow, staff*, wand, tome, rifle, hunter-rifle, shotgun, pistol, gunblade.

**Content:** ~18 weapon masters · ~71 skill JSON · packs under `_anim_pack_stage` + Documents zips (Pro S&S, Great Sword, Melee Axe, grudge6gun, …).

---

## Phase 1 — Canonical packages (dedupe foundation) (3–5 days)

**Goal:** One import path for every game.

Publish / stabilize workspace packages (from **gameopen**, not re-copied into The-ENGINE):

| Package | Exports | Consumers |
|---------|---------|-----------|
| `@workspace/epicfight` | CombatController, fleet rules, **FleetWeaponSkill**, FLEET_COMBAT_INPUT | All combat hosts |
| `@workspace/drc-anim` *(new thin façade)* | `loadWeaponPackClips(weaponId)`, `createCombatDirector(root, pack)`, `assertLane` | Open, Avernus, Warlords |
| `@workspace/grudge-physics` | Rapier CCT / surface | Open first; Avernus later |
| `@workspace/drc-ui` *(new)* | Hydra pack loader + CraftPix slot components | Open, Avernus, GRUDOX, Warlords |

**Rules:**

- No game owns skill math outside epicfight.
- No game owns “how to load a weapon pack” outside drc-anim.
- Avernus **imports** packages; does not reimplement `weaponPacks.ts` forever.

**Delete / merge after adapters exist:**

- Parallel skill tables in The-ENGINE Avernus (keep as thin adapter to FleetWeaponSkill).
- Controller monorepo combat forks → consume packages or redirect play.

---

## Phase 2 — Animation + weapon packs complete (1–2 weeks)

**Goal:** Every equippable weapon has idle/walk/run/attack (+ skills) on **Bip001**, not raw Mixamo.

| Step | Action |
|------|--------|
| 2.1 | Stage melee zips into `_anim_pack_stage/{sword_shield_pro,greatsword,melee_axe}/` |
| 2.2 | Bake Mixamo authoring → `/anims/baked/{pack}/` rotation-only Bip001 (retargetMap + bake scripts) |
| 2.3 | Fill thin packs: `sword_shield` (today ~4 files), `twohand` / greatsword, axe |
| 2.4 | Wire `content/anims/weapon-live-packs.json` — every weapon: liveRoles + skillSlots + mixamoSources |
| 2.5 | `npm run anims:verify:strict` green in CI |
| 2.6 | Map skillSlots → `content/skills/*.json` + master-weaponSkills ids |

**Pack id map (canonical):**

| Family | animPack | Source packs |
|--------|----------|--------------|
| 1H + shield | sword_shield | Pro/Lite/rac S&S, public/anim/sword |
| 2H sword | twohand / greatsword_samurai | Great Sword Pack, raceGreat Sword |
| 1H axe / mace | sword_shield or melee_axe | Pro Melee Axe |
| Spear | polearm | existing bake (strong) |
| Bow | longbow | Longbow Loco + bow |
| Magic | magic | magic loco + staff |
| Guns | pistol / rifle | grudge6gun, wandandpistols, 25bone_* |

**Never:** bind Mixamo 25-bone FBX live onto grudge6 mesh. Authoring only → bake.

---

## Phase 3 — Weapon skills “done correctly” (1–2 weeks, can parallel 2)

**Goal:** Every weapon has a complete **FleetWeaponSkill** kit (slots 0–3 + F class + R ultimate).

Per weapon (use `assessWeaponSkillReadiness`):

1. [ ] 4 signature skills (1–4) + class F + ultimate R  
2. [ ] `animClip` / role points at **existing** baked clip  
3. [ ] `collider` SI metres (not 100×)  
4. [ ] `castEffectId` / `impactEffectId` or projectile  
5. [ ] `cooldown` + `staminaCost`  
6. [ ] Combo stages if multi-hit  
7. [ ] Icon path (CraftPix spell icons or pack art on R2)  
8. [ ] Registered in master-weaponSkills (ObjectStore)  

**Data SSOT order:**

```
content/weapons/wpn_*_master.json
content/skills/{weapon}_*.json
content/anims/weapon-live-packs.json  skillSlots[]
ObjectStore master-weaponSkills     ← live catalog for HUD
FleetWeaponSkill                    ← runtime cast shape
```

**CI:** script fails if weapon has skillSlots but readiness `ok: false`.

---

## Phase 4 — DRC host adapter (deploy correctly) (1 week)

**Goal:** Same API to “enter combat” from any game.

```ts
// Conceptual — one entry every game calls
startDrcSession({
  characterId,      // Railway
  weaponId,         // content weapon
  surface: 'open' | 'avernus' | 'warlords' | 'grudox',
  uiPack: 'open-combat' | 'avernus-pit' | 'harvest',  // from ui.grudge-studio.com
  mode?: AvernusMode | DangerMapId,
})
```

| Host | Access pattern |
|------|----------------|
| **Open** | Native Studio: library door / mode `danger` / maps |
| **GRUDOX** | Shell: launch Open combat session with SSO + characterId (or embed pack later) |
| **Avernus** | Keep pit + modes; **swap skill/input/anim** to packages; keep waves |
| **Warlords / client** | Same package; world host only |
| **Controller Vercel** | Same build as Open **or** retire play URL |

**Access principles:**

- SSO via Grudge ID; character from Railway only.  
- Deep links carry `characterId`, `weaponId`, `uiPack`, `returnTo`.  
- No third combat binary on a new subdomain until packages exist.

---

## Phase 5 — ui.grudge-studio.com for all games (1 week)

**Goal:** HUD is designed once, consumed many times.

| Step | Action |
|------|--------|
| 5.1 | Canonical packs on ui.grudge-studio.com: `open-combat`, `avernus-pit`, `harvest`, `warlords-mmo` |
| 5.2 | Each pack = HYDRA layout JSON (1920×1080) + craftpix role map |
| 5.3 | Runtime: `game-ui-runtime.js` + `game-ui-packs/index.json` (already fleet intent) |
| 5.4 | Games: `?embed=1&pack=avernus-pit` or fetch pack JSON and render CraftPix slots |
| 5.5 | Skill bar slots bind to **FleetWeaponSkill** ids, not hard-coded names |
| 5.6 | Textures: `assets.grudge-studio.com/ui/craftpix/**` or ui host assets |

**Do not:** ship Font Awesome–only combat bars when CraftPix/HYDRA pack exists.

**Open already has:** mode `/ui` embed to HYDRA — extend that pattern to Avernus and Warlords.

---

## Phase 6 — Remove duplications (ongoing after 1–5)

| Kill | Replace with |
|------|----------------|
| Avernus parallel `weaponPacks` skill defs | Load FleetWeaponSkill by weaponId |
| Controller combat fork | Package consumer or retire |
| Multiple FootIK implementations | One `@workspace` FootIK |
| Arena CDN as primary mesh host | R2 `models/grudge6/races` only |
| Per-game input legends | FLEET_COMBAT_INPUT + shared legend component |
| One-off skill bars | HYDRA hotbar-2row + skill slot binding |

---

## Phase 7 — QA gates (continuous)

| Gate | Command / check |
|------|-----------------|
| Anim integrity | `npm run anims:verify:strict` |
| Skill readiness | `assessWeaponSkillReadiness` all master weapons |
| Character look | diagnoseCharacterLook / fleet audit green |
| DRC input smoke | Automated key map equals FLEET_COMBAT_INPUT |
| UI pack smoke | Pack JSON loads; no missing craftpix URLs |
| Multi-host | Same weaponId same skill ids on Open + Avernus |

---

## Suggested calendar (aggressive but realistic)

| Week | Focus |
|------|--------|
| **W1** | Phase 0–1 packages + freeze rules + matrix |
| **W2** | Phase 2 melee bake (S&S + greatsword + axe) + verify:strict |
| **W3** | Phase 3 skills complete for melee + guns already baked |
| **W4** | Phase 4–5 Avernus + Open on shared packages + HYDRA packs |
| **W5** | GRUDOX access + kill controller fork + polish |

---

## First three engineering PRs (start now)

1. **`@workspace/drc-anim` façade** over existing loadBakedClip + AnimationDirector + fleetAnimSsot (no new mixer).  
2. **Extract Pro S&S + Great Sword** → stage → bake → weapon-live-packs green for sword + greatsword.  
3. **HYDRA pack `open-combat`** + Open skill bar binds FleetWeaponSkill slots; document Avernus pack `avernus-pit` next.

---

## Explicit non-goals (avoid distraction)

- New third-party animation graph engine.  
- Forcing Avernus onto Cannon→Rapier before skill/UI unify.  
- Meshy heroes as grudge6 SSOT.  
- “Just redirect everything to one path string” without package SSOT.

---

## Success metric

One sentence for leadership:

> Equip the same Railway character with the same sword on Open and Avernus: same keys, same anim pack, same four skill icons from the same HYDRA pack, same damage/CD numbers from epicfight.
