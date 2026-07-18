# Status aura / buff / debuff VFX

**Code**
- `fx/StatusFx.ts` — catalog, controller, apply/HUD
- `fx/auraShaders.ts` — **inflated shell shaders** (0.1 m along normals)
- `fx/auraAccents.ts` — particles, orbs, wings, orbiting splines, crystals

## Shell layer (unit surface + 0.1 m)

Vertex shader inflates every shell vertex:

```glsl
position + normalize(normal) * uExpand   // uExpand = 0.1 m default
```

So the aura is a **mesh layer outside the unit**, not a flat billboard. Humanoid proxy = capsule body + head (matches ~1.8 m characters). Same material can be applied to real unit meshes via `createExpandedMeshLayer(mesh, mat)`.

## Shader patterns

| Pattern | Look | Typical statuses |
| --- | --- | --- |
| `healSwell` | Emerald rising soft bands | regen, poison green |
| `chargeGlow` | Emerald radial charge pulse | absorb, cast flash |
| `iceSwirl` | Light-blue swirling veins | frozen, shielded |
| `arcanePulse` | Purple occult lattice pulse | haste, cursed |
| `fireRise` | Orange rising heat tongues | burning, empowered, rage |
| `sparkGrid` | Lightning grid flashes | shocked |
| `holyShimmer` | White-gold fresnel sparkle | blessed |
| `sleepHaze` | Soft blue fog bands | sleep |

All use procedural FBM noise + fresnel rim + additive blending.

## Accents (stacked)

| Accent | Motion |
| --- | --- |
| **Particles** | rise / orbit / spark |
| **Orbs** | hovering glowing spheres |
| **Wings** | soft additive wing flaps |
| **Spline orbit** | spinning ribbon + sparks (`splineVfx`) |
| **Hover crystals** | octahedron shards (ice/root) |

Recipes auto-pick from status `style` (rise/orbit/spark/bubble/vortex/sleep).

## Apply path

```
Studio.applyStatus(id)
  → cast burst (chargeGlow shell ~0.4s)
  → StatusController.apply → StatusAura (shell + accents + ground rune)
  → HUD chips via status.views()
```

Element staffs still map to statuses (`arsenal/elements.ts`).

## Tunables (per `StatusDef`)

- `pattern` — force shader family  
- `expand` — metres outside surface (default **0.1**)  
- `shellOpacity` — peak alpha  
- `style` — accent recipe + particle motion  
