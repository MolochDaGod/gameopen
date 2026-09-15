# AGENTS.md — Grudge Open (gameopen)

**Live:** https://open.grudge-studio.com  
**Repo role:** Danger Room combat sandbox, Open hub SPA, fleet handoff host  
**Workspace root MUST be:** `C:\Users\nugye\Documents\gameopen`  
(Do **not** open `C:\Program Files\Microsoft Visual Studio\...` as the project — home rules load, but this `AGENTS.md` will not.)

Global owner rules: `~/.grok/rules/`. Session protocol skill: **`work-with-nugye`**.

---

## 0. Session start (do this first)

1. Confirm CWD / workspace is **this repo** (`gameopen`).  
2. Load **`work-with-nugye`** (owner protocol).  
3. Load **`grudge-studio`** umbrella, then task leaf.  
4. Name the **one SSOT** you will extend — no parallel systems.  
5. If something fails later: **tighten this file or `~/.grok/rules/*`**, do not invent a new stack.

---

## 1. Load order (mandatory)

| Step | Skill / doc |
|------|-------------|
| 0 | **`work-with-nugye`** session protocol |
| 1 | `grudge-studio` umbrella |
| 2 | `grudge-live-servers` (Open host / deploy map) |
| 3 | Task leaf: grudge6 / combat / packages / assets |
| 4 | `docs/OPEN_PACKAGE_SSOT.md` before any new npm or 3D stack fork |
| 5 | `docs/AGENT_WORK_CONTRACT.md` for host ownership |

Do **not** invent a second Open, second Danger Room, or second character pipeline.

---

## 2. Code map (extend these)

| Concern | Path |
|---------|------|
| Game loop / maps | `artifacts/animator/src/three/Studio.ts` |
| Play controller + camera | `artifacts/animator/src/three/Controller.ts` |
| grudge6 avatar | `artifacts/animator/src/three/grudge/*` |
| Character deploy / feet | `artifacts/animator/src/three/characterDeploy.ts` |
| Foot IK | `artifacts/animator/src/three/anim/legIk.ts` + `terrainFootSample.ts` |
| Fleet anim roles | `artifacts/animator/src/three/fleetAvatarHydrate.ts` |
| Melee residual slash | `artifacts/animator/src/three/combat/meleeStrikeFx.ts` |
| Weapon skills | `lib/epicfight` + `arsenal/*` |
| Physics KCC | `lib/grudge-physics` |
| Outdoor maps | `artifacts/animator/src/three/ForestWorld.ts` + `maps/*` |
| Mesh packs (isolate, not fuse) | `src/three/packs/openMeshPacks.ts` + `docs/OPEN_MESH_PACKS.md` · camp placeables · `DungeonMaps` |
| Package pin | `artifacts/animator/package.json` + `docs/OPEN_PACKAGE_SSOT.md` |
| **Entry catch / anti-loop** | `artifacts/animator/src/lib/entryCatch.ts` + `docs/ENTRY_CATCH_SSOT.md` |
| **Production pattern** (auth/AI/CDN/campfire) | `artifacts/animator/src/lib/productionSystemsPattern.ts` + `docs/PRODUCTION_SYSTEMS_PATTERN.md` |
| JWT reader | `readProductionAuthToken()` — Open key `grudge.open.token` first |
| Campfire roster | `/characters` · `/lobby` → `CampfireLobbyScene` (TVS CDN props) |
| AI hub client | `artifacts/animator/src/ai/aiGateway.ts` → same JWT reader |
| **Weapon prefab** (combat mesh sockets) | `content/docs/WEAPON_PREFAB.md` · `arsenal/weaponPrefabSpine.ts` |
| **Back slot prefab** (one equip = effect) | `content/docs/BACK_SLOT_PREFAB.md` · `content/backs/` · `backSlotItems.ts` |
| Prefab spine points | cast · barrel · blade · blunt · tip · special · physics · effect |
| Prefab UUID graph | `docs/WEAPON_PREFAB_UUID_SSOT.md` |
| **Casting play bind** | `Documents/CastingAbilitiesThreeJS` · `docs/SCRIPTABLE_PLAY_SSOT.md` · same spine + UUID |
| **Voxel era wiring** (avatar/gear/DB) | `docs/VOXEL_ERA_AVATAR_GEAR_WIRING.md` — no parallel stores |
| Voxel look | `voxelAvatarSave` + `saveData.open.voxelLook` |
| Voxel characters | Railway `?era=voxel` only (not warlords body on Realms) |

