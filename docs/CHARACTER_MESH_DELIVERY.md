# Character mesh delivery — industry standards (Cloudflare R2)

**Canonical CDN:** `https://assets.grudge-studio.com` (R2 → `grudge-asset-cdn` Worker)  
**Player characters:** Railway Postgres (`characters`) → race/class/equipment → mesh join  
**2D portraits:** separate pipeline — [CHARACTER_AVATARS.md](./CHARACTER_AVATARS.md)

This document is the **SSOT for how Open loads real character looks** (mesh + atlas + skeleton + anims). Skills: `grudge6-modular-characters`, `grudge-warlords-assets`, `grudge-d1-r2`, `grudge-asset-convert`.

---

## 1. Where the character **image** (2D) comes from

| UI | Source |
|----|--------|
| Account roster / CharacterPicker | `resolveCharacterPortrait` → `characters.avatar_url` **or** `public/races/{race}.png` |
| Race create grid | `public/races/{human,orc,elf,dwarf,barbarian,undead}.png` |
| Voxel / cube-head heroes | `races/voxel-head.png` or `saveData.open` head URL |

**These PNGs are not the 3D mesh.** They are catalog faces for Steam-like UI.  
3D bodies never load from PNG.

---

## 2. Where the **3D mesh** comes from (production)

| Priority | URL / path | Role |
|----------|------------|------|
| **1 FBX SSOT** | `assets.grudge-studio.com/models/grudge6/races/{WK\|BRB\|ELF\|DWF\|ORC\|UD}_Characters.fbx` | Correct UVs for Toon RTS atlas |
| **2 Arena GLB** | `grudge-arena…/cdn/assets/characters/{human\|…}/WK_Characters.glb` (proxied as `/cdn/assets/characters/…` on Open) | Skinned combat fallback |
| **3 R2 GLB** | `assets…/models/grudge6/races/*.glb` | Deploy target when FBX fails |
| **Banned** | Meshy / capsules / random AI heroes | Never ship as final look |

**Textures (body atlas):**

| Race | CDN key (verified image/webp) |
|------|--------------------------------|
| western-kingdoms | `/textures/grudge6/western-kingdoms/WK_Standard_Units.webp` |
| barbarians | `/textures/grudge6/barbarians/BRB_StandardUnits_texture.webp` |
| dwarves | `/textures/grudge6/dwarves/DWF_Standard_Units.webp` |
| high-elves | `/textures/grudge6/elves/ELF_HighElves_Texture.webp` |
| orcs | `/textures/grudge6/orcs/ORC_StandardUnits.webp` |
| undead | `/textures/grudge6/undead/UD_Standard_Units.webp` |

Also mirrored under `/assets/{race}/textures/…`. Open rewrites `/textures/grudge6/*` → R2.

**Animations (Bip001 baked JSON):**

| Host | Status |
|------|--------|
| `grudge-arena…/anims/baked/**` | Full combat packs (sword_shield, magic, longbow, …) |
| Open `/anims/baked/*` rewrite → arena | Preferred same-origin |
| R2 `assets…/anims/baked/**` | Partial (e.g. locomotion present; not all packs) |

Code: `loadBakedClip` tries R2 candidates then **arena origin**.

---

## 3. Industry standards for mesh delivery (Cloudflare)

### 3.1 Binary storage (R2)
1. **One immutable object per path** — `r2Key` = public relative path (`models/grudge6/races/WK_Characters.fbx`).  
2. **Correct Content-Type** — FBX `application/octet-stream`, GLB `model/gltf-binary`, webp `image/webp`, JSON `application/json`.  
3. **Cache** — long `Cache-Control` + ETag; bust by path version (`/v2/…`) not query-only.  
4. **CORS** — CDN Worker allows `GET/HEAD` from `*.grudge-studio.com`, `*.vercel.app`.  
5. **No HTML 200s** — loaders **HEAD + content-type** (and magic bytes) before parse.

