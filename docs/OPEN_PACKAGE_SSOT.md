# Open package SSOT — npm · workspaces · what NOT to invent

**Product:** https://open.grudge-studio.com  
**App package.json:** `artifacts/animator/package.json`  
**Root engines:** Node **≥ 20**  
**Fleet skill:** `grudge-3d-game-packages` (all Grudge 3D games)  
**Sibling:** `docs/OPEN_STACK.md` (topology / rewrites) · `docs/ANIMATION_FLEET_SSOT.md` · `docs/CONTROLS_CAMERA_WEAPON_SSOT.md`

**Rule:** Extend this matrix. Do **not** add a second mixer, second physics engine, second controller package, or random “anim/terrain” npm to paper over missing in-repo SSOT.

---

## 1. Five columns (every deploy)

| Column | Capability | Open source of truth |
|--------|------------|----------------------|
| **Gameplay** | Scene, combat, harvest | `Studio` + `three` + `@workspace/epicfight` |
| **Saves / identity** | SSO, characters, bag | Same-origin `/api/*` → Railway + Grudge ID |
| **Assets** | GLB / baked anims / icons | `assets.grudge-studio.com` + ObjectStore |
| **Controller** | Grounded SI body ~1.8–2.0 m | `Controller.ts` + `setGroundHeightAt` + Rapier KCC |
| **Camera** | One play writer | `Controller` viewMode + activity profiles |

---

## 2. npm packages that are required (animator app)

Pin versions in `artifacts/animator/package.json`. Prefer these roles only.

### Core 3D / physics

| Package | Role | Pin guide |
|---------|------|-----------|
| **`three`** | Renderer, scene, **`AnimationMixer`**, loaders | **^0.185.x** |
| **`@dimforge/rapier3d-compat`** | Browser WASM physics | **^0.19.x** **SSOT for web** |
| `@dimforge/rapier3d` | Optional native; prefer **compat** for Vite | Same major as compat if kept |
| **`three-mesh-bvh`** | Fast mesh ground / ray queries | ^0.8–0.9 |
| **`three-pathfinding`** | Navmesh paths (AI) | ^1.3 |
| **`yuka`** | AI steering / GOAP helpers | ^0.7 |
| **`postprocessing`** | Bloom / cinema grade (not loco) | ^6 |
| **`camera-controls`** | **Editor / free look only** — not combat sole writer | ^2 |

### App shell (not character SSOT)

| Package | Role |
|---------|------|
| `react` / `react-dom` ^19 | UI shell |
| `wouter` | Client routes |
| `@tanstack/react-query` | Account / REST |
| Radix / Tailwind / framer-motion / sonner | HUD chrome only |
| Clerk packages | Optional identity surface; fleet SSO remains primary |

### Build / Node (devDependencies)

| Package | Role |
|---------|------|
| `vite` ^6 | SPA bundle |
| **`vite-plugin-wasm`** | Rapier WASM |
| **`vite-plugin-top-level-await`** | Rapier boot |
| `@vitejs/plugin-react` | React |
| `typescript` ~5.9 | Types |
| `@types/three` ~0.184 | Align near three |
| `@types/node` | Scripts |
| `vitest` | Unit / playtest |

**Root scripts** (`package.json`): `build` → `scripts/vercel-build.mjs`; `test:physics` → `lib/grudge-physics`.

---

## 3. In-repo workspaces (not replaceable by random npm)

| Package path | Name | Owns |
|--------------|------|------|
| `lib/grudge-physics` | `@workspace/grudge-physics` | Rapier KCC, aim constants, capsule SI |
| `lib/epicfight` | `@workspace/epicfight` | Fleet weapon skills, combat windows |
| `lib/grudge-runtime` | `@workspace/grudge-runtime` | Shared runtime helpers |
| `lib/vfx` | `@workspace/vfx` | `three.quarks` wrappers |
| `lib/assets` | `@workspace/assets` | Asset path helpers |
| `lib/danger-net` / `brawl-net` / `carrier-net` | net clients | Multiplayer protocols |
| `lib/db` | drizzle + pg | Server-side only (characters still Railway) |

**Published fleet (when shared across games):** `@grudge-studio/core` · `assets` · `asset-resolver` · `animator` · `engine` · `sdk` — see skill `grudge-studio-npm`. Open may use local copies; do not invent a third.

---

## 4. Capability → use this (not a new package)

