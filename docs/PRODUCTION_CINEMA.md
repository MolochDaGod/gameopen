# Production cinema — game-flow recordings

**Status:** SSOT 2026-07  
**Host QA:** https://open.grudge-studio.com  
**Code:** `artifacts/animator/src/three/cinema/*` · `components/ProductionCinema.tsx`

---

## Purpose

Organize **game flow** with film-grade timing: intro → library → **character select/create** → lobby → home island → sectors (Hellmaw) → combat.  
Each “recording” is a **CinemaManifest** (not a video file): camera keys, captions, mystical post, character/shell assets, transition targets.

## Surfaces

| Surface | Cinema id | Path / mode |
|---------|-----------|-------------|
| Library backdrop | `intro_doors` | `/` doors (loop) |
| Intro → roster | `intro_to_characters` | Landing enter → `/characters` |
| Character select establish | `char_select_establish` | `/characters` campfire |
| Lobby | `lobby_establish` | `/lobby` |
| Home island | `home_island_arrive` | catalog (wire on sail/home entry) |
| Hellmaw sector | `sector_hellmaw` | catalog (sector s / volcanic) |
| Danger cold open | `danger_establish` | catalog |

## Stack

| Layer | Tech |
|-------|------|
| Timeline | `CinemaTimeline` (pure, testable) |
| Stage | `ProductionCinemaScene` — camera-controls, torch GLSL, embers, GLB characters |
| Post | pmndrs mystical grade (`createMysticalComposer`) or subtle |
| React | `ProductionCinema` + `CinemaFlowGate` (once per session) |
| Catalog | `PRODUCTION_CINEMAS` / `CINEMA_FLOW` |

## Character inclusion

Assets load via `loadGltfFirst` with SI height fit (`CHARACTER_HEIGHT_M = 1.8`).  
Hero candidates: `introgamer`, `astrocreeper`, `racalvin`, …  
Boss Hellmaw: `shadow-flame-mantis.prod.glb` at 3.2 m.

## Flow (production)

```
Landing (sign-in)
    ↓ cinema intro_to_characters
Characters campfire (select / create / avatar)
    ↓ play
Danger / Genesis / Realms / Lobby
    ↓ optional sector cinemas
Home island · Hellmaw · sailtest
```

Library (`doors`) keeps ambient `intro_doors` under Steam UI.

## Authoring a new cinema

1. Add `CinemaManifest` in `catalog.ts`  
2. Register in `PRODUCTION_CINEMAS` + `CINEMA_FLOW`  
3. Gate surface with `<CinemaFlowGate cinemaId="…" />` or backdrop `<ProductionCinema />`  
4. Unit test via `validateCinemaManifest`  
5. QA on open.grudge-studio.com  

## Kill list

- Localhost-only sign-off for cinema timing  
- Fitting world shells to 1.8 m character height  
- Player-controlled camera during flow cinema  
- Skipping production character meshes for capsules  

## Related

- [PRODUCTION_SYSTEMS_PATTERN.md](./PRODUCTION_SYSTEMS_PATTERN.md) — CF / Vercel / Railway / REST / load timing  
- [PRODUCTION_WORLD.md](./PRODUCTION_WORLD.md)  
- [VOLCANO_WORLD_BOSS.md](./VOLCANO_WORLD_BOSS.md)  
- Skill: `grudge-production-cinema`  

