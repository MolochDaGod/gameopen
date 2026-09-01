# Farm + rifle Mixamo FBX → Bip001 bake

## Answer

**Yes** — the untracked `public/anim/farming/*.fbx` and `public/anim/rifle/*.fbx` dumps are **source Mixamo clips** for production harvest/gun animation. They are **not** loaded raw in the browser for grudge6 play.

```
public/anim/{farming,rifle}/*.fbx     (Mixamo source — git source of truth)
        ↓  npm run bake  (artifacts/animator)
        node scripts/bake-gun-farm-loco.mjs
        ↓
public/anims/baked/{harvest,rifle}/*.json   (Bip001 rotation-only)
        ↓
weapon-live-packs.json + grudge/anims.ts roles
        ↓
Controller / harvest mode / rifle weapon pack at runtime
```

## Bake command

```bash
cd artifacts/animator
node scripts/bake-gun-farm-loco.mjs
# or from repo root if scripted:
# npm --prefix artifacts/animator run bake:gun-farm
```

Policy: Mixamo → **Bip001** rename · **rotation-only** · strip hip position (same as mobility bake).

## Packs

| Pack | Role |
|------|------|
| `anims/baked/rifle/*` | Gunner idle/walk/run/fire/reload/strafe/death |
| `anims/baked/harvest/*` | Plant/water/pick/pull + carry/box/wheelbarrow/milk |
| `anims/baked/reactions/*` | Shared death clips |
| `anims/baked/magic/*` | Magic loco from magic-loco FBX |

## Runtime wiring

- **Rifle weapons:** `content/anims/weapon-live-packs.json` → `rifle` liveRoles  
- **Harvest activity:** `grudge/anims.ts` TRAVERSAL / farm roles (`harvest`, `plant`, `carryWalk`, …)  
- **Never** point production loaders only at raw FBX for grudge6 kits  

## Do not

- Ship only FBX without baking  
- Invent a second harvest/rifle anim system  
- Treat these FBX as mesh props (they are **clips**, not farm props)
