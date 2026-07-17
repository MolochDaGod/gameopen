# Systems · HUD · UX consolidation map

**Product:** https://open.grudge-studio.com  
**Code root:** `artifacts/animator`  
**Related:** [OPEN_SYSTEMS.md](./OPEN_SYSTEMS.md) · [OPEN_COLLECTION_CONSOLIDATION.md](./OPEN_COLLECTION_CONSOLIDATION.md) · [GAMEPLAY_LOAD_STACK.md](./GAMEPLAY_LOAD_STACK.md) · [DANGER_ROOM.md](./DANGER_ROOM.md) · [OPEN_CONSOLIDATION.md](./OPEN_CONSOLIDATION.md)

This doc is the **best-of consolidation plan**: which game systems are SSOT, what HUD pieces win, and how UX should converge so every mode feels like one product.

---

## 0. Thesis

| Layer | Best-of owner | Consumers must reuse |
|-------|---------------|----------------------|
| **Collection shell** | Open hub (`DoorSelect`, `openRoutes`) | All launches |
| **Identity / heroes** | Railway + `GameSession` | Never private rosters |
| **Combat feel** | Danger Room `Studio` + `Controller` + epicfight | Brawl, Survival, future T0 combat |
| **Characters 3D** | grudge6 runtime (`GrudgeAvatar` + baked Bip001) | All skinned heroes |
| **Worlds / voxels** | Mine-Loader (1 replica) + voxel-canonical | Realms, Codex, promote |
| **Arcade cabinets** | GRUDOX (`/arcade/*` edge) | Velocity, zombie, … |
| **HUD combat cluster** | `Hud.tsx` + `UnitFrame` + `hud/quickActions.ts` | Danger first; port to Brawl |
| **Activity modes** | `playerMode.ts` (Combat / Harvest / Build) | HarvestProductionUI + radial |

**Rule:** One system per concern. New modes **import** the owner; they do not fork gravity, keybinds, portraits, or skill bars.

---

## 1. Game systems — best-of inventory

### 1.1 Core loop systems (keep & share)

| System | SSOT path | Best practice |
|--------|-----------|---------------|
| Fixed physics tick | `lib/productionRuntime.ts` | `PHYSICS_HZ=60`, `GRAVITY_Y`, `PLAYER_HEIGHT_M=1.8` |
| Third-person move/camera | `three/Controller.ts` + `input.ts` | Same stack for Brawl/Survival |
| Rapier world | `three/PhysicsSystem.ts` | Ground plane + KCC where needed |
| Combat reactions | `@workspace/epicfight` | Parry / dodge windows from REACTION |
| Weapon skills | `arsenal/*` + `t0WeaponSkills` + ObjectStore master | Icons via `skillIcons.ts` |
| grudge6 kit | `three/grudge/*` | Unify skeleton · rematch clips · mesh_ids equip |
| Foot plant | `three/anim/legIk.ts` | Character + GrudgeAvatar `FootGrounder` |
| Activity mode | `three/playerMode.ts` | Q cycles · radial hold Tab |
| Harvest / craft shell | `HarvestProductionUI` + `content/harvest/*` | P opens production |
| Portraits | `lib/characterPortrait.ts` + `lib/hudPortrait.ts` | 2D only; mesh is separate |
| Fleet worlds catalog | `lib/fleetWorlds.ts` | Verified live hosts only |

### 1.2 Surfaces (integration tier)

| Surface | Tier | Engine to reuse |
|---------|------|-----------------|
| `/danger` | T0 | Studio (canonical combat) |
| `/brawl` `/survival` | T0 | BrawlerScene ← Controller + GrudgeAvatar + arsenal |
| `/dressing` | T0 | EditorMode (lab; not ship combat) |
| `/avatar` | T0 | AvatarEditMode (cube head) |
| `/voxel` | T0 | VoxelEditor → promote Mine-Loader |
| `/realms` | T1/T2 | Mine-Loader authority |
| `/arcade/*` | T1 | GRUDOX build |
| `/genesis` etc. | T2 | External + SSO handoff |

### 1.3 Do not fork

- Second WASD/camera in a new scene  
- Second character table (localStorage heroes)  
- Second keybind map (HUD shows Q parry while Studio uses C)  
- Second skill icon resolver  
- Second “player height” constant  

---

## 2. HUD consolidation

### 2.1 Target combat HUD (shipped direction)

```
┌──────────────────────────────────────────────────────────┐
│ Mode chip (Q) · radial · production (P)                  │
│                                                          │
│  [6 skill wing]   [UnitFrame portrait+HP/SP]  [6 util]   │  ← bottom-left cluster
│   LMB F 1 2 3 4         race/account art         X C R…  │
│                                                          │
│              crosshair / boss bar / flash                │
│  Target UnitFrame (lock) ──────────────────── top-right  │
└──────────────────────────────────────────────────────────┘
```

