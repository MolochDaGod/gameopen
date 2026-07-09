# GameOpen ↔ Forge scenes

Open any GameOpen scene in **[Studio Forge](https://forge.grudge-studio.com)** with AI + inspector, or play the live client at **[gameopen.vercel.app](https://gameopen.vercel.app/)**.

## Format

Scenes are Forge **SceneData** JSON (same as `*.gfscene.json`):

```json
{ "entities": [ ... ], "environment": { ... } }
```

Schema: Grudge-Studio-Forge `@workspace/scene-schema`.

## Build

```bash
pnpm scenes:build
# → content/scenes/*.gfscene.json
# → content/scenes/index.json
```

## Deep links (edit + AI)

After Railway deploys the API with `content/scenes`:

| Scene | Forge (editable) |
|-------|------------------|
| Weapon Lab | `https://forge.grudge-studio.com/editor?scene=https://gameopen-production.up.railway.app/api/content/scenes/weapon-lab&edit=1` |
| Combat Sandbox | `https://forge.grudge-studio.com/editor?scene=https://gameopen-production.up.railway.app/api/content/scenes/combat-sandbox&edit=1` |
| Catalog Plaza | `https://forge.grudge-studio.com/editor?scene=https://gameopen-production.up.railway.app/api/content/scenes/catalog-plaza&edit=1` |

- **`?edit=1`** — load into the editor **without** auto-play (inspect, AI tools, transform gizmos).
- Omit `edit` — auto-enters play mode (demo / share link).

List all scenes: `GET /api/content/scenes`

## Workflow

1. Author weapons/skills under `content/` (`pnpm readiness:weapons`).
2. `pnpm scenes:build` — pedestals/dummies pull from weapon + skill JSON.
3. Open Forge link → AI: *“equip slash trail for sword.slash”* / rearrange / add scripts.
4. Export / save project in Forge; keep GameOpen as playable combat client.

## GitHub raw fallback

Until Railway is updated:

```
https://raw.githubusercontent.com/MolochDaGod/gameopen/<branch>/content/scenes/weapon-lab.gfscene.json
```

Forge: `?scene=<that-url>&edit=1`
