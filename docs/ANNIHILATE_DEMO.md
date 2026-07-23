# Annihilate demo — grudge6 + Danger Room

**Live:** `https://grudge-studio.com/annihilate-demo?hero=elf_worge`  
**Also:** `https://open.grudge-studio.com/annihilate-demo?hero=…` · gameopen `/annihilate-demo`

## What you get

| Layer | System |
|-------|--------|
| **Mesh** | grudge6 race kit (FBX) — ELF / WK / BRB / ORC / UD / DWF |
| **Skeleton** | **Bip001** + hand sockets (`R_hand_container`, `Bip001 R Hand`) |
| **Anims** | Baked Bip001 packs + **Mixamo library retarget** onto Bip001 (`retargetMap`) |
| **Weapons** | Arsenal / kit mesh_ids; skills from `weaponSkillPacks` |
| **Combat shell** | **Danger Room** (Controller, X dodge, E block, C parry, F/1–4 skills, MM lunges, VFX) |

## Hero query

```
?hero=<race>_<class>
```

| Example | Studio avatar | Pack | mesh_ids | Weapon |
|---------|---------------|------|----------|--------|
| `elf_worge` | `grudge:high-elves:unarmed` | unarmed | ELF cloth set | none (striker) |
| `wk_warrior` | `grudge:western-kingdoms:warrior` | polearm | WK chain + axe | axe |
| `wk_knight` | `grudge:western-kingdoms:knight` | sword_shield | WK plate + sword | sword |
| `orc_ranger` | `grudge:orcs:ranger` | longbow | ORC leather + bow | bow |
| `ud_mage` | `grudge:undead:mage` | magic | UD robe + staff | staffArcane |

Parser: `src/lib/annihilateHero.ts` — **must** use `grudge:race:preset` (not bare race slug).

## Hand bones (weapon mount)

Resolve order (`findHandBone` / `resolveSkeletonSockets`):

1. `R_hand_container` / `L_hand_container` / `L_shield_container`
2. `Bip001 R Hand` / `Bip001_R_Hand` (spaces or underscores)
3. Mixamo `mixamorigRightHand` / `RightHand`
4. Fuzzy hand/wrist (fingers excluded)

## Bip001 ↔ Mixamo retarget

`src/three/retargetMap.ts` → `canonicalSuffix("Bip001 R Hand") === "RightHand"`  
`buildRetargetNameMap` produces target→`mixamorig*` for `SkeletonUtils.retargetClip`.  
Containers are **not** retarget targets (weapons attach as children).

## Danger Room controls (unchanged)

| Key | Action |
|-----|--------|
| WASD | Move |
| X | Dodge / roll (i-frames) |
| E | Block (stamina) |
| C | Parry |
| F / 1–4 | Weapon skills (MM lunges + VFX) |
| R | Heavy |
| LMB | Attack combo |
| RMB | Lock focus |

## Deploy note

Route aliases map `annihilate-demo` → Danger mode. With `?hero=` present, URL stays `/annihilate-demo` on mode sync. Edge proxy for `grudge-studio.com/annihilate-demo` should rewrite to this Open/gameopen SPA.
