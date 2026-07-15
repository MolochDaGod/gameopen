# Grudge Open — systems, slugs, practices

**Live:** https://open.grudge-studio.com  
**Alias:** https://gameopen.vercel.app  
**Source:** `artifacts/animator` · routing SSOT: `src/lib/openRoutes.ts`

---

## 1. What this product is

| Layer | Responsibility |
|-------|----------------|
| **Hub (`/`)** | Door select — pick a surface |
| **Combat labs** | Danger Room, mimic, map playtest; **Warlord Genesis** → external warlord-genesis.vercel.app |
| **Create** | Voxel map editor (`/voxel` premade Danger Rooms), dressing room — **promote worlds to Mine-Loader** |
| **Multiplayer** | Lobby rooms, Ruins Brawler, VoxGrudge world |
| **Tools** | LED mask, GRUDOX zone launcher |
| **Fleet** | Grudge ID JWT · Railway characters (`era=warlords`) · ObjectStore defs · R2 assets |

This is **not** Character Studio (GCS) and **not** Warlords `/home` lobby. It is the **combat / sandbox / studio hub**.

---

## 2. URL slug map (canonical)

| Path | Mode | Notes |
|------|------|--------|
| `/` `/hub` `/doors` | doors | Hub |
| `/danger` `/combat` `/sandbox` | danger | Danger Room |
| `/play` | play | Authored map → combat |
| `/genesis` | genesis | Warlord Genesis MOBA/RTS handoff (fleet SSO + characterId) |
| `/brawl` `/ruins` | brawl | Ruins Brawler |
| `/survival` `/agama` | survival | **Agama Survival** — wave survival on `models/agama-map.glb` (from `D:\Games\Models\agamemap.glb`) |
| `/mimic` `/dungeon` | mimic | Mimic encounter |
| `/voxel` `/build` | voxel | Voxel map editor |
| `/world` `/voxgrudge` | voxgrudge-native | Open voxel world |
| `/dressing` `/editor` | editor | Dressing room |
| `/lobby` `/rooms` | lobby | Multiplayer lobby |
| `/zones` `/grudox` | zones | GRUDOX zone list |
| `/ledmask` | ledmask | LED face tool |
| `/arcade/play/<id>` | **GRUDOX Voxel Arcade** | Owned by `grudox.grudge-studio.com` (not gameopen). `racer` = **Voxel Velocity** (real street racer). Edge: open Worker proxies `/arcade/*` → GRUDOX. SPA also hard-redirects arcade-only cabinets. Native Open only: `brawler`, `voxgrudge`, `explorer`→danger. |

### Agama Survival (map source)

| Item | Value |
|------|--------|
| Live path | https://open.grudge-studio.com/survival |
| Host game | Ruins Brawler engine (`BrawlerScene` + `ThreeBrawler variant="survival"`) |
| Author source | `D:\Games\Models\agamemap.glb` (~221 MB raw) |
| Production GLB | `public/models/agama-map.glb` (~15 MB meshopt) |
| Bake | `gltf-transform optimize --texture-size 1024` |

**Combat stack (Danger Room parity)** — both `/brawl` and `/survival`:

| Layer | Source |
|-------|--------|
| Character | Fleet Railway character → `grudge:race:preset` (`GrudgeAvatar` + baked Bip001 anims) |
| Loadout | `saveData.open` + equipment bag (`characterLoadout` / `fleetCharacter`) |
| Weapons | Arsenal `WEAPONS` + `mountWeaponModel` (same as Studio) |
| Skills | T0 weapon kits (`t0WeaponSkills`) · HUD icons via `skillIcons` |
| Content | Soft-load `/api/content/{weapons,skills,items}` + ObjectStore `master-weaponSkills.json` |
| Controls | Danger Room `InputState` + `Controller` · 1–4 skills · `[` `]` weapon cycle · RMB focus |

Query overrides (legacy): `?door=<mode>` · `?mode=<cabinetId>`.

**Practice:** mode changes **pushState** to the path; browser back/forward restores mode.

---

## 3. Game system patterns

### 3.1 Mode switch (engine)

```
URL / hub click → navigate(mode) → App.tsx mounts Studio | VoxelEditor | Brawler | …
```

- One **mode** at a time; leave multiplayer rooms when leaving danger.
- Do not remount unrelated engines; each mode owns its `useEffect` mount.

### 3.2 Identity & characters

| Concern | SSOT |
|---------|------|
| Login | `id.grudge-studio.com` → JWT (`sso_token`) |
| Heroes | Railway `GET /api/characters?era=warlords` |
| Active UUID | `gameSession` + fleet keys |
| Create hero | **GCS** `character.grudge-studio.com?era=warlords` — not Open |

Guest play is allowed offline; **roster features** require Grudge ID.

### 3.3 Content & assets

| Type | Where |
|------|--------|
| Weapon / skill defs | `content/` + Railway `/api/content/*` + ObjectStore master-weaponSkills |
| Skill **HUD icons** | R2 `assets.grudge-studio.com/icons/pack/*` via `skillIcons.ts` · local `/icons/*` fallback |
| Heavy GLB / anim packs | R2 or `/models` `/anim` (pruned on deploy) |
| Room posters | `/rooms/*-scene.png` |
| **Voxel blocks / scenes** | `@workspace/voxel-canonical` · [VOXEL_CANONICAL.md](./VOXEL_CANONICAL.md) · Codex https://mine-loader.vercel.app/#/defs · `GET /api/blocks` |
| **Danger Room deep dive** | [DANGER_ROOM.md](./DANGER_ROOM.md) — combat MM/block/parry, AI tools, deploy smoke |

### 3.4 Multiplayer

| Surface | Transport |
|---------|-----------|
| Danger coop rooms | DangerClient / carrier room API |
| Ruins Brawler | `/api/brawl` → GRUDOX room server |
| VoxGrudge | open-world / space APIs |

---

## 4. Practices (do / don’t)

| Do | Don’t |
|----|--------|
| Add a surface in `OPEN_SURFACES` + DoorSelect + App mode branch | Hardcode only `?door=` links |
| Use `pathForMode` / `navigate` for all UI entry | Invent a second router without URL sync |
| Proxy characters via `vercel.json` → Railway | Store heroes only in localStorage |
| Keep arcade map for GRUDOX | Break `/arcade/play/*` without a redirect |
| Document new slug in this file | Ship a mode with no path |

---

## 5. Adding a new surface (checklist)

1. Add `AppMode` union + branch in `App.tsx`.
2. Add `OpenSurface` row in `openRoutes.ts` (slug, aliases, group, poster).
3. Wire `DoorSelect` (auto if using `hubDoorSurfaces()`).
4. Ensure SPA rewrite covers path (`vercel.json` catch-all already does).
5. Update this doc’s slug table.
6. Smoke: hard load `https://open.grudge-studio.com/<slug>` and browser back to hub.

---

## 6. Related fleet surfaces

| Host | Role vs Open |
|------|----------------|
| grudgewarlords.com | Full Warlords MMO shell |
| character.grudge-studio.com | Create/edit heroes (GCS) |
| grudge-crafting.puter.site | Crafting / professions |
| grudox.grudge-studio.com | Arcade launcher → often deep-links into Open |
