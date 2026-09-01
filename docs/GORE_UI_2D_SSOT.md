# 2D Gore UI — sprites · popups · combat layering

**Updated:** 2026-08-10  
**Source:** `C:\Users\nugye\Documents\ummorpgdev\assets\voxelhandoff\2D Gore UI (1).zip`  
**CDN root:** https://assets.grudge-studio.com/ui/gore/  
**Local:** `artifacts/animator/public/ui/gore/`

---

## Database / CDN status

| Query | Result |
|-------|--------|
| Prior D1/ObjectStore “gore UI” pack | **Not found** as a named catalog entry |
| Existing combat impact | Slash/Effect/Flow under `icons/pack/misc/*` (live) |
| This pack after organize+upload | **`ui/gore/*` on R2** — 24 PNGs + `manifest.json` (200) |

Not in Postgres player DB — **asset CDN only**.

---

## Pack contents (what it is)

This is a **horror UI skin pack** (gauges, buttons, decorative spine/rib frames) — not a full blood VFX atlas.

| Layer | Files | Role |
|-------|-------|------|
| **frames** | backbone, rib | Popup / panel chrome |
| **buttons** | flesh / zombie / backbone (+ pressed) | UI buttons |
| **gauges** | gore empty shells, flesh fills, zombie skin, stomach | HP / resource bars |

Typos fixed on organize: `Pressef` → `pressed`, `Rottent` → `rotten`.

---

## Layering model (combat)

```
[3D world]
  GoreImpact2D billboard  ← slash/effect CDN (energy + blood tint)
[CSS2D overlays]
  .gxo-blood              ← radial + optional gauge fleck
  .gxo-float kind-damage  ← popup number (+ optional --gxo-gore-frame)
[HUD]
  .gxo-gore-gauge         ← empty under fill (HP %)
```

| System | File |
|--------|------|
| Catalog | `lib/goreUiCatalog.ts` |
| Impact billboards | `three/fx/goreImpact2d.ts` |
| Popup numbers | `HtmlOverlaySystem.floatDamage` |
| CSS | `three/overlays/htmlOverlay.css` |
| Zone policy | `docs/ZONES_INAPP_PLAY.md` |

---

## Usage (code)

```ts
import { applyGoreUiTheme, goreUiUrl, GORE_UI_GAUGES } from "@/lib/goreUiCatalog";

// Theme damage floats + blood on overlay root
applyGoreUiTheme(overlayRoot, "gore"); // flesh | zombie | backbone | gore

// Manual bar:
// background empty: goreUiUrl(GORE_UI_GAUGES.empty[0])
// fill: goreUiUrl(GORE_UI_GAUGES.fleshFull[0]) with width % HP
```

CDN absolute: `goreUiUrl("frames/rib.png", { cdn: true })`.

---

## Smoke

```
HEAD https://assets.grudge-studio.com/ui/gore/manifest.json     → 200
HEAD https://assets.grudge-studio.com/ui/gore/frames/rib.png    → 200
HEAD https://assets.grudge-studio.com/ui/gore/gauges/gore01_empty.png → 200
```
