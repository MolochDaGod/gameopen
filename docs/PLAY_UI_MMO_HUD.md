# Play UI — MMO HUD + shell (Open)

Production UI for **https://open.grudge-studio.com** games / play.

## What replaced the Steam trash chrome

| Surface | Before | After (threejs-rapier SSOT) |
|---------|--------|------------------------------|
| Library hub (`DoorSelect`) | Blue Steam clone | **MMO UI 4** fantasy shell (`mmoShell.css`) |
| Combat play HUD | Craftpix flat / mixed | **HUD Tight** from `hud-tight-bar.png` (HUD.psd) |
| Harvest / build | Craftpix part3 | Unchanged (part3) |
| Windows / panels | Flat CSS | MMO Window + craftpix `c_full` frames |

## Art sources

| Asset | Path | Origin |
|-------|------|--------|
| HUD Tight bar | `public/hud-tight-bar.png` | HUD.psd export (threejs-rapier) |
| MMO UI 4 slices | `public/ui/mmo-ui-4/**` | craftpix-net-699601 RPG & MMO pack (Textures only) |
| PSD masters (author) | zip `PSD Files/RPG & MMO 5 - HUD.psd` | not shipped |
| Craftpix windows | `public/ui/craftpix/windows/*` | 896711 window-PSD family |
| Kenney Mobile Controls 1 | `public/ui/kenney/mobile-controls-1/**` + CDN `ui/kenney/mobile-controls-1/` | CC0 pads/nubs/icons — skins `TouchControls` |

Runtime path helpers: `src/lib/mmoUi.ts` (`MMO`, `HUD_ART`, `CRAFTPIX_WIN`).

## Defaults

- `hudConfig.layout = "tight"`
- `hudConfig.theme = "rpg"`
- Storage key: `animator.hud.editor.v2` (resets old classic localStorage)

Toggle in **HUD Studio** (Edit HUD → Layout): Tight vs Classic.

## Game flow

1. Landing → cinema → characters (campfire) → **Library** (MMO shell)
2. Library **Play flow** rail: Danger Room · Lobby · Characters · Zones · featured title
3. Enter Danger/Play → **HUD Tight** bar (HP/SP orbs, 6+6 slots, avatar arch)

## Commands

```bash
# unit
cd artifacts/animator && npx vitest run src/hud

# local play
npm run dev
# → /danger or /hub
```
