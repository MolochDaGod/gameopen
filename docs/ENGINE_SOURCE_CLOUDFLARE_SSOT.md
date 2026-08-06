# enginesource (PlayCanvas) · assets · Cloudflare — verified SSOT

**Repo:** https://github.com/MolochDaGod/enginesource  
**Local:** `F:\GitHub\enginesource`  
**What it is:** MIT fork of [playcanvas/engine](https://github.com/playcanvas/engine) (`playcanvas` 2.22.x-beta) — WebGL2 / WebGPU / WebXR / glTF runtime + examples + script packs.

**Fleet production 3D SSOT remains:** `three` ^0.185 + Rapier (`grudge-3d-game-packages`).  
This doc verifies **what enginesource contains**, **how assets should be used**, and **how helpers map to Cloudflare deploy** — without inventing a second production renderer.

| Related fleet SSOT |
|--------------------|
| Packages: skill `grudge-3d-game-packages` |
| Assets CDN: skill `grudge-d1-r2` · `assets.grudge-studio.com` |
| Convert/bake: skill `grudge-asset-convert` |
| Bag/camp/lockpick: [LOCATION_INVENTORY_LOCKPICK_SSOT.md](./LOCATION_INVENTORY_LOCKPICK_SSOT.md) |

---

## 1. Docs verification (enginesource)

| Claim | Verified |
|-------|----------|
| PlayCanvas / WebGL2 + WebGPU engine | Yes — root `README.md` |
| Fork of playcanvas/engine | Yes — GitHub `forked from playcanvas/engine` |
| npm name `playcanvas`, multi-export builds (prod/debug/profiler, ESM+UMD) | Yes — `package.json` exports |
| Agent rules: perf-critical, dual backends, destroy(), no new core deps lightly | Yes — `AGENTS.md` |
| Assets pipeline: glTF 2.0 + Draco + Basis | Yes — README Features |
| Physics demos: **ammo.js** (not Rapier) | Yes — `examples/assets/wasm/ammo/` |
| ESM game helpers ship **beside** engine, not in core bundle | Yes — `scripts/esm/README.md` |
| Example assets are lab fixtures (GLB, KTX2, Basis, HDR, splat) | Yes — `examples/assets/**` |

**Upstream docs (authoritative for PlayCanvas APIs):**

- Manual: https://developer.playcanvas.com/user-manual/engine/  
- API: https://api.playcanvas.com/engine/  
- Examples: https://playcanvas.com/examples/  

**Grudge gap:** enginesource docs do **not** mention Cloudflare, R2, or fleet auth — those stay fleet skills above.

---

## 2. Asset inventory (what to use where)

### A. Lab-only (enginesource tree — do not ship as Warlords heroes)

| Path | Types | Use |
|------|-------|-----|
| `examples/assets/models/` | glTF/GLB, Draco samples, PBR tests | Look-dev, transmission/anisotropy tests |
| `examples/assets/textures/` | JPG/PNG/WebP, **.basis**, KTX2 | Codec smoke (Basis/KTX2) |
| `examples/assets/cubemaps/`, `hdri/` | DDS, KTX2, HDR, env atlas | IBL / sky experiments |
| `examples/assets/splats/` | `.sog`, `.spz`, compressed PLY, WebP LODs | Gaussian splat lab (PlayCanvas strength) |
| `examples/assets/animations/` | bitmoji/playbot clips | Animation stream demos |
| `examples/assets/wasm/` | ammo, basis, draco, glslang, twgsl, zstd | Optional WASM workers for PC loaders |

### B. Game helpers (scripts — patterns, not fleet deps)

| Pack | Path | Best fleet use |
|------|------|----------------|
| Cameras | `scripts/camera/*.js` | Reference for orbit/fly/follow (port ideas → three TPC) |
| Controllers | `scripts/esm/first-person-controller.mjs`, `third-person-controller.mjs` | Compare SI locomotion; **do not** dual-stack with Rapier CCT |
| Post FX | `scripts/posteffects/*.js` | Bloom/SSAO/FXAA/outline → port to three post stack |
| GSplat | `scripts/esm/gsplat/*`, `streamed-gsplat.mjs` | **Best PlayCanvas product surface** (lab host) |
| XR | `scripts/esm/xr/*` | XR booth / gallery satellite |
| Water / sky | `water.mjs`, `sky/procedural-sky.mjs` | Visual reference only |
| Physics | `scripts/physics/*` + ammo WASM | **Not** fleet physics — Rapier owns Open/Mine |

### C. Production fleet assets (Cloudflare — always)

| Type | SSOT | Host |
|------|------|------|
| GLB / textures / audio | R2 `grudge-assets` | `https://assets.grudge-studio.com/{key}` |
| Index / search | D1 asset registry | ObjectStore / asset-api |
| Player bag / camp / island | Railway Postgres | **Not** D1 |
| grudge6 race kits | Convert → R2; load rules per `grudge-warlords-assets` | CDN |
| Baked anims | Prefer same-origin or CDN keys | Open/Mine |

**Do not** upload enginesource example GLBs as production heroes.  
**Do** mirror **formats** they prove work well on the edge: **glTF/GLB, Draco, Basis/KTX2, WebP**.

---

## 3. Best asset usage with Cloudflare

### Pipeline (verified fleet law)

```
Author / bake (grudge-asset-convert)
    → production GLB (+ WebP/KTX2 when supported)
    → R2 put grudge-assets/<key>  (wrangler / upload scripts)
    → D1 index (optional, ObjectStore)
    → CDN GET https://assets.grudge-studio.com/<key>
    → Client: three OR PlayCanvas lab loader
```

| Practice | enginesource teaches | Cloudflare apply |
|----------|----------------------|------------------|
| Stream glTF | Engine asset system | Range GETs + immutable cache on R2 CDN Worker |
| Draco mesh | `heart_draco.glb`, wasm/draco | Ship Draco wasm on CDN; same-origin or assets host |
| Basis/KTX2 textures | `*.basis`, `*.ktx2` | Prefer KTX2/WebP on R2; long `Cache-Control: immutable` for versioned keys |
| Env atlases | cubemaps, HDR | Compress HDR→env atlas offline; CDN serve |
| Splat LODs | `splats/playbot/lod-meta.json` + WebP | R2 keys per LOD; Worker cache |
| WASM helpers | basis/draco/ammo | Host under `assets.grudge-studio.com/wasm/...` **or** same-origin; CORS already on CDN Worker |

### Cache / CORS (fleet CDN Worker)

- **Versioned keys** (`…/v1/…` or content-hash): `immutable, max-age=31536000`  
- **Mutable keys**: shorter TTL  
- **HEAD** + ETag for idempotent re-upload  
- **MIME** map for `.glb`, `.wasm`, `.ktx2`, `.basis`, video  

Skill: `grudge-d1-r2` (Workers: `grudge-asset-cdn` / r2-cdn).

### What not to put on R2 from enginesource

- Full `examples/` multi‑hundred MB splat/demo tree as “production content”  
- ammo.js next to Rapier in the same playable body  
- Unlicensed third-party demo models without credit files (many have `.txt` credits — keep credits if reusing)

---

## 4. Game helpers × Cloudflare deploy matrix

| Helper class | enginesource | Deploy on Cloudflare | Pair with Grudge |
|--------------|--------------|----------------------|------------------|
| **Engine lab SPA** | `npm run build` + examples Vite | Pages / Worker static + assets from R2 | New host e.g. `engine-lab.*` — not Open |
| **GSplat viewer** | `scripts/esm/gsplat/*` + splat assets on R2 | Worker SPA + CDN splats | Product: product booth / map preview |
| **XR gallery** | `scripts/esm/xr/*` + `vr-gallery.glb` pattern | HTTPS-only CF host | Optional satellite |
| **Post FX demo** | `scripts/posteffects/*` | Static Pages | Port formulas into three post |
| **Open / Mine / Foundry** | — | Vercel SPA + CF edge proxy + R2 assets | **three + Rapier only** |

### Cloudflare topology (fleet)

```
Browser
  ├─ open.grudge-studio.com / mineloader.*   (game SPA — three)
  ├─ assets.grudge-studio.com               (R2 CDN Worker)
  ├─ id.grudge-studio.com                   (auth — not engine)
  └─ optional: engine-lab.grudge-studio.com (PlayCanvas lab SPA)
```

Player state never goes to R2/D1 as SSOT — Railway only (`grudge-production-wiring`).

---

## 5. Recommended “best use” (priority)

1. **Reference lab** — cameras, post FX, glTF codecs, WebGPU smoke (`F:\GitHub\enginesource`).  
2. **Asset format QA** — validate KTX2/Basis/Draco paths before baking fleet packs.  
3. **Optional PlayCanvas product** — Gaussian splat / XR gallery on CF Pages + R2.  
4. **Build flavor pattern** — prod/debug/profiler ESM+UMD as model for `@grudge-studio/*` CDN builds.  
5. **Never** replace fleet three/Rapier SSOT with PlayCanvas/ammo for Open Danger, Mine-Loader, Foundry, warcamp.

---

## 6. Quick commands

```bash
# Lab build
cd F:\GitHub\enginesource
npm install
npm run build

# Fleet asset upload pattern (example — real scripts in GrudgeBuilder)
# npx wrangler r2 object put grudge-assets/models/lab/<file>.glb --file=... --remote
# HEAD https://assets.grudge-studio.com/models/lab/<file>.glb
```

---

## 7. Doc checklist (agents)

- [x] enginesource = PlayCanvas fork, not fleet renderer SSOT  
- [x] Assets for production = R2 + `assets.grudge-studio.com`  
- [x] Helpers = `scripts/` + `scripts/esm/` (import path docs verified)  
- [x] Physics demo stack (ammo) ≠ fleet Rapier  
- [x] Cloudflare: CDN Worker + optional lab SPA; player data on Railway  

When in doubt: **load `grudge-d1-r2` + `grudge-3d-game-packages` first**, use enginesource as lab/reference only.