| Piece | Module |
|-------|--------|
| Cluster layout | `components/Hud.tsx` · `.rpg-combat-cluster` |
| Portrait ring + bars | `components/hud/UnitFrame.tsx` + `vitalAnim` |
| 6+6 action ids / keys | **`hud/quickActions.ts` (SSOT)** |
| Portrait URL | `lib/hudPortrait.ts` ← Studio snapshot |
| Themes / drag editor | `hud/hudConfig.ts` · `useHudEditor` |
| Mech overlay | `MechHud.tsx` (only while piloted) |

### 2.2 Keybind SSOT (must stay aligned)

| Key | Action | Owner |
|-----|--------|-------|
| **Q** | Cycle Combat → Harvest → Build | `playerMode` / Studio |
| **X** | Dodge (all modes) | Studio |
| **C** | Parry (combat only) | Studio |
| **RMB** | Block / lock focus | Studio |
| **R** | Heavy / skyfall | Studio |
| **F / 1–4** | Skills | Studio |
| **V / H / J** | Kick / bomb / heal | Studio |
| **Tab hold** | Radial | Studio + RadialMenu |
| **P** | Production shell | App + HarvestProductionUI |

Footer legend: `COMBAT_KEY_LEGEND` in `quickActions.ts`.  
**If Studio changes a key, update `QUICK_ACTIONS` the same PR.**

### 2.3 HUD improvement backlog (priority)

| Pri | Improvement | Notes |
|-----|-------------|--------|
| P0 | **Use `quickActions` in Hud wings** | No hardcoded wing lists |
| P0 | **Account `avatarUrl` → portrait** | GameSession → Studio → HudSnapshot |
| P1 | **Share UnitFrame on Brawl/Survival** | Same cluster component |
| P1 | **Cooldown binding for right wing** | dodge/parry CD when exposed on snapshot |
| P1 | **Mode-colored wing swap** | Harvest wing = ops tools; Build = place tools |
| P2 | **HudEditor knows combat-cluster panel** | One draggable cluster |
| P2 | **Kenney / theme tokens** on UnitFrame | `hudThemes` |

### 2.4 What not to merge

- Full-screen Action_Bar art as buttons  
- Mech cockpit into the foot combat wings (keep MechHud separate)  
- Equipment paperdoll into the combat cluster (I / Esc pause layer)

---

## 3. UX consolidations

### 3.1 Navigation UX

| Pattern | SSOT |
|---------|------|
| Path slugs | `lib/openRoutes.ts` `OPEN_SURFACES` |
| Hub cards | DoorSelect from hub surfaces |
| Character pick before combat | Campfire / Characters GRUDOX / FleetBar |
| External games | InAppGameCanvas + SSO query (`open=1`, characterId) |

### 3.2 In-session UX layers

| Layer | When | Escape |
|-------|------|--------|
| Combat | Default Danger | — |
| Radial | Hold Tab | Release / Esc |
| Production | P or harvest/build | P / Esc |
| Equipment | I | Esc / I |
| Admin / dock | Backquote / menus | Esc |

**Practice:** One modal/layer at a time; pointer lock releases when opening I/P.

### 3.3 Visual language

| Token | Use |
|-------|-----|
| Gold UnitFrame | Player + target status (fantasy combat) |
| Cyan skill slots | Active abilities |
| Mode colors | combat `#ff7a7a` · harvest `#7ee7a8` · build `#7fb0ff` |
| Damage / heal | red / green (vitalAnim) |

Avoid mixing Steam library chrome **inside** the combat viewport (keep that on hub).

### 3.4 Cross-mode UX parity checklist

When adding a new playable mode, copy:

1. `productionRuntime` constants  
2. `Controller` + `InputState`  
3. `GrudgeAvatar` or Character with foot IK  
4. `Hud` combat cluster **or** a thin wrapper that reuses UnitFrame + quickActions  
5. Same key legend  
6. Fleet character portrait + mesh_ids  

---

## 4. Implementation status (this cycle)

| Item | Status |
|------|--------|
| UnitFrame combat cluster on Danger | **Shipped** |
| 6+6 wings on Danger | **Shipped** (hardcoded → consolidating to quickActions) |
| quickActions keybind SSOT updated (C parry, Q mode) | **This doc / PR** |
| Clip rematch + foot IK grudge6 | **Shipped** |
| Account avatar in ring | Open (wire GameSession) |
| Brawl shares combat Hud | Open |
| Mode-specific wing content | Open |

---

## 5. Agent rules (consolidation)

1. Before new HUD chrome → check `UnitFrame`, `quickActions`, `hudConfig`.  
2. Before new combat scene → reuse Controller + productionRuntime + grudge6.  
3. Before new key → update `QUICK_ACTIONS` + Studio + legend in one change.  
4. Before new world host → `fleetWorlds` + live 200 check.  
5. Prefer T0 native or T1 edge mount over a third copy of the same game.

---

## 6. Smoke after consolidations

```
/login → / → /danger
  · UnitFrame portrait loads (race PNG or avatarUrl)
  · Left wing 6 skills · right wing 6 utility
  · Q cycles mode chip + production for harvest/build
  · C parry · X dodge · LMB attack animates (not T-pose)
  · Walk on floor (foot IK / capsule)
```
