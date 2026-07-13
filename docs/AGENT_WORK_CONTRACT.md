# Agent work contract (Open / fleet)

## Why this exists

Past sessions cut corners: remapped **Voxel Velocity** (`racer`) to Danger Room,
self-looped GRUDOX deep-links to `open.grudge-studio.com`, and shipped half
systems instead of finishing the path already on **grudox.grudge-studio.com**.

## Rules

1. **Finish existing SSOT first** — search GRUDOX arcade, arena, Warlords, D1
   before inventing a substitute mode.
2. **Do not rebrand one game as another** — Voxel Velocity ≠ Danger Room.
3. **Hosts**
   | Host | Owns |
   |------|------|
   | `grudox.grudge-studio.com` | Voxel Arcade (`/arcade/play/*`), Carrier, VoxGrudge shell |
   | `open.grudge-studio.com` | Grudge Open hub (gameopen) — Danger Room, brawl native, dressing |
   | Edge Worker `gameopen-open-proxy` | open → gameopen, **except** `/arcade/*` → grudox |
4. **Cabinets**
   - `racer` → Voxel Velocity on GRUDOX arcade
   - `zombie`, `z-brawl` → GRUDOX arcade
   - `brawler` → Open native **or** GRUDOX
   - `explorer` → Danger Room (Open)
5. **Before “done”**: name the real host URL you smoke-tested; if you remapped
   a cabinet, say what you overrode and why.
6. **Track work**: todo list + this file when ownership rules change.

## Smoke after arcade changes

```
https://grudox.grudge-studio.com/arcade/play/racer
https://open.grudge-studio.com/arcade/play/racer   # must end up on GRUDOX Velocity
```
