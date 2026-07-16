# Proper game load stack — animations, controller, skills, panel, HUD

**Product surface:** Danger Room (and siblings) on https://open.grudge-studio.com  
**Engine:** `artifacts/animator` · `Studio.ts` + `Controller.ts` + `Hud.tsx`  
**Character SSOT:** Railway characters → grudge6 kit (CDN) · portraits separate ([CHARACTER_AVATARS.md](./CHARACTER_AVATARS.md))  
**Mesh SSOT:** [CHARACTER_MESH_DELIVERY.md](./CHARACTER_MESH_DELIVERY.md)

This is what it takes to ship a **playable** session: not just a library card, but walk + attack + skills + readable HUD + correct look.

---

## 1. One-sentence goal

On **Play**, the player has a **fleet character** with **textured skinned mesh**, **Bip001 locomotion + attack clips**, **weapon skills on a cool-down bar**, **equipment main panel**, and a **readable combat HUD** — without leaving Open.

---

## 2. Boot sequence (required order)

Never reverse these steps. Parallel only where noted.

```
1. Auth + GameSession.boot()
   └─ JWT · GET /api/characters?era=warlords · selectCharacter

2. Resolve presentation
   ├─ 2D portrait  → resolveCharacterPortrait (UI only)
   └─ 3D avatar    → resolveRaceModel + mesh_ids from equipment

3. Enter mode (e.g. /danger)
   └─ App mounts Studio(container, characterId, onHud)

4. Studio.async load (critical path)
   a. Scene / room / lights / physics world
   b. loadGrudge6CombatRig(race, preset, { meshIds, rebindAtlas: true })
      - FBX/GLB kit from assets.grudge-studio.com
      - Atlas rebind (sRGB, flipY false)
      - Fuzzy equip visibility
      - Baked clips idle/walk/run/attack (+ sprint)
   c. Controller attach (capsule + camera + ground)
   d. Weapons bind to hand sockets
   e. Bind arsenal / T0 weapon skills → HUD slot bindings
   f. Emit first HudSnapshot → React Hud paints

5. Ready gate (block input until true)
   └─ avatar.ready && clips.has(idle) && controller.groundedOnce
```

If any of **4b–4e** fails, show a **load error strip** with retry — do not drop the player into a T-pose silent arena.

---

## 3. Subsystems checklist

### 3.1 Animations

| Need | Implementation | Gate |
|------|----------------|------|
| Locomotion | Baked JSON `/anims/baked/**` (Open → arena rewrite) | idle + walk + run 200 |
| Attack one-shot | pack attack clip + mixer overlay | attack plays mid-swing |
| Weapon pack | class → `sword_shield` / `longbow` / `magic` / `unarmed` | swap weapon reloads pack |
| Skeleton | Bip001 only for grudge6 | hands found for weapons |

**Code:** `grudge/anims.ts`, `grudge6Runtime.ts`, `GrudgeAvatar` + optional `AnimationDirector`.

### 3.2 Controllers

| Need | Implementation | Gate |
|------|----------------|------|
| Move | WASD + sprint | no slide through walls |
| Camera | 3rd person orbit / combat lock options | not under floor |
| Combat | LMB attack · RMB block · C parry · X dodge · Q mode | inputs match HUD hints |
| Physics | Rapier / capsule + ground | feet on floor |

**Code:** `Controller.ts`, `input.ts`, `Studio` combat hooks.

### 3.3 Weapon skills

| Need | Implementation | Gate |
|------|----------------|------|
| Definitions | arsenal + `t0WeaponSkills` + ObjectStore master skills | slots non-empty |
| Icons | CDN `icons/pack/**` + local `/icons` fallback | no broken emoji-only bar |
| Cooldowns | Studio skill CD state → HudSnapshot | F / 1–4 / R light up |
| Hit windows | range + active frames before damage | no infinite-range LMB |

**Code:** `arsenal/*`, `skillIcons.ts`, `weaponSkillPacks.ts`, content `skills/*.json`.

### 3.4 Main panel (equipment / character)

| Need | Implementation | Gate |
|------|----------------|------|
| Roster | GameSession characters | select hero swaps avatar |
| Paperdoll / equip | EquipmentScreen + account equipment | mesh_ids apply |
| Race art | CharacterAvatar portraits | correct race/class face |
| Saves | `saveData.open` PATCH Railway | survives refresh |

**Code:** `EquipmentScreen.tsx`, `AccountPanel`, `characterLoadout.ts`, `characterEquipmentMesh.ts`.

### 3.5 HUD (gameplay UX)

| Need | Implementation | Gate |
|------|----------------|------|
| Vitals | HP / stamina / resource bars | update every frame via snapshot |
| Action bar | LMB · F · 1–4 · R · block hint | icons + CD masks |
| Target | soft/hard target frame | name + HP if selected |
| Mode | Combat / Harvest / Build badge | Q cycle visible |
| Feedback | damage numbers / hitstop / toasts | readable, not spam |

**Code:** `Hud.tsx`, `HudSnapshot` in `types.ts`, Studio `onHud`.

---

## 4. UX / UI standards (gameplay)

Industry-aligned rules for Open combat UIs:

