# VFX fleet migration — puter · Danger Room · Open

## Correct live URLs

| URL | Status | Role |
|-----|--------|------|
| **https://vfxgrudge.puter.site/** | ✅ 200 | Fantasy VFX panel (hotkeys V B F G T C …) |
| **https://vfx.grudge.studio/** | ✅ 200 | Full VFX Studio (library, skillswrite, export) |
| **https://vfx-grudge.puter.site/** | ✅ 200 | Redirect → vfxgrudge (alias fixed 2026-07-29) |
| https://grudge-vfx-studio.pages.dev/ | ✅ | CF Pages mirror |
| **https://grudge-vfx.puter.site/** | ❌ **404** | Subdomain never existed; Puter CLI create is buggy (`undefined.puter.site`) |

**Use `vfxgrudge` or `vfx-grudge` (redirect).** Not `grudge-vfx` until created in Puter web UI.  
Redirect source: `Documents/grudge-vfx-studio/puter-redirect/`.

Local SSOT: `C:\Users\nugye\Documents\grudge-vfx-studio`  
Open catalog: `artifacts/animator/src/three/fx/vfxEffectCatalog.ts`  
Open deploy: `artifacts/animator/src/three/fx/vfxSandboxHotkeys.ts`  
Danger Room: **Alt+** hotkeys → `Studio.deploySandboxHotkeyVfx`

---

## Console spam: chrome-extension://…/inpage.js

```
chrome-extension://egjidjbpglichdcondbcbdnbeeppgdph/inpage.js
```

This is **Trust Wallet (or similar crypto wallet) injected script**, **not** Grudge VFX code.

| Fact | Detail |
|------|--------|
| Source | Browser extension content script on every page |
| Site fault? | **No** — appears even when the site is fine |
| Fix | Disable the extension on puter.site, or ignore those ERROR lines |
| How to verify | Open DevTools → Sources → filter `egjidjbp` / open Incognito without extensions |

If the **page itself** is blank on `grudge-vfx.puter.site`, that is a **404** (wrong name). Open **https://vfxgrudge.puter.site/** instead.

---

## What was migrated into Open / Danger

### Catalog (effect ids)

skillswrite spells + panel effects + production orbs/glyphs live in `vfxEffectCatalog.ts`.

### Alt+hotkeys (Danger Room)

Primary: **Alt+V B F G T C Space**  
Extended: **Alt+O I J D N Y E Q R H K**

### Tome / wand

`magicCombat` + glyph telegraphs via `sandboxEffectForMagicSkill`.

### Production GLB layer

`server/src/routes/effects.ts` + `models/vfx/**` — never whole `fireball.glb` as projectile.

---

## Agent rules

1. Prefer `vfxEffectCatalog` + `deploySandboxVfx` over new one-off particle code.  
2. Bind weapon skills with `effectId` / `castEffectId` → `resolveVfxEffectId`.  
3. Never load whole `fireball.glb` as a projectile — use `orb-fire` / `orb_fire`.  
4. Link designers to **vfxgrudge.puter.site** or **vfx.grudge.studio**.  
5. Wallet extension errors → not a deploy blocker.

---

## Related

- `docs/BEST_SYSTEMS_FOR_NEW_GAME.md`
- skill `grudge-vfx-hotkeys`
- skill `grudge-vfx-orbs-strike`