| You need | Use | Forbidden fork |
|----------|-----|----------------|
| **AnimationMixer / clips / crossfade** | `THREE.AnimationMixer` | Second mixer npm |
| **Loco blend / direction weights** | `three/anim/blend.ts` + director | Tween as loco authority |
| **Role pack (climb/swim/hurt/death)** | `fleetAvatarHydrate` + baked `/anims/baked` | New “anim service” |
| **Weapon live packs** | `weaponLivePacks` + `content/anims/*` | Hardcoded pack paths per feature |
| **Body on terrain** | `Controller.setGroundHeightAt` | Free-fly only play mode |
| **Foot IK plant** | `FootGrounder` + `anim/terrainFootSample` | New IK package |
| **Map surface rebind** | `Studio.wirePlayerSessionOnMap` (one apply) | Setting ground **or** feet alone |
| **Combat skills / Getsuga residual** | `meleeStrikeFx` + T0 + epicfight | Alt+Space sandbox ability |
| **Physics bodies** | Rapier via `@workspace/grudge-physics` | Cannon + Rapier same body |
| **Nav AI** | `three-pathfinding` + `yuka` | One-off A* per map forever |
| **Play camera** | `Controller` sole writer | Orbit + TPC both writing |
| **Assets** | `assets.grudge-studio.com` | Meshy heroes / multi-GB git |

---

## 5. Player session (map open must not fork)

```
PlayerSession (stable across map switch)
  ├── Controller          one instance
  ├── Avatar              Character | GrudgeAvatar
  ├── weaponId + T0 skills
  ├── viewMode + activityMode   (user-owned; map must not force)
  └── MapSurface | null         only thing map code rebinds
        heightAt · footSample · water · occluders · boundHalf
```

| Map may change | Map must NOT change |
|----------------|---------------------|
| Terrain height, water, bounds, occluders | New Controller class |
| Foot sampler from same height field | Weapon / skill tree |
| Fleet role gap-fill (`ensureFleetRolesReady`) | Activity/camera mode by default |

---

## 6. Minimum template (new Open-like game)

```json
{
  "engines": { "node": ">=20" },
  "dependencies": {
    "three": "^0.185.1",
    "@dimforge/rapier3d-compat": "^0.19.3",
    "three-mesh-bvh": "^0.8.3",
    "three-pathfinding": "^1.3.0",
    "yuka": "^0.7.8",
    "postprocessing": "^6.39.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "vite": "^6.3.5",
    "vite-plugin-wasm": "^3.6.0",
    "vite-plugin-top-level-await": "^1.6.0",
    "@vitejs/plugin-react": "^4.4.1",
    "typescript": "~5.9.2",
    "@types/three": "^0.184.1",
    "vitest": "^4.1.8"
  }
}
```

Add `@workspace/grudge-physics` + `@workspace/epicfight` when combat/KCC is required.

R3F island games (not Open Studio loop): add `@react-three/fiber` · `drei` · `@react-three/rapier` instead of dual-writing with Open’s imperative `Controller`.

---

## 7. Deploy / PR gate

```
[ ] three ~0.185
[ ] rapier3d-compat ~0.19 (one physics authority)
[ ] vite-plugin-wasm + top-level-await if Rapier in browser
[ ] three-mesh-bvh if mesh outdoor ground
[ ] No second AnimationMixer library
[ ] No Cannon + Rapier on same bodies
[ ] Controller grounded SI — not free-fly only for playable maps
[ ] One play camera writer; Orbit gated to edit/cinematic
[ ] Anim roles: fleet hydrate + baked paths — not a new npm anim stack
[ ] Assets: CDN / ObjectStore — no Meshy as shipped hero
[ ] Auth: same-origin /api → Railway (or explicit guest-only flag)
[ ] Map open: same Controller ref + weaponId + viewMode; only surface rebinds
```

Smoke: `npm run smoke:prod:open` · physics: `npm run test:physics` · anim integrity scripts as needed.

---

## 8. Agent rules (stop package sprawl)

1. **Search this doc + `artifacts/animator/package.json` before `npm install`.**
2. **Prefer in-repo SSOT** (`Controller`, `fleetAvatarHydrate`, `meleeStrikeFx`, `grudge-physics`) over a new dependency.
3. **One physics, one mixer, one play camera, one skill adapter.**
4. **UI packages** (Radix, recharts, …) never become character/terrain authority.
5. **Deprecate dual Rapier installs** over time — keep **compat** as web SSOT.
6. If a capability is missing, **extend** an existing module; do not open a parallel folder named `*2` / `new*` / `v2`.

---

## 9. Skill map

| Concern | Skill / doc |
|---------|-------------|
| Package matrix (fleet) | `grudge-3d-game-packages` |
| This file (Open pin) | **`docs/OPEN_PACKAGE_SSOT.md`** |
| Topology / rewrites | `docs/OPEN_STACK.md` |
| Anim loaders / packs | `docs/ANIMATION_FLEET_SSOT.md` |
| Controls / camera | `docs/CONTROLS_CAMERA_WEAPON_SSOT.md` |
| Rapier SI | `docs/WARLORDS_PHYSICS_SSOT.md` · skill `grudge-rapier` |
| grudge6 mesh/anim | `grudge6-full-stack` · `grudge-character-correctness` |
| Onboarding a new game | `grudge-game-onboarding` |

---

## Changelog

| Date | Note |
|------|------|
| 2026-08-02 | Initial Open package SSOT from fleet matrix + live `artifacts/animator/package.json` |
