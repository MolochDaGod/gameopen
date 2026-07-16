# Character avatars, portraits & media SSOT

**Product:** Open library / account / campfire / combat need **accurate** 2D faces for each fleet character.  
**DB:** GrudgeBuilder Railway Postgres (`characters`, `accounts`, `races`) — not D1, not local-only.

Related: production-wiring skill · [OPEN_PRODUCT.md](./OPEN_PRODUCT.md) · `lib/characterPortrait.ts`

---

## 1. What lives where

| Concern | Authority | Client use |
|---------|-----------|------------|
| Character row (id, race, class, level, equipment) | **Railway** `characters` | `GET /api/characters?era=warlords` |
| Custom 2D portrait | `characters.avatar_url` | Prefer over type PNG |
| 3D modular look | `characters.model_3d` | Danger Room / grudge6 meshes |
| Open-only prefs | `saveData.open` / config | avatarId, voxel head URL, loadout |
| Account profile pic | `accounts.avatar_url` | FleetBar / social only — **not** hero portrait |
| Race definition art | `races.portrait_path` + ObjectStore | Catalog / create UI |
| Type PNGs (per model) | Open `public/races/*.png` (+ optional `races/portraits/{race}_{class}.png`) | Fallback when no DB avatar |
| Voxel head art | `public/races/voxel-head.png` or stored head snapshot URL | Voxel / cube-head characters only |
| Binary 3D / VFX / icons | **R2** `assets.grudge-studio.com` | Never invent parallel CDNs |
| Definitions (items, skills) | ObjectStore JSON | Icons via `iconUrl` / registry |

---

## 2. Portrait resolution cascade (Open)

Implemented in `artifacts/animator/src/lib/characterPortrait.ts`:

```
1. characters.avatarUrl          (Railway SSOT if set)
2. saveData.open / config override  (portraitUrl, avatarImage, …)
3. IF voxel/cube-head character:
     voxelHeadUrl / races/voxel-head.png / avatar/voxel-head.png
   ELSE:
     races/portraits/{race}_{class}.png  →  races/{race}_{class}.png
4. races/{race}.png               (shipped: human, orc, elf, dwarf, barbarian, undead)
5. assets.grudge-studio.com sprites/portraits (optional CDN)
6. races/human.png                (hard default)
```

UI: `<CharacterAvatar character={ch} />` — always use this, not hard-coded race paths.

---

## 3. GrudaChain / Railway character fields (best practice)

| Column | Use for portraits / 3D |
|--------|------------------------|
| `id` (UUID) | Primary key everywhere |
| `race_id` / `class_id` | Type PNG + grudge6 preset resolve |
| `avatar_url` | **Custom** 2D face (studio render, AI, user upload) — HTTPS or same-origin path |
| `model_3d.renderPipeline` | `grudge6` \| `vrm` \| `sprite2d` / voxel → portrait branch |
| `model_3d.baseModelId` | Race kit key (WK_/ELF_/…) for meshes |
| `equipment` + mesh_ids | Equipment panel / 3D only |
| `save_data.open` | Open loadout, avatarId, voxel head snapshot URL |

**Do:**
- Store permanent portrait URLs on **CDN or Railway-backed storage**, then set `avatar_url`.
- Keep **account** avatar separate from **character** portrait.
- Set `renderPipeline` / Open flags so voxel heroes never pull warlords race PNG as “their face” when a voxel head exists.

**Don’t:**
- Use account bag or D1 as character SSOT.
- Point `avatar_url` at ephemeral blob: without upload pipeline.
- Use AI portrait alone without race/class type fallback when generation fails.
- Mix Warlords race id namespaces without aliases (`human` ↔ `western-kingdoms`).

---

## 4. PNG layout (add art here)

| Path | Meaning |
|------|---------|
| `public/races/human.png` … `undead.png` | Race kit portraits (exists) |
| `public/races/portraits/{race}_{class}.png` | **Preferred** per model type (knight, mage, ranger, warrior) |
| `public/races/voxel-head.png` | Default voxel / cube-head avatar image |
| `public/avatar/` | Avatar editor GLBs / optional head stills |

Class stems match grudge presets: `knight` · `mage` · `ranger` · `warrior` · `unarmed`.  
Race stems: `human` · `orc` · `elf` · `dwarf` · `barbarian` · `undead`.

Example: Western Kingdoms knight → `races/portraits/human_knight.png`.

---

## 5. Models, effects, equipment (related but separate)

| Media | Resolver |
|-------|----------|
| 3D body | `resolveRaceModel` → `grudge:{race}:{preset}` / grudge6 FBX |
| Equipment meshes | `characterEquipmentMesh` from Railway equipment + mesh_ids |
| Icons | ObjectStore / R2 `icons/*` via `iconUrlFromItem` |
| VFX | Studio Vfx + CDN models/vfx — not portrait pipeline |
| Anim packs | `/anim/*` or `/anims/baked/*` |

Portrait wrong ≠ mesh wrong; fix each layer with its SSOT.

---

## 6. API connections (Open)

```
Browser open.grudge-studio.com
  GET /api/characters?era=warlords   → Railway Postgres
  maps: id, name, raceId, classId, level, avatarUrl, model3d, config, saveData, equipment
  CharacterAvatar → resolveCharacterPortrait(ch)
```

Auth: Grudge ID JWT on same-origin `/api/*` (see production-wiring).

---

## 7. Smoke

1. Sign in → roster shows **race PNG** at minimum.  
2. Character with `avatarUrl` → custom image, not race default.  
3. Voxel / cube-head character → **voxel-head** art (or stored head URL), not wrong grudge6 race.  
4. Create flow race grid still uses `RacePortraitGrid` type art.  
5. Danger Room body still uses `resolveRaceModel` + equipment meshes.

---

## 8. Shipping type PNGs (content checklist)

```
[ ] Export PNG per race×class model you care about
[ ] Place under public/races/portraits/{race}_{class}.png
[ ] Optional: voxel-head.png for cube avatars
[ ] For custom heroes: PATCH character avatarUrl to CDN URL
[ ] Never overwrite Railway avatarUrl with a wrong race default client-side
```