---

## 3. Hard product rules (Open)

1. **Getsuga / slash-wave** = melee attack residual only (weapon edge, 1–10 m, color/size per stage). **Not** Alt+Space. Space = jump.  
2. **Map open** = same Controller, weapon skills, camera; rebind terrain / water / foot IK only.  
3. **Feet on terrain** = Controller ground height **and** avatar foot sampler from the **same** height field.  
4. **Anims** = fleet hydrate roles (climb/swim/hurt/death/loco); fill gaps via `ensureFleetRolesReady`, do not invent a new anim service.  
5. **Play body** = Toon RTS `{race}.glb` on **`https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/`** via `loadRaceKit` / `loadGrudge6CombatRig`. Never same-origin, never `gameopen.vercel.app`, never FBX+π/2, never forceAtlas, never 30characters as play. `30characters.glb` = outline/look reference only. Physics = Rapier capsule (`grudge-physics`).  
6. **Scale** = SI metres; human fit ~1.8 m; map scale for ~2 m orc when outdoor.  
7. **Physics** = Rapier compat + grudge-physics; one authority.  
8. **Mixer** = `THREE.AnimationMixer` only.  
9. **Entry catch** = wrong host / create / arcade / returnTo always go through `entryCatch` — no parallel redirect invent.  

Docs: `docs/ENTRY_CATCH_SSOT.md` · `docs/PRODUCTION_SYSTEMS_PATTERN.md` · `docs/FLEET_AUTH_WIRING.md` · `docs/MELEE_SLASH_FX.md` · `docs/ANIMATION_FLEET_SSOT.md` · `docs/CONTROLS_CAMERA_WEAPON_SSOT.md` · `docs/DANGER_ROOM_SSOT.md`

**Production reliability (do not regress):**
- One JWT reader for AI + REST (`readProductionAuthToken` / dual-write fleet keys).
- Lobby GLBs from R2 CDN first (`CAMPFIRE_TVS`) — never rely on Vercel SPA for `.glb`.
- `door=characters` / `/characters` → campfire hub, not AccountPanel (entryCatch wins over `from=`).
- Campfire wiring matrix: `docs/CAMPFIRE_WIRING_SSOT.md` (world map, harvest, deployables, zones, Realms).
- Smoke: `npm run smoke:prod:open` includes `/characters`, `/api/ai/health`, TVS CDN HEADs.

---

## 4. Build / test / deploy

```bash
# App (from artifacts/animator)
npm run build          # Vite production
npm test               # vitest
npm run typecheck

# Repo root
npm run deploy:gate    # fleet probes
# Prefer intentional: build animator, then vercel deploy --prod
# Node >= 20; wasm plugins required for Rapier
```

- Output: `artifacts/animator/dist/public` (see `vercel.json`)  
- Smoke: `npm run smoke:prod:open`  
- Do not claim production fixed without live smoke.

---

## 5. Before claiming done

```
[ ] Extended named SSOT (not a parallel system)
[ ] No unwanted hotkeys / free abilities
[ ] Map session invariants held (if map touched)
[ ] Packages match OPEN_PACKAGE_SSOT
[ ] Built or tested what you touched
[ ] User told: created vs modified vs risk
```

---

## 6. Related skills

`work-with-nugye` · `grudge-live-servers` · `grudge6-full-stack` · `grudge-character-correctness` · `grudge-3d-game-packages` · `grudge-fleet-combat` · `danger-playtesters` · `threejs-skills`
