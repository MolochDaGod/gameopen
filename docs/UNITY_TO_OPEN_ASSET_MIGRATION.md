# Unity race prefabs → Open / Danger Room migration review

**Scope:** Same Toon RTS / grudge6 race player kits used in Unity-era Warlords work, what already runs in Open/Danger, and what to migrate for **hands, special armor, back items, harvest + weapon-skill anims, textures**, and extra Unity assets.

**SSOT lineage:** Unity Toon RTS “customizable” race kits → FBX on R2 → Open `GrudgeAvatar` / `gearPresets` / Bip001 anim packs.  
**Not** classic one-file `Player.prefab` YAML as runtime truth.

---

## 1. What “Unity race prefabs” are in this fleet

| Unity-era concept | Production reality (web) |
|-------------------|---------------------------|
| Race player prefab | **One modular kit FBX per race** with all armor/weapon variants as **child meshes** |
| Equip armor set | **Show/hide** named meshes (`mesh_ids` / `visibleMeshes`), not swap whole prefab |
| Weapon in hand | Mesh under **`R_hand_container` / `L_hand_container` / `L_shield_container`** (or Bip001 hands) |
| Back / quiver / bag | **`Xtra_quiver`**, bag/wood meshes; bones `Quiver_container`, `Bone_bag`, `Bone_wood` |
| Animation controller | **Anim pack by weapon class** on same Bip001 (not per-race) |
| Materials | **One race atlas** (WebP) rebinding all kit meshes |

### Local Unity/export source (this machine)

