# Danger Room — locations, API, assets, AI

**Live:** https://open.grudge-studio.com/danger  
**Alias:** https://gameopen.vercel.app/danger  
**Source:** `artifacts/animator` · engine `src/three/Studio.ts`

---

## 1. What it is

Third-person **combat sandbox** (sparring NPCs, bosses, arsenal skills, HUD action bar).  
Bottom-right **Danger Room Master** AI chat can fix combat feel, preview animations, request movement, and audit skill icons.

---

## 2. Locations (repo → runtime)

| Concern | Path |
|---------|------|
| Mode mount | `artifacts/animator/src/App.tsx` (`mode === "danger"`) |
| Engine | `artifacts/animator/src/three/Studio.ts` |
| HUD | `artifacts/animator/src/components/Hud.tsx` |
| Skill/weapon icons | `artifacts/animator/src/three/skillIcons.ts` + `icons.ts` |
| Local UI icons | `client/public/icons/*.png` (also `artifacts/animator/public/icons/`) |
| MM skill packs | `artifacts/animator/src/three/grudge/weaponSkillPacks.ts` |
| Arsenal defs | `artifacts/animator/src/three/arsenal/{melee,ranged,magic}.ts` |
| Defense math | `lib/epicfight/src/combat/{defense,CombatController}.ts` |
| Block/parry host | `artifacts/animator/src/three/SparringCombat.ts` |
| Body lunge / knockback | `artifacts/animator/src/three/Controller.ts` (`dash`, `applyImpulse`) |
| AI tools | `artifacts/animator/src/ai/dangerTools.ts` |
| AI dock UI | `artifacts/animator/src/ai/AiAssistant.tsx` (bottom-right) |
| Prefab skills | `content/skills/*.json` · `server/content/skills/` |
| Prefab weapons | `content/weapons/*.json` |
| Routing | `artifacts/animator/src/lib/openRoutes.ts` |

---

## 3. API

| Endpoint | Role |
|----------|------|
| `GET /api/content/skills` | Prefab skill JSON (icons include `cdnUrl`) |
| `GET /api/content/weapons` | Prefab weapons |
| `GET /api/healthz` | Railway API health (when proxied) |
| `GET /api/characters?era=warlords` | Fleet heroes (proxy) |
| ObjectStore `https://objectstore.grudge-studio.com/api/v1/master-weaponSkills.json` | Canonical ~268 skills |
| ObjectStore weapons / t0 | Named weapons + starters |

**Practice:** Prefabs are the sandbox combat layer; master catalog is design SSOT. HUD icons resolve via R2 pack art (`skillIcons.ts`), not hard-coded emoji.

---

## 4. Assets usage in app

| Asset | How loaded |
|-------|------------|
| Skill/weapon pack icons | `https://assets.grudge-studio.com/icons/pack/{weapons\|misc}/*.png` via `resolveSlotIconUrl` |
| Broken master paths | Remapped in `skillIcons.ts` `CDN_REMAP` (e.g. Sword_02 → Sword_01) |
| Local fallbacks | `/icons/{attack,scout,ambush,…}.png` mine-loader set |
| Character GLB / FBX | `/models/…`, `/anim/…` (same-origin; optional R2 gameopen prefix) |
| VFX | Runtime `Vfx.ts` + model-driven templates |
| Auth bootstrap | Fleet / Grudge ID |

### HUD action bar resolution

```
slot → SlotBinding.iconUrl (CDN) → Icon src
     → onError → public/icons/{name}.png
```

Slots: LMB primary · F skill · 1–4 signatures · R heavy/skyfall.

---

## 5. Combat systems (AAA feel)

| System | Input | Implementation |
|--------|-------|----------------|
| **Block** | **RMB hold** | `Studio.startBlock` / sparring CC; guard bounce + low-friction pushback on big hits |
| **Parry** | **Q** | Perfect window → flash + **hitstop** + parryClash VFX |
| **Dodge / timed roll** | **X** (or double-tap A/D) | Elden Ring–style directional **roll** (F/B/L/R clips), jump→roll hop + blend, afterimage/dust, **~0.5s i-frames** (`iframe` 0.06–0.56s). No move input → **back-roll**. |
| **MM lunge** | Skills / AI `unique_movement` | `Controller.dash` + pack `lungeSpeed`/`lungeDuration`; `dashDistance` param |
| **Pushback** | Hits / block | `applyImpulse` + `skillForce` / `outcomeForceScale` |
| **Hitstop** | Confirmed hits / perfect parry | `Studio.triggerHitstop` (time-scale pulse) |
| **Poise / stagger** | Sparring CC | epicfight `CombatController` |

HUD hint line shows **RMB: Block** (not E).

---

## 6. AI chat tools (bottom-right)

| Tool | Purpose |
|------|---------|
| `set_player_character` / `set_player_weapon` | Swap loadout |
| `spawn_npc` / `spawn_boss` / `clear_npcs` | Arena setup |
| `set_difficulty` | AI aggression |
| `set_param` | moveSpeed, dashDistance (MM), skillForce (pushback), blendTime, camera… |
| `aaa_combat_feel` | Presets: snappy / weighty / defensive / balanced |
| `audit_skill_icons` | Report R2 icon URLs for current weapon |
| `list_animations` / `preview_animation` | Create/edit feel — preview clips + VFX |
| `unique_movement` | Dash forward/back/left/right/custom |
| `set_time_scale` / `trigger_hitstop` | Bullet-time / impact freeze |

---

## 7. Deploy & verify

```bash
cd gameopen
npm run build          # scripts/vercel-build.mjs
npm run deploy:prod    # build + vercel --prod
```

**Smoke:**

1. Open https://open.grudge-studio.com/danger — hard refresh  
2. Action bar shows **weapon pack icons** (not only generic glyphs)  
3. Q parry / RMB block / X dodge work; hitstop on impact  
4. Bottom-right AI: `audit skill icons`, `aaa combat feel snappy`, `dash forward`, `list animations`  

---

## 8. Known gaps (next)

- Full ObjectStore 268-skill hotbar bind (only arsenal + remapped pack icons today)  
- ~48% of master icon paths still missing on R2 (use `CDN_REMAP` + upload job)  
- Expand prefabs beyond sword/axe sample set  
- Deeper AI: generate new clip metadata to disk (needs write API)

---

## 9. Related docs

- [OPEN_SYSTEMS.md](./OPEN_SYSTEMS.md) — all Open surfaces  
- [content/docs/CANONICAL_WEAPON_SKILLS.md](../content/docs/CANONICAL_WEAPON_SKILLS.md) — master catalog  
- [README.md](../README.md) — fleet map  
