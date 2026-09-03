# Build / place UX (Open + ui.grudge-studio)

Canonical camp build controls for Danger Room / annihilate / claim UI.

## Input contract

| Input | Build mode (ghost active) | Notes |
|-------|---------------------------|--------|
| **LMB** | Place once, **end** ghost | Single deploy |
| **RMB** | Place and **continue** | Chain place; ghost stays |
| **R** | Rotate ghost 45° | Not heavy attack while ghost active |
| **Esc** | Cancel ghost | Leaves build mode tools active |
| **E** | Interact nearest | Door/gate open-close · workbench/forge/vendor · storage · ally post |
| **Q** | Cycle combat ↔ harvest ↔ build | Leaving build cancels ghost |
| **F8** | Free mouse | Cursor drives ghost aim (claim panel) |

## Ghost assist

- Prefer **free-aim / crosshair ground plane** hit for ghost XZ.
- Fallback: body-forward 3.2 m from player feet.
- Blue = valid (claim rights ok); red = out of claim.
- **Cell frame:** `models/build/zhunbei.glb` (`BuildGridOverlay`) — grid-perfect inner plate + cardinal arrows. The placeable ghost sits **inside** that snapped frame. Inner plate scales to the placeable footprint (or 1 m when only selecting a cell). Same RTS claim buildings and survival / Q-build placement. No second snap engine.

## UI entry points

| Surface | Action |
|---------|--------|
| Claim panel **B** / CampClaimFlagPanel | `Place ghost` → `Studio.beginPlacePlaceable(id)` |
| Build radial tools | LMB without ghost starts ghost for tool |
| ui.grudge-studio.com | Links into Open claim/build; same Studio APIs |

## Systems

| Module | Role |
|--------|------|
| `camp/CampBuildSystem.ts` | Ghost, rotate, commit, interact, island |
| `camp/placeables.ts` | Catalog |
| `camp/placeableCapabilities.ts` | Function matrix |
| `Studio.runActivityTool` | LMB/RMB place wiring |
| `Studio.handleKey` | R / Esc / E |

## Production assets

Placeable meshes load via fleet GLB (R2 / same-origin). Mixamo FBX packs are **not** required for build.
