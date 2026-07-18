# Third-person controller — Grudge Open / Island

Reference: **[hh-hang/three-player-controller](https://github.com/hh-hang/three-player-controller)** (MIT).

We **do not** npm-install that package as the runtime (scale, BVH scene, and fleet grudge6 differ). We **port patterns** into our stacks.

## Mapping

| hh-hang API | Grudge Open (Danger) | Island (GrudgeBuilder) |
|-------------|----------------------|------------------------|
| Capsule + BVH move | `Controller` + optional Rapier KCC / room bounds | `CharacterController3D` + terrain / BVH sampler |
| Orbit + over-shoulder + spring look-at | `Controller.setCameraOpts` | Island camera follow |
| `thirdMouseMode` 5 (face cam) | RMB **FOCUS** + `setLockTarget` | Hard focus / aim mode |
| Locomotion sets idle/walk/run/fly | `PlayerAnimationDirector` + grudge6 baked packs | Animation blend + explorer driver |
| Toggle fly (F) | **Skill short-flight** (timed) + staff hover | Swim / climb states + skill flight |
| Jump multi-stage | Jump + double + wall jump + wall run | Jump / double / swim surface |
| Vehicle | Mech / boat / ship systems | Ship boarding |
| `registerAnimation` / `playAnimation` | `PlayerAnimationDirector` | Character one-shots |

## Camera (already + defaults)

On Danger spawn, Studio enables:

```ts
controller.setCameraOpts({
  enableSpringCamera: true,
  springCameraTime: 0.06,
  enableOverShoulderView: true,
  camOverShoulderOffsetRatio: 0.12,
  camLookAtHeightRatio: 0.92,
  enableZoom: true,
});
```

Occlusion pull-in for dungeons; floor clamp for Danger Room (same idea as their camera obstacle avoidance).

## Skill short-flight

`Controller.startSkillFlight({ duration, speed, launch })`:

- Timed free-flight (not permanent fly toggle)
- Cam-relative WASD + Space up / Ctrl down
- Used when skill parts have large `dash` or leap/air labels

Staff **hover** remains `startHover` (fixed height float). Short-flight is for **gap-closers / leaps**.

## Island

`CharacterController3D` already has ground / swim / climb / dash. Prefer:

1. Terrain/BVH ground sample for feet  
2. Accel/decel on XZ (smooth stop)  
3. Skill flight API for leap skills (same contract as Danger)

## Anim packs (all heroes)

See `anims.ts` + `TRAVERSAL_CLIPS`: standing walk/run (no tip-walk / run-to-roll), jump, directional dodge for AA/DD.

## Source tree (cloned for study)

`F:\GitHub\three-player-controller\` — `src/playerController.ts`, `systems/CameraSystem.ts`, `systems/AnimationSystem.ts`, `example/shooting/` (LocalPlayer + spine IK).
