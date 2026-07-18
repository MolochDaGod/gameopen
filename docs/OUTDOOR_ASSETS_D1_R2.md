# Outdoor terrain & harvest assets — R2 + D1 (not git)

**Rule:** Large GLBs (islands, forest base, nature packs) live on **Cloudflare R2** and are indexed in **D1 `asset_registry`**. They do **not** belong in git.

**Git holds:** loaders (`ForestWorld.ts`, `SailEnvironment.ts`, `testWorlds.ts`), small JSON catalogs, upload/seed scripts.

Related: skill `grudge-d1-r2` · `grudge-warlords-assets` · [DANGER_ROOM_COMBAT_STACK.md](./DANGER_ROOM_COMBAT_STACK.md)

---

## Topology

| Layer | Where | Example |
| --- | --- | --- |
| Binary | R2 bucket `grudge-assets` | `models/worlds/sailtest.glb` |
| CDN | `https://assets.grudge-studio.com/<r2Key>` | same path |
| Registry | D1 `grudge-assets-db` → `asset_registry` | `grudge_uuid`, `r2_key`, `category` |
| Catalog (git) | `content/worlds/outdoor-asset-catalog.json` | human list of keys + roles |
| Runtime | `loadGltfFirst` → `assetCandidates` | same-origin optional → **CDN** |

`r2Key` **is** the public path (no `gameopen/` prefix) so fleet loaders resolve consistently.

---

## Pipeline (bake → upload → seed → verify)

```bash
# 0. Bake GLBs offline (grudge-asset-convert / local tools)
#    Place temporary copies under artifacts/animator/public/models/worlds/ for upload only

# 1. Upload to R2 (idempotent; needs R2_* env)
node scripts/upload-outdoor-r2.mjs --dry-run   # list local → keys
node scripts/upload-outdoor-r2.mjs             # real put

# 2. Seed D1 registry (deterministic UUID per r2Key)
node scripts/seed-outdoor-d1.mjs               # writes reports/outdoor-d1-seed.sql
node scripts/seed-outdoor-d1.mjs --apply       # wrangler d1 execute --remote

# 3. Verify CDN (magic/HTML check)
node scripts/verify-fleet-assets.mjs --cdn-only
```

Env for upload:

- `CLOUDFLARE_ACCOUNT_ID` or `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` (default `grudge-assets`)

---

## D1 best practices (fleet)

1. **Stable PK** — `grudge_uuid = sha1("grudge-asset:" + r2Key)` formatted as UUID (see `scripts/lib/assetUuid.mjs`).
2. **UNIQUE `r2_key`** — re-upload updates row, never duplicates.
3. **Batch ≤ 100** statements per `wrangler d1 execute`.
4. **Upsert** `ON CONFLICT(r2_key) DO UPDATE`.
5. **Metadata JSON** — `role`, `testWorldId`, `sourceSet: gameopen-outdoor` (query columns only for filters you need).
6. **Never autoincrement** for cross-service asset ids.
7. **Cache** CDN: immutable long max-age on versioned binaries.

---

## Runtime resolution (Open)

```
testWorlds.meshKeys / WARLORDS_NATURE
  → loadGltfFirst(key)
  → assetCandidates(key)
  → https://assets.grudge-studio.com/<key>
  → prepObjectMaterials (colour space / mips)
```

Local `public/models/worlds/*.glb` is **dev convenience only** (gitignored). Production must hit R2.

Nature packs (trees, rocks, flowers, ore) are the same Warlords stylized CDN paths — isolate **child meshes** in `ForestWorld`, never place the whole pack as one entity.

---

## Gitignore

```
# Heavy outdoor binaries — R2 only
artifacts/animator/public/models/worlds/*.glb
# Optional: keep catalog JSON tracked
```

Commit **source** (`ForestWorld.ts`, etc.) so Vercel **builds**; commit **not** 25–30 MB GLBs.

---

## npm scripts

| Script | Action |
| --- | --- |
| `assets:outdoor:upload` | `upload-outdoor-r2.mjs` |
| `assets:outdoor:seed-d1` | `seed-outdoor-d1.mjs` |
| `assets:outdoor:pipeline` | dry-run upload + SQL seed |
| `verify:assets:cdn` | existing fleet HEAD checks |

---

## What stays local vs edge

| Item | Git | R2/D1 |
| --- | --- | --- |
| `ForestWorld.ts` / `SailEnvironment.ts` / `testWorlds.ts` | ✅ | — |
| `outdoor-asset-catalog.json` | ✅ | — |
| `sailtest.glb` / `forest-map.glb` / `small_island.glb` | ❌ | ✅ |
| Nature stylized packs | ❌ (already CDN) | ✅ |
| Harvest **JSON** recipes/ops | ✅ small | optional ObjectStore mirror |
