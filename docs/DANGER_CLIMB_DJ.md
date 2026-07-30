# Danger Room — Racalvin DJ cove + climb hold skill

## DJ (Racalvin / disc_jockey)

| Item | Path / value |
|------|----------------|
| Source asset | `Documents/disc_jockey.glb` → `public/models/dj/disc_jockey.glb` |
| Loader | `DjBooth.ts` via `loadGltfFirst` |
| Clips | idle · noticing player · music playing · swing · change discs 1/2 · towerup · defeated |
| Cove | Enlarged in `DangerRoom` (~10.8 m window, 5.2 m depth, higher ceiling) |
| Lights | 5 pulsing point lights + neon frame + back strips (room BG still visible) |
| Music drive | `MusicPulse` phrase boundaries pick show clips |

Cages / props remain from **room presets**; alcove only expands the +Z stage.

## Climb wall (skill build)

| Item | Path / value |
|------|----------------|
| Source asset | `Desktop/climbingwall.glb` → `public/models/maps/climbing/climbingwall.glb` |
| System | `climb/ClimbWallSystem.ts` |
| Faces | **opposite** (−Z, facing DJ) · **left** (−X) · **right** (+X) — not DJ wall |
| Visual | Climb mesh **invisible**; room walls/backgrounds stay |
| Holds | Centres of `shard*` / peg meshes (or synthetic grid fallback) |
| Graph | `buildHoldGraph` · BFS `pathHolds` for AI peg→peg |
| IK rules | `climbHolds.ts` — hands above feet; hands drag feet; feet re-pick under hands |

### IK locomotion rules

1. Hands move to next upward hold within `handReach`.
2. Hands may drag feet toward holds under the hand pair.
3. Feet then select next realistic hold: below hands by `handAboveFootMargin`, within `footUnderHand`, within `footReach`.
4. Always enforce **hands Y ≥ feet Y + margin**.

### Review / debug

```ts
studio.toggleClimbHoldDebug(); // spheres on holds
studio.getClimbWallReview();   // hold counts, source URL, notes
```

Wire skeleton bone two-bone IK (hand/foot chains) on `Character` / `GrudgeAvatar` post-mixer when `surface === "climb"` — hold targets from `ClimbWallSystem.holdPosition(id)`.

## Deploy

`.vercelignore` exceptions for `models/dj/**` and `models/maps/climbing/**`.