### 3.2 Runtime load contract (Three.js)
```
resolve raceId/classId from Railway character
  → RACE_ASSETS.modelUrl (FBX absolute CDN)
  → multi-host candidates (same-origin rewrite → R2 → arena)
  → FBXLoader / GLTFLoader
  → unify Bip001 skeletons
  → rebind race atlas (sRGB, flipY=false, ClampToEdge, MeshStandard)
  → apply gear visibility (fuzzy mesh_ids / class preset)
  → load baked Bip001 clips for weapon anim_pack
  → AnimationMixer on kit root
```

### 3.3 Skeleton & equipment
- **Skeleton:** Bip001 (not Mixamo) for grudge6 kits.  
- **Equipment:** child-mesh **visibility**, never replace body GLB.  
- **Hands:** `R_hand_container` / `L_hand_container` (or Bip001 hands).  
- **Height:** ~1.8 m via `fitCharacterHeight` (no 100× skinned AABB bug).

### 3.4 Character row → mesh join
```
Railway characters.race_id / class_id / model_3d / equipment
  → resolveRaceModel → grudge:{race}:{preset}
  → optional mesh_ids from equipment / gear_presets
  → loadGrudge6CombatRig(race, preset, { meshIds, rebindAtlas: true })
```

---

## 4. Open code map

| Module | Responsibility |
|--------|----------------|
| `three/grudge/raceAssets.ts` | CDN FBX + atlas URLs |
| `three/grudge/loadCharacter.ts` | FBX load, normalize, **fuzzy equip**, atlas bind |
| `three/grudge/texture.ts` | Atlas load multi-host + HTML reject |
| `three/grudge/grudge6Runtime.ts` | Combat rig: mesh + atlas + anim packs |
| `three/grudge/GrudgeAvatar.ts` | Studio avatar (primary production path) |
| `three/grudge/anims.ts` | Baked Bip001 JSON clips |
| `three/fleetAssetResolver.ts` | Same-origin / Open / R2 / arena candidates |
| `lib/characterPortrait.ts` | **2D only** — not 3D |
| `lib/characterEquipmentMesh.ts` | mesh_ids from account equipment |

---

## 5. Verified production probes (2026-07)

| Asset | Result |
|-------|--------|
| R2 WK FBX | 200 octet-stream |
| R2 WK GLB | 200 model/gltf-binary |
| R2 WK atlas webp | 200 image/webp |
| Open proxy texture | 200 (~4.5 MB webp) |
| Open proxy arena GLB | 200 |
| Open race PNG human | 200 (~190 KB) |
| Arena sword_shield idle JSON | 200 |
| R2 sword_shield idle | 404 (use arena / Open rewrite) |

---

## 6. Agent checklist (before “characters look right”)

- [ ] Portrait UI uses `CharacterAvatar` / `resolveCharacterPortrait`  
- [ ] 3D load uses **grudge6 FBX or arena GLB**, not Meshy  
- [ ] Atlas rebind after load (`rebindAtlas: true`)  
- [ ] Gear via **fuzzy** mesh_ids / class preset (not exact name only)  
- [ ] Idle/walk/run/attack clips load (arena anim proxy OK)  
- [ ] No permanent capsule; log + retry alternate host on fail  
- [ ] Magic-byte / content-type gates reject HTML  

---

## 7. If looks are wrong — triage

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Wrong face in UI | Portrait cascade | Check `avatarUrl` vs race PNG |
| Pink / untextured 3D | Atlas miss or flipY | `loadBodyTexture` multi-host; flipY false |
| All armor layers visible | Exact-name equip | Use `applyGearPreset` fuzzy keys |
| T-pose forever | Anim pack 404 | Open `/anims/baked` → arena rewrite |
| Giant / tiny hero | Height fit | `fitCharacterHeight` + skinned measure |
| HTML in loader | CDN key empty | Re-upload R2; never parse as mesh |
