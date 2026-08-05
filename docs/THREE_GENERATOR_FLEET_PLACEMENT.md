# three-generator → Grudge Studio fleet placement

**Role:** LAB only — AI/MCP level & prop generation.  
**Not:** Open / CastingAbilities / Warlords play host.  
**Repo:** `Flux159/three-generator` (local: `Documents/_forks/three-generator`)

## Ownership

| Concern | Owner |
|---------|--------|
| Generate / preview | three-generator lab |
| Bake | `grudge-convert` (ObjectStore) |
| Binary + index | R2 `assets.grudge-studio.com` + D1 |
| Scene edit | Forge `forge.grudge-studio.com` |
| Play combat / VFX | CastingAbilities, Open, Warlords |

## Pipeline (mandatory order)

```
1. Generate / drop raw GLB in uploads/
2. npm run fleet:convert -- raw.glb [--height 0.8]
3. npm run fleet:publish-r2          → R2 grudge-assets + CDN HEAD 200
4. npm run fleet:sync-casting        → CastingAbilities public fallback
5. POST /api/scenes  → gfscene-lite JSON + forgeDeepLink
6. Consumers: GET fleet catalog (CDN or lab /api/catalog)
```

### Live catalog (systems consume this)

```
https://assets.grudge-studio.com/catalogs/three-generator/fleet-catalog.json
```

Lab: `GET http://localhost:3000/api/catalog`  
Client helper: `shared/fleetAssetClient.ts` · CastingAbilities `src/assets/generatedCatalog.js`

## API (lab)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Lab identity + fleet pins |
| GET | `/api/generated-assets` | Lab registry list |
| POST | `/api/register-generated-asset` | Metadata + optional ObjectStore upload |
| POST | `/api/scenes` | Save `.gfscene.json` |
| GET | `/api/scenes/:id` | Load scene JSON |
| POST | `/api/scenes/from-demo` | Demo export |

### Register body

```json
{
  "filename": "rock_01.glb",
  "localPath": "uploads/baked/rock_01.glb",
  "category": "props/generated",
  "heightM": 0.8,
  "collider": "box",
  "tags": ["three-generator"]
}
```

Env for live upload: `OBJECTSTORE_API_URL`, `OBJECTSTORE_API_KEY`.

## Scene JSON (`gfscene-lite`)

See `shared/gfsceneTypes.ts`. Entities use **cdnUrl meshUrl** only after bake.

## Hard bans

- Prisma/SQLite as production asset SSOT  
- three &lt; 0.185 for new work  
- FlyControls as combat TPS  
- Raw Meshy/capsule as shipped fleet content  
- Merging this app into CastingAbilities as game shell  

## Related skills

`grudge-asset-convert` · `grudge-d1-r2` · `forge-editor` · `grudge-3d-game-packages` · `grudge-studio`
