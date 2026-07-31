# Fleet editors & Create UI

## Roles (SSOT)

| Surface | URL | Role |
|---------|-----|------|
| **Open** | https://open.grudge-studio.com | Game **library** + **GRUDOX voxel launcher host** (in-app canvas / zones / Realms). Auth, characters, saves. |
| **GRUDOX** | https://grudox.grudge-studio.com *(and Open `/zones`, arcade)* | Voxel multiverse playables — launched **from Open**, not a separate product silo. |
| **Forge** | https://forge.grudge-studio.com | **3D game development + deploy** (R3F scene, AI tools, publish). |
| **UI Studio** | https://ui.grudge-studio.com | **HUD, menus, settings, kits, craftpix assets, game-ui packs** for **all** editors and games. |

```
                    ┌─────────────────────────┐
                    │  ui.grudge-studio.com    │
                    │  Create UI · packs · AI  │
                    └───────────┬─────────────┘
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
     open.grudge…      forge.grudge…       fleet games
     Library + GRUDOX  3D develop/deploy   Warlords, etc.
```

---

## Create UI entry points

| Host | How |
|------|-----|
| **Open** | Library card **Create UI** · path `/ui` · shell menu **Create → Create UI** · Toolbox **Create UI** |
| **Forge** | Menubar **Create → Create UI…** · Tools → **Create UI (HUD / menus)…** · AI tools `list_ui_kits` / `apply_ui_kit` |
| **Direct** | https://ui.grudge-studio.com/studio · `/games` packs · `/assets` |

Embed (Open iframe):

```
https://ui.grudge-studio.com/studio?embed=1&from=open&pack=open&return=https://open.grudge-studio.com/
```

Forge pop-out:

```
https://ui.grudge-studio.com/studio?from=forge&pack=forge
```

---

## AI wiring assist

- **Open Create UI rail:** “AI · wire to game assets” → `ai.grudge-studio.com` + offline checklist (Railway stats, CDN icons, ObjectStore skills).
- **Forge AI Worker:** existing UI kit tools (`list_ui_kits`, `browse_ui_kit`, `apply_ui_kit`, `list_ui_assets`) stamp `Environment.uiKit` for PlayHUD.
- **UI hub:** `/api/ai/*` rewrites on ui.grudge-studio.com (see grudge-ui-editor `docs/UI_API_ARCHITECTURE.md`).

Pack load in any game client:

```js
const ui = await GrudgeGameUI.load("grudox"); // or open, forge, warlords, …
ui.mount(document.getElementById("hud"));
ui.setState("combat");
```

Runtime: `https://ui.grudge-studio.com/game-ui-runtime.js`  
Catalog: `https://ui.grudge-studio.com/game-ui-packs/index.json`  
Textures: `https://ui.grudge-studio.com/assets/craftpix/**` (+ CDN `assets.grudge-studio.com/ui/…`).

---

## Open product map (related create tools)

| Mode | Path | Purpose |
|------|------|---------|
| Create UI | `/ui` | HYDRA embed + pack AI wire |
| Avatar | `/avatar` | Voxel cube head |
| Anim Creator | `/anim` | Pose timeline |
| AI Animator | `/anim-ai` | Chat → motion (anim-ai-worker) |
| Worldbuilder | `/voxel` | Voxel maps |
| Dressing Room | `/dressing` | Character equip |

Do **not** treat GRUDOX as a second library — it is the voxel **play** surface under Open.
