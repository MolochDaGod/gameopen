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

## Danger Room controls

| Key | Action |
|-----|--------|
| WASD | Move |
| X | Dodge / roll (i-frames) |
| E | Block (stamina) |
| C | Parry |
| F / 1–4 | Weapon skills (MM lunges + VFX) |
| R | Heavy |
| LMB | Soft lock: **select** under aim · Hard FOCUS: **attack** combo |
| RMB | Sticky toggle hard FOCUS ↔ soft lock/select |
| F8 / `\` | Free mouse (OS cursor = aim; no pointer-lock) |
| F9 / `'` | Re-lock aim (pointer-lock + HUD crosshair) |
| ESC | Release pointer-lock (WASD stays; click canvas or F9 to re-lock) |

### Mouse / soft-lock best practices (SSOT)

| Mode | Cursor | Aim | LMB | RMB |
|------|--------|-----|-----|-----|
| **play-locked** | Hidden | HUD crosshair (NDC free-aim) | select or attack | toggle FOCUS |
| **play-free** (F8) | Custom free-aim OS cursor | Cursor position → ray | select or attack | toggle FOCUS |
| **ui** (panels) | UI arrow | n/a | UI | UI |

- Free-mouse does **not** fight a second HUD reticle (crosshair hidden while free).
- Unlocking does **not** clear WASD.
- Click-to-relock is **off** while free-mouse sticky is on (use F9).
- Anim packs bind **rotation-only** (position tracks stripped) so feet stay on the floor across all races.

## Mesh / anim correctness

| Issue | Fix |
|-------|-----|
| Feet under floor | `groundFeetLocal` + post-idle `reGroundAfterAnimSample`; never ground Avatar.holder |
| Mesh stretch | `stripPositionTracks` after Bip001 rematch |
| Anims dead / T-pose | `rematchClipToSkeleton` + pack clips for all races |
| First hero wrong scale | `ensureHumanScale` → `findDeployModel` then fit |

## Deploy note

Route aliases map `annihilate-demo` → Danger mode. With `?hero=` present, URL stays `/annihilate-demo` on mode sync. Edge proxy for `grudge-studio.com/annihilate-demo` should rewrite to this Open/gameopen SPA.

**Example:** `https://open.grudge-studio.com/annihilate-demo?hero=barbarian_ranger` → BRB longbow kit.

### Production asset rules (404 root cause)

| Asset class | Where | Notes |
|-------------|-------|--------|
| grudge6 race FBX | R2 `assets.grudge-studio.com/models/grudge6/races/*` | OK |
| Race atlases | R2 `textures/grudge6/*` | OK |
| Baked Bip001 JSON | **Same-origin** `/anims/baked/*` (Open ships these) | R2 path often 404 — prefer same-origin first |
| Mixamo `/anim/animations/**/*.fbx` | **Not on Vercel** (`.vercelignore` has `**/*.fbx`) and **not on R2** | One HEAD probe → pack marked missing → **zero** multi-host 404 fan-out |

**404 storm (fixed):** Explorer used to call `allReferencedClipIds()` (every weapon class) and `loadFbxFirst` across same-origin + R2 + gameopen.vercel.app for each clip. Now:

1. Single same-origin HEAD on `unarmed-idle-01.fbx`
2. If missing → procedural Mixamo skeleton + base GLB only; no Mixamo network
3. Runtime only preloads **equipped weapon + unarmed** (Editor may `preloadAll`)
