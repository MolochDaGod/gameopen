# GRUDOX platform vision (Roblox-shaped)

**Owner host:** `grudox.grudge-studio.com`  
**Do not invent substitute products for cabinet games** (e.g. Voxel Velocity ≠ Danger Room).

---

## 1. What you are building

One **fleet OS** (like Roblox):

| Layer | Role | Today’s code |
|-------|------|----------------|
| **Launcher / hub** | Games list, cabinets, identity handoff | GRUDOX shell (`grudox-staging` → `grudox.grudge-studio.com`) |
| **Arcade (published games)** | Playable cabinets (racer, brawler, zombie, …) | GRUDOX `/arcade/*` → Voxel Arcade |
| **Creator / character** | Make & edit characters, combat lab, dressing | **Open** (`open.grudge-studio.com` ← gameopen Animator) |
| **World / open sandbox** | Build + explore multiplayer | VoxGrudge (`voxgrudge` + `/api/space`) |
| **Engine primitives** | three.js + Rapier controller, combat, physics | gameopen / threejs-rapier monorepo (`Studio`, `Controller`) |
| **Room net** | Shared multiplayer backends | Railway `voxgrudge-grudox-room-production` |
| **Identity + heroes** | Grudge ID + Railway characters | `id.grudge-studio.com` + grudge-api |

---

## 2. Product map (correct ownership)

```
grudox.grudge-studio.com          ← PLATFORM (launcher + arcade + deploy surface)
├── /                             hub (games / editors / fleet links)
├── /arcade/                      Voxel Arcade lobby
├── /arcade/play/racer            Voxel Velocity  ← REAL RACER
├── /arcade/play/zombie           Voxel Undead
├── /arcade/play/z-brawl          Z-Brawl
├── /arcade/play/brawler          Brawler cabinet
├── /voxgrudge/                   VoxGrudge world build
└── /carrier-host/                Carrier

open.grudge-studio.com            ← CHARACTER + COMBAT LAB (how heroes are made)
├── /                             Open hub (doors)
├── /danger                       Danger Room (controller, weapons, skills, lock)
├── /dressing                     Dressing room / avatar edit
├── /brawl                        Native Ruins Brawler (optional)
├── /world                        Native VoxGrudge editor + space presence
└── /arcade/play/*                MUST hand off to GRUDOX arcade (not reimplement)

threejs-rapier / gameopen engine  ← shared runtime libraries (Studio, Rapier, anim)
voxgrudge repo                    ← open-world content + room client patterns
```

### Cabinet rules
| Cabinet | Game | Host |
|---------|------|------|
| `racer` | **Voxel Velocity** (racing) | **GRUDOX arcade only** |
| `zombie` | Voxel Undead | GRUDOX arcade |
| `z-brawl` | Z-Brawl | GRUDOX arcade |
| `brawler` | Ruins Brawler | GRUDOX arcade **or** Open native |
| `explorer` | Danger Room / dressing | Open |
| `voxgrudge` | Open world | GRUDOX **or** Open `/world` |

---

## 3. Characters (your Open design)

### Live character lab (media SSOT)
**https://threejs-rapier-react-three-controll.vercel.app/**  
= Animator monorepo (`threejs-rapier-react-three-controller`) — full **Heroes of Grudge**  
`models/grudge/{race}_{class}.glb` (6×4), weapons, combo/swim GLBs, controller.

Open (`open.grudge-studio.com`) must **load those characters**, not a thinner incomplete deploy tree.

Characters are **not** invented per game:

1. **Playable prefabs** → Animator CDN / Open catalog `grudge-{race}-{class}`  
2. **Create / edit account heroes** → Character Studio / Open dressing + fleet Railway  
3. **Combat feel** → Danger Room `Studio` + `Controller` + weapons + skills + lock  
4. **Carry into GRUDOX** → SSO + `characterId` on arcade deep-links  

Every arcade game should **consume** that character contract, not own a private roster.

---

## 4. Engine / Rapier role

`threejs-rapier-react-three-controller` (and gameopen’s Animator) is the **engine kit**:

- third-person controller, weapons, skills, Rapier physics  
- used for **Open combat lab** and as the **reference** for combat cabinets  
- **not** a substitute for Voxel Velocity (different genre)

When a GRUDOX game needs “Danger Room feel,” it should **import that stack**, not open a fake Danger Room under the racer URL.

---

## 5. Open console errors (classified)

| Error | Meaning | Fix direction |
|-------|---------|----------------|
| `401` on `/api/auth/*` when guest | Expected (no session) | Quiet probes; don’t treat as crash |
| `404 /api/account/me` | Route does not exist | Use `/api/auth/me` only |
| `404 anim/.../melee-combo-*.glb` | GLB packs not deployed | Fall back to FBX combos on disk |
| `404 anim/.../swimming.glb` | Only `.fbx` shipped | Fall back to FBX |
| `D:/VoxelAssets/...png` | Bad absolute texture paths in FBX | Ignore or strip external tex; use atlas |
| `404 models/weapons/gunblade.glb` | Missing asset | Alias to sword/spear until real mesh |
| `wss://open.../api/space` failed | Same-origin WS via Vercel rewrite | Use Railway `zoneWsUrl('/api/space')` |
| `message channel closed` | Browser extension | Ignore |

---

## 6. Migration path (Roblox-style, ordered)

Do **not** start by remapping slugs. Order of work:

1. **Document ownership** (this file) — agreed  
2. **Fix Open asset/auth noise** so character lab is usable  
3. **Edge: open `/arcade/*` → GRUDOX** (real Voxel Velocity URL)  
4. **GRUDOX launcher cards** → deep-link with SSO + characterId  
5. **Shared character runtime package** (grudge6 director + Controller contract) consumed by Open + arcade games that need combat  
6. **Deploy pipeline** (GRUDOX as deployer): publish cabinet → arcade roster (later)

---

## 7. Smoke list

```
https://grudox.grudge-studio.com/arcade/play/racer   # Voxel Velocity
https://open.grudge-studio.com/danger                # character combat lab
https://open.grudge-studio.com/dressing              # character setup
https://open.grudge-studio.com/world                 # vox editor + space WS
```

After edge proxy:  
`https://open.grudge-studio.com/arcade/play/racer` → same as GRUDOX Velocity (not Danger Room).
