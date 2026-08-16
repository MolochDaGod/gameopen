# Back slot prefab contract

The **Back slot is one equip**. The worn item *is* the effect (mobility / ocean / cloth / Toon extra).  
This is the same family as weapon prefabs (`WEAPON_PREFAB.md`) — not a second radial, not a second combat engine.

| Surface | Role |
|---------|------|
| **Author JSON** | `content/backs/*.json` + `content/items/itm_back_*.json` |
| **Catalog index** | `content/backs/catalog.json` |
| **Schema** | `content/schemas/back_def.schema.json` |
| **Runtime** | `artifacts/animator/src/three/equipment/backSlotItems.ts` |
| **Attach** | `WingBackRig` · `BackStowAttach` · `CapeBackRig` |
| **Effects** | `three/grudge/slotEffects.ts` (StatusFx auras / on-hit procs) |
| **Equip** | Paperdoll I · Hold **R** harvest wedge **Back** · `equip:back:*` mesh_ids |

Do **not** invent a second effect slot or new combat hotkeys. Use keys already on the controller.

---

## 1. Use kinds

| `useKind` | When it fires | Keys (existing) |
|-----------|---------------|-----------------|
| **passive** | While equipped. No extra press. | — |
| **hotkey** | Locomotion already owns the key. Item changes what Space does in air. | **Space** (jump / flap / glide) |
| **deploy** | Surface-gated vehicle. Stow on land; deploy on water. | **Space** on water · **E** get-off |

Combat **R** stays heavy. Combat **E** stays guard unless you are *on* a back vehicle (Casting windsurf get-off). Harvest **Hold R** only **equips / cycles** the Back wedge.

---

## 2. Prefab layers (identity → play)

| Layer | Owns | Ready when |
|-------|------|------------|
| **identity** | `bck_*` + `itm_back_*` + `runtimeId` (`back_*`) + `equip:back:*` | Stable ids |
| **use** | `useKind` · `useKey` · `useHint` | Matches this contract |
| **assets** | mesh / isolate / stow / deploy / author path | File on disk (ride/wings) or Toon child |
| **effects** | aura · onHit · bonuses (UI + StatusFx) | `slotEffects.ts` row |
| **runtime** | wing / stow / cape / Toon extra | One attach path |
| **loadout** | paperdoll Back · Hold R · mesh_ids | One item at a time |
| **icon** | R2 pack PNG (`icons/pack/…`) | HEAD 200 on `assets.grudge-studio.com` |
| **recipe** | `rcp_back_*` in `content/harvest/recipes.json` | Craft → `itm_back_*` unique bag row |

---

## 3. Spine (back, not weapon)

| Point | Role |
|-------|------|
| **stow** | Spine / quiver-parent attach (Casting `findBackBone`) |
| **deploy** | Vehicle / open-wing mesh when useKind is deploy or hotkey-in-air |

SI: holy wingspan ~2.0 m · traveler ~1.55–1.75 m · windsurf stow 0.58 m.

---

## 4. Gold packages

| Prefab | Use | Asset |
|--------|-----|-------|
| `bck_holy_wings` | hotkey Space | `models/ride/wings/holy_wings.glb` (author `wing_379_1781615558571.glb`) |
| `bck_traveler_wings` / `_t2` / `_t3` | hotkey Space | `traveler_wings_variants.glb` isolate T1–T3 |
| `bck_wind_surf` | deploy Space / E | stow `back_fly_windsurf.glb` · deploy `windsurf_package.glb` |
| `bck_shark_fin` | passive | `shark_fin.glb` |
| `bck_cape` / `_long` / `_wide` | passive | procedural Unity cape |

Full table: `content/backs/catalog.json`.

---

## 5. Production item process (same as weapons)

Do **not** invent a second bag, ledger, or kept 2×2 slot. Back is body `mesh_ids`.

| Step | System | What happens |
|------|--------|----------------|
| **Recipe** | Open harvest `rcp_back_*` in `content/harvest/recipes.json` | Inputs are stackable mats (account qty) |
| **Craft** | `craftRecipeAsync` → `grantUniqueToBag` | Unique `itm_back_*` instance. Signed-in: Railway `/api/uuid` + `/api/ledger`. Guest: provisional. **Never** the harvest qty map. |
| **Bag** | Character 3×3 | Ownership lives here. Not account vault. Not kept 2×2. |
| **Equip** | Bag RMB **Equip** → `equipBackFromBagWithLedger` | Item **stays** in 3×3. Ledger `EQUIPPED` slot **Back**. Appearance `equipment.back` + `model3d.meshIds`. |
| **Play** | `applyBackTemplateToMeshIds` → `setEquipmentMeshIds` | One `equip:back:*` tag. `Studio` attaches Wing/Stow/Cape. |
| **Hydrate** | `resolveCharacterEquipmentVisual` | Reads `equipment.back` / `model3d` and merges `equip:back:*` onto kit mesh_ids. |

Profession XP on Open harvest craft is still a remaining gap (no existing helper — do not invent). Paperdoll **I** cycle still does not persist appearance unless bag Equip is used.