| Path | Contents |
|------|----------|
| `C:\Users\nugye\Documents\fbxtoon_rts\toon_rts\` | Race FBX: `WK_`, `BRB_`, `DWF_`, `ORC_`, `UD_Characters.fbx` (+ basic `anims/*.fbx`) |
| CDN | `https://assets.grudge-studio.com/models/grudge6/races/{WK\|BRB\|ELF\|DWF\|ORC\|UD}_Characters.fbx` |
| Per-piece library | `…/races/library/{raceId}/library.json` + `{MeshName}.glb` (e.g. human = **42** meshes) |
| Open gear table | `artifacts/animator/src/three/grudge/gearPresets.ts` |
| Equip / bones | `grudge/skeleton.ts` `findHandBone`, `loadCharacter.ts` equip filter |

---

## 2. Bone attach map (Unity → Open)

| Role | Unity / kit name | Open runtime resolve |
|------|------------------|----------------------|
| Main hand | `R_hand_container`, `Bip001 R Hand` | `findHandBone(root, "R")` |
| Off hand / shield | `L_hand_container`, `L_shield_container` | `findHandBone(root, "L")` |
| Quiver / back utility | `Quiver_container`, `*_Xtra_quiver` mesh | Visibility on kit + spine parent |
| Bag / wood carry | `Bone_bag`, `Bone_wood`, bag/wood meshes | Utility group (can co-exist) |
| Armor body | Skinned body/arms/legs/head/shoulders | Exclusive slot visibility |
| Hips / ground | `Bip001` / pelvis | Box3 feet ground, height ≈ **1.8 m** |

**Coordinate note:** Unity LH → Three RH when exporting fresh GLB; many race FBXs already match fleet loaders — do **not** double-flip.

---

## 3. Back items & special armor (what Unity kit already has)

### Back / utility (in-kit meshes — **already migratable by visibility**)

**Human library (`library/human`, 42 meshes) — utility/back group:**

| Mesh | Role |
|------|------|
| `WK_Xtra_quiver` | Back quiver (ranger) |
| `WK_Xtra_bag` | Carry bag |
| `WK_Xtra_wood` | Wood / resource carry |

Same pattern per race: `{PREFIX}_Xtra_quiver` / bag / wood (naming varies slightly, e.g. `UD_Xtra_Quiver`).

From Open gear presets (all 6 races, **ranger** class) quiver is already listed, e.g.:

| Race | Back mesh id |
|------|----------------|
| WK | `WK_Xtra_quiver` |
| BRB | `BRB_Xtra_quiver` |
| ELF | `ELF_Xtra_quiver` |
| ORC | `ORC_Xtra_quiver` |
| UD | `UD_Xtra_Quiver` |
| DWF | `DWF_Xtra_quiver` |

**Status in Open:** gear presets toggle quiver for ranger; bag/wood exist in kit but are under-used in presets.

**Gap:** design `armor.json` “cloak/cape” back slot is icon-only; true capes may be Unity extras outside the modular kit.

### Special / full armor (in-kit variants)

| Class preset | Armor style | Example meshes (WK) |
|--------------|-------------|---------------------|
| **Knight** | Full plate (head_F / Body_E / Arms_D / Legs_C / shoulderpads) | “special” heavy set letters E–F |
| **Warrior** | Chain / mid plate | Body_C, Arms_B, axe |
| **Ranger** | Leather | Body_B + bow + quiver |
| **Mage** | Cloth robe | Body_A + staff |
| **Unarmed** | Light cloth | No weapon |

**Special armor rule:** still **child meshes of race kit**, not separate Meshy hero bodies.  
**Meshy** (Danger AI): allowed **only closed armor equipment with zero skin** — optional *additional* standalone pieces, not race kit replacement.

### Hands weapons (in-kit + separate Open GLBs)

**Inside race kit (Unity-style):**  
`*_weapon_sword_*`, `*_weapon_Bow`, `*_weapon_axe_*`, `*_weapon_staff_*`, `*_weapon_spear`, `*_weapon_hammer_*`, `*_weapon_pick`, shields `*_Shield_*`.

**Separate Open hand props** (Danger arsenal / `models/weapons/*.glb`): sword, dagger, greatsword, axe, spear, staff, bow, hammer, mace, shield, guns, canes… (see `HAND_ARMOR_BACK_ASSET_REVIEW.md`).

Human library sample categories (42 pieces): weapons, shields, body/head/arms/legs/shoulders, pick, etc. — same modular idea as Unity customizable unit.

---

## 4. Animations: weapon skills vs harvest

### Weapon skills (combat packs)

| Pack | Use | Unity-era source |
|------|-----|------------------|
| `sword_shield` | 1H + shield | Toon RTS + Explosive / fleet bake |
| `longbow` | Bow + quiver | longbow motion packs |
| `magic` | Staff | magic motion |
| `polearm` / `2h_melee` | Axe/hammer/spear | heavy melee |
| `unarmed` | Fist | striker / unarmed |

Open: `content/skills/*.json` (**71** skill prefabs), `weaponSkillPacks.ts` (MM lunge fields), `content/anims/database.json` packs.

**Migration:** keep exporting Bip001 FBX clips → bake JSON under `/anims/baked/{pack}/` (same-origin preferred; raw CDN bake often 404).

### Harvest (Unity tools → Open ops)

| Harvest op (`content/harvest/operations.json`) | Tool | Unity mesh analog |
|------------------------------------------------|------|-------------------|
| gather / forage | hand | unarmed |
| mine | **pick** | `*_weapon_pick` in kit |
| chop | **axe** | `*_weapon_axe_*` |
| dig | shovel | separate prop if not in kit |
| skin | knife | dagger stand-in |
| fish | rod | extra asset |
| farm | hoe | extra asset |

**Anim DB:** pack id **`harvest`** exists in `content/anims/database.json` (~31 harvest-related references).  
**Gap:** clip-level harvest names are thin in the index — need full chop/mine/gather one-shots from Unity tool anim sets if not already under that pack.

---

## 5. Textures

| Asset | Path pattern | Three.js rules |
|-------|--------------|----------------|
| Race atlas | `assets/{western-kingdoms\|barbarians\|…}/textures/*.webp` | `SRGBColorSpace`, **`flipY=false`**, ClampToEdge |
| Weapon GLB materials | baked in GLB | SI scale only; no character height bake |
| Skill icons | `icons/pack/weapons/*.png` | CDN remap in `skillIcons.ts` |

**Migration from Unity:** export atlas to WebP; never leave PSD embeds unresolved (use `applyRaceAtlas` / TextureManager pattern from character-select).

---

## 6. What already works in Open / Danger (no re-export needed)

1. Load race **FBX kit** from CDN.  
2. Apply **gear preset** → visibility list (including **quiver** + **special plate** letter variants).  
3. Attach arsenal weapon GLB to **hand containers** when not using in-kit weapon mesh.  
4. Play **weapon-class anim packs** + skill one-shots.  
5. Harvest **mode + ops table** + pick/axe tools as data.  
6. Shared **GLTF/FBX loaders** + fleet path resolver.

---

## 7. Priority migration backlog (Unity → Open)

| P | Item | Source | Open action |
|---|------|--------|-------------|
| **P0** | Ensure **quiver** + bag/wood visibility on all races when ranger/pick | Kit mesh names | QA gear presets; toggle `Xtra_quiver` / bag |
| **P0** | **Harvest clips** chop/mine/gather on Bip001 | Unity tool anims / pack `harvest` | Bake → `anims/baked/harvest/` + wire one-shots |
| **P1** | **Cape/cloak** back meshes if present in Unity extras | Prefabs not in modular kit | Export GLB, bind spine, add to gear presets |
| **P1** | **Special armor sets** beyond 5 presets | Extra Unity variants A–N | Map to `visibleMeshes` / D1 mesh_ids |
| **P1** | **Pick** as first-class harvest tool mesh | Kit `*_weapon_pick` | Equip exclusive + harvest anim |
| **P2** | Mounts / siege (cavalry, catapult) | Toon RTS Fab packs | `grudge6-toon-rts-mounts-siege` skill |
| **P2** | Nature / props from Unity scenes | Island/prefab packs | Convert → R2; not character kit |
| **P2** | Crossbow / scythe dedicated meshes | Unity or craft | Replace spear/rifle stand-ins |

### Export pipeline (when leaving Unity)

```
Unity prefab / kit
  → GLB or keep FBX (races: FBX still SSOT)
  → grudge-convert (scale SI; weapons: NO height normalize)
  → R2 assets.grudge-studio.com
  → D1 meshes / gear_presets OR Open gearPresets.ts
  → Danger/Open equip smoke
```

Coordinate convert: see `unity-to-threejs-cloudflare` + `grudge-asset-convert`.

---

## 8. Anti-patterns (do not migrate as-is)

- Whole-body **Meshy** character as race replacement  
- Separate skinned “armor suit” that fights the modular kit  
- Parenting quiver to **hand**  
- Height-normalizing weapons to 1.7 m  
- Assuming Mixamo bone names on grudge6 kits  
- Committing multi-MB Unity Library; only exported FBX/GLB + WebP  

---

## 9. Cross-links

| Doc / code | Use |
|------------|-----|
| `docs/HAND_ARMOR_BACK_ASSET_REVIEW.md` | Icon catalogs + Open weapon GLB inventory |
| `docs/UNITY_WEAPON_SKILLS_TOME_MIGRATION.md` | Skills, magic anims, tome effects |
| `docs/CANONICAL_COMBAT.md` | Fleet CombatController |
| `docs/DANGER_ROOM_SSOT.md` | Danger loaders/deps/env |
| `docs/MESHY_ARMOR_ONLY.md` | Extra closed armor gen only |
| `artifacts/animator/src/three/grudge/gearPresets.ts` | Race class prefabs |
| `grudge6-modular-characters` skill | Equip + bones + packs |
| `unity-to-threejs-cloudflare` skill | Scene/prefab export path |

---

## 10. Systems migration (combat · skills · camera · controller)

**Policy:** Unity special weapon skills, weapons, effects/projectiles, attacks, combat, camera, and controller **can be migrated and edited** into Open fleet systems when they improve quality. Prefer editing SSOT over forking.

| Unity system | Open target |
|--------------|-------------|
| Weapon skill tree / ScriptableSkill | ObjectStore master + `content/skills` + `FleetWeaponSkill` |
| Skill animations | Anim packs (`magic`, `sword_shield`, …) + one-shots |
| Tome / wand page effects | Prefab VFX + catalog effect ids + orbs/beams |
| Combat controller | `@workspace/epicfight` `CombatController` |
| TPS camera / controller | `Controller` + `@workspace/grudge-physics` camera profiles |

**Deep dive:** `docs/UNITY_WEAPON_SKILLS_TOME_MIGRATION.md` (skills · magic anims · tome FX).

---

## 11. Bottom line

Your **Unity race “prefabs” are already the grudge6 modular kits**: full plate, leather, cloth, weapons, shields, and **quivers** live as **named meshes + Bip001 sockets**. Open/Danger consume that via **visibility + anim packs**, not YAML prefabs.

**Back:** quiver is the main Unity story and is already in gear presets — cloaks/capes are the empty gap.  
**Special armor:** plate letter variants (knight) are already special sets inside the kit.  
**Harvest:** ops + pick/axe tools are defined; **migrate/bake harvest anim clips** is the main Unity leftover.  
**Weapons:** in-kit meshes for RTS combat + separate `models/weapons/*.glb` for arsenal/Danger.  
**Skills / tome:** master catalog imported; **tome pages** remapped to fire/frost/holy VFX + fleet shape — **magic cast bake** still P1.

Next concrete work: (1) harvest pack bake + bind, (2) **magic/cast + magicArea bake** for tome/wand, (3) cape/back GLB if Unity has them outside the kit, (4) D1 mesh_ids parity for special armor letters.
