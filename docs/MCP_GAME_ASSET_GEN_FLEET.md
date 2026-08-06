# mcp-game-asset-gen → Grudge fleet (LAB only)

**Package:** `mcp-game-asset-gen` ^0.1.0 (npm)  
**Role:** MCP **dev tool** for image / texture / 3D generation APIs  
**Not:** Open / Warlords / Danger runtime dependency  

Related three.js **lab** host: `Documents/_forks/three-generator` (Flux159) — same pipeline after bake.

## Install (this monorepo)

```bash
# gameopen root — already pin as devDependency
npm i -D mcp-game-asset-gen
```

Run MCP (stdio):

```bash
npx mcp-asset-gen
# or: npm run mcp:asset-gen
```

Env keys (local only — never commit):

| Var | Provider |
|-----|----------|
| `OPENAI_API_KEY` | DALL-E images |
| `GEMINI_API_KEY` | Gemini image / sheets |
| `FAL_AI_API_KEY` | FAL Trellis / Hunyuan3D / Qwen |

Optional tool filter: `ALLOWED_TOOLS=image_to_3d,generate_texture,...`

## Fleet pipeline (mandatory)

```
1. MCP generate  →  raw PNG / GLB in lab uploads/  (mcp-game-asset-gen)
2. three-generator fleet:convert  →  SI bake + collider  (grudge-convert skill)
3. fleet:publish-r2              →  assets.grudge-studio.com  HEAD 200
4. fleet catalog update          →  catalogs/three-generator/fleet-catalog.json
5. Open / Forge / Casting        →  fetchGeneratedCatalog() CDN only
```

**Hard ban:** ship raw Meshy / unbaked Hunyuan as production heroes.  
**Hard ban:** `import "mcp-game-asset-gen"` inside `artifacts/animator` SPA bundle.

## Open stack import (production)

| Surface | Path |
|---------|------|
| Catalog client | `artifacts/animator/src/three/assets/generatedFleetCatalog.ts` |
| Live catalog | `https://assets.grudge-studio.com/catalogs/three-generator/fleet-catalog.json` |
| Placement SSOT | `docs/THREE_GENERATOR_FLEET_PLACEMENT.md` |
| Package matrix | `docs/OPEN_PACKAGE_SSOT.md` § lab tools |

```ts
import {
  fetchGeneratedCatalog,
  findAssetByName,
} from "./three/assets/generatedFleetCatalog";

const cat = await fetchGeneratedCatalog();
const horse = findAssetByName(cat, "horse");
// horse.meshUrl → GLTFLoader (three ^0.185) — SI heightM when present
```

## High-quality Three.js systems (what we **do** use)

Use fleet pins from `OPEN_PACKAGE_SSOT` — do not replace with lab toys:

| Need | Stack |
|------|--------|
| Scene / mixer | `three` ^0.185 |
| Physics | `@dimforge/rapier3d-compat` + `@workspace/grudge-physics` |
| Mesh ground | `three-mesh-bvh` |
| Nav / AI | `three-pathfinding`, `yuka` |
| Combat skills | `skillPackForWeaponId` + Studio / epicfight |
| Post | `postprocessing` |
| Generated props | **CDN catalog** above only |

three-generator **FlyControls**, Prisma SQLite registry, and R3F demo cubes are **lab preview only** — never combat TPS / bag SSOT.

## Grok / Cursor MCP snippet

```json
{
  "mcpServers": {
    "game-asset-gen": {
      "command": "npx",
      "args": ["mcp-asset-gen"],
      "env": {
        "FAL_AI_API_KEY": "${FAL_AI_API_KEY}",
        "GEMINI_API_KEY": "${GEMINI_API_KEY}"
      }
    }
  }
}
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run mcp:asset-gen` | Start MCP stdio server |
| `npm run smoke:prod:open` | Live Open SPA smoke |
| three-generator `fleet:convert` / `fleet:publish-r2` | Bake + R2 |
