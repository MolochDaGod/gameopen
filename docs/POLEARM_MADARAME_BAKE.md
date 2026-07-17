# Polearm / 2H from Madarame bake

## Source

`content/source-anims/ikkaku_madarame.glb`  
(from Desktop `ikkaku_madarame.glb` — Bip001, 26 combat clips)

## Why this works

Madarame is **already Bip001** (Noesis `_N` suffixes). Retarget is **name normalize + rotation-only extract**, not a full Mixamo→Bip001 solve:

| Step | Action |
|------|--------|
| 1 | Parse GLB animations |
| 2 | Strip `_digits` → `Bip001 Pelvis` etc. |
| 3 | Keep core 22 bones (pelvis…toes, no fingers/face) |
| 4 | Quaternion tracks only (root XYZ stays on Controller) |
| 5 | Write `public/anims/baked/polearm/*.json` |

## Rebake

```bash
cd artifacts/animator
node scripts/bake-madarame-polearm.mjs
# optional override:
# set MADARAME_GLB=C:\path\to\ikkaku_madarame.glb
```

## Clip map (combat)

| Madarame | Polearm role | Use |
|----------|--------------|-----|
| attack1_1..5 | attack…attack5 | combo / multi-hit |
| skill1–4, skill6 | skill1…skill4, skill6 | hotbar weapon skills |
| bankai | special | ultimate |
| move | walk (+ run/sprint alias) | loco |
| idle | idle | idle |
| hit / die | hurt / death | react |

## Runtime wiring

- **Anim pack** `polearm` in `three/grudge/anims.ts`
- **Warrior** gear presets (all races) → `animPack: "polearm"`
- **`weaponSkillPacks`**: `SPEAR_SKILLS` + 2H `AXE_SKILLS` point at baked polearm JSON
- **`TwoHandGrip`**: post-mixer off-hand toward arsenal shaft for spear/greatsword/greataxe/hammer2h
- **Foot IK**: existing `FootGrounder` on GrudgeAvatar (unchanged)

## uMMORPG SPEAR skills (Danger execution)

Definitions: `master-weaponSkills.json` → `weaponTypes[SPEAR]`.  
Runtime: `three/ummorpg/spearCombat.ts` + multi-part `skillCombos` + `Studio` LMB.

### Madarame clip roles (author picks)

| Source | Role | Use |
|--------|------|-----|
| `attack1_1` | `attack` | Base jab |
| `attack1_2` | `attack2` | Second base |
| `attack1_4` | `attack4` | Combo drive-in **+MM** |
| `attack1_3` | `attack3` | True finisher |
| `attack1_5` | `attack5` | Lunge skill |
| `skill2_1` | `skill2` | Speed / blur / AoE ability |

### LMB combo (4 hits)
`attack` → `attack2` → `attack4`(+MM) → `attack3`

### Skill bar 1–4

| Slot | Skill | Clip | Motion |
|------|--------|------|--------|
| 1 | Spear Combo | multi-part 1_1…1_3 | chain |
| 2 | Piercing Lunge | `attack5` | **~3 m lunge** |
| 3 | Spear Rush | `skill2` | speed + blur + **AoE finisher** |
| 4 | Dragontail Sweep | `special` | ultimate AoE |

Charge stack: **telegraph** → **Controller.dash** → **afterimage/dashStreak** → delayed **blast** + slash VFX.  
Spear-in-hand: kit mesh + **TwoHandGrip** + foot IK.

## Danger Room test

1. Equip **spear** · combat mode  
2. **LMB** chain: jab → jab → drive-in(+MM) → finisher  
3. **2** Piercing Lunge · **3** Spear Rush (blur + AoE) · **4** Dragontail  