1. **Crosshair-first** — center reticle; skills never hide aim.  
2. **Bottom action bar** — primary left, skills center-bottom, utility right; **never** stretch a full-screen Action_Bar texture as clickable buttons.  
3. **Hold vs tap** — block is hold (RMB); skills are tap; radial is hold Tab.  
4. **Consistent key legend** — HUD footer always matches `input.ts` bindings.  
5. **Loadout before fight** — Equipment panel is a **pause layer**, not a second game. Esc returns to combat.  
6. **One selected character** — FleetBar / picker always shows active hero portrait.  
7. **Fail soft** — missing icon → local PNG; missing clip → idle + console warn; never blank white screen.  
8. **60 fps budget** — HUD DOM updates via snapshot throttle (~10–20 Hz for bars is OK; combat must stay 60).  
9. **Color** — damage red, heal green, stamina yellow, skill CD grey overlay.  
10. **Mobile later** — desktop first; touch pads already exist (`TouchControls`) but secondary.

---

## 5. What already exists in Open (large)

| Piece | Status |
|-------|--------|
| Studio combat sandbox | Mature (~9k lines) |
| Controller + input | Mature |
| Hud + skill icons | Present |
| Equipment screen | Present |
| GrudgeAvatar + grudge6 runtime | Production path |
| T0 / arsenal skills | Present |
| Fleet auth + characters | Railway wired |
| Portrait cascade | Shipped |
| Mesh CDN + fuzzy equip | Shipped |

So this is **integration + reliability + polish**, not greenfield.

---

## 6. What’s still required for “proper load” every time

### P0 — block release (must work)

| # | Work item | Owner area |
|---|-----------|------------|
| 1 | **Ready gate** in App: no free look until avatar + idle clip + controller ready; show loading strip | App + Studio |
| 2 | **Weapon pack reload** on weapon swap without disposing director too early | GrudgeAvatar / Studio |
| 3 | **mesh_ids from account equipment** applied on every character set | characterEquipmentMesh → GrudgeAvatar.setMeshIds |
| 4 | **Anim pack 200s** for all active packs via Open `/anims/baked` → arena (document pack list) | vercel rewrites + probe |
| 5 | **Skill bar bindings** always rebuild when weapon/character changes | Studio → HudSnapshot |
| 6 | **Smoke script** (manual or Playwright): login → danger → walk → LMB → F skill → open equip | CI / agent |

### P1 — play quality

| # | Work item |
|---|-----------|
| 7 | Target frame + soft lock polish (grudge-combat-targeting) |
| 8 | Hit-window damage only (no full damage on press) |
| 9 | Equipment panel = pause; keyboard focus trap |
| 10 | Damage numbers + floating combat text budget |
| 11 | Per-class portrait PNGs under `races/portraits/` |

### P2 — fleet polish

| # | Work item |
|---|-----------|
| 12 | Mirror full anim packs to R2 (drop arena dependency) |
| 13 | ObjectStore gear_presets live fetch (JSON 404 today on one path) |
| 14 | Shared HUD design tokens (Kenney / pixel pack) across modes |
| 15 | In-app canvas games (Genesis/Realms) same input legend where possible |

---

## 7. Minimum “green” smoke (confirmation gates)

From `grudge6-combat-runtime` + Open:

1. [ ] Sign in → character list non-empty  
2. [ ] `/danger` loads without infinite spinner  
3. [ ] Character textured (not pink / not capsule)  
4. [ ] Walk/run anims play  
5. [ ] LMB attack one-shot plays  
6. [ ] At least one skill (F or 1) fires + CD shows  
7. [ ] RMB block state visible  
8. [ ] Equipment panel opens and applies a mesh change or weapon  
9. [ ] HUD HP/stamina move when damaged/spent  
10. [ ] Portrait matches race (or avatarUrl)  

Report pack id, ranges, and fail steps — no silent “looks fine”.

---

## 8. Effort model (honest)

| Track | Rough effort | Notes |
|-------|--------------|-------|
| P0 ready gate + equip wire + skill rebind | **2–4 focused days** | Most code exists; glue + tests |
| P1 combat feel + HUD polish | **1–2 weeks** | Iteration + tuning |
| P2 CDN anim mirror + design system | **ongoing** | Ops + content |

You do **not** need a rewrite of Studio. You need a **reliable boot pipeline**, **strict ready gate**, and **confirmation smokes** so mesh/anim/skill/HUD always come up together.

---

## 9. File map (where to work)

| Concern | Path |
|---------|------|
| Mode mount | `App.tsx` danger branch |
| Engine | `three/Studio.ts` |
| Move | `three/Controller.ts` · `three/input.ts` |
| Avatar | `three/grudge/GrudgeAvatar.ts` · `grudge6Runtime.ts` |
| HUD | `components/Hud.tsx` |
| Equip panel | `components/EquipmentScreen.tsx` |
| Skills | `three/arsenal/*` · `skillIcons.ts` |
| Fleet character | `game/GameSession.ts` · `lib/grudgeAuth.ts` |
| Portraits | `lib/characterPortrait.ts` |

---

## 10. Definition of done

A new player can:

1. Open library → Danger Room  
2. See their **fleet hero** (portrait + 3D kit)  
3. **Move and fight** with animations  
4. Use **weapon skills** from the bar  
5. Open **main panel** to change gear/weapon and return  
6. Read **HUD** without confusion  

That is “proper load of games” for Open combat. Library titles (Genesis, Realms) reuse the same **auth + character + canvas** handoff, with their own engine inside the frame.
