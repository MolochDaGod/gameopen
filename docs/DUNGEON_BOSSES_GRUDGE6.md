# Dungeon bosses = grudge6 player-like characters

**Rule:** no `karate-boss` GLB / capsule “boss kit” for dungeon climax or elites.

## Source of truth

| Layer | File |
| --- | --- |
| Profiles (race, armour preset, weapon tier, skills, attrs, AI) | `artifacts/animator/src/three/dungeon/dungeonBossProfiles.ts` |
| Spawn + kit load + AI | `artifacts/animator/src/three/dungeon/DungeonEnemies.ts` |
| Map → boss id | `DUNGEON_MAP_BOSS` in profiles |

## What a boss is

Each boss is a **full grudge6 character**:

- **Race + cool armour** — `raceId` + `presetId` (knight / mage / …) → `meshIds` from gear presets
- **Weapon + tier** — arsenal `weaponId`, `weaponTier` 0–5 (weapon tree gates)
- **Level + skill tree** — `level`, `skillTreeNodes`, `skillLabels` (AI cycles skills)
- **Player-like stats** — 8 attributes, HP / stamina / poise, move speed, aggro / fight range
- **AI behaviour tags** — `melee_pressure` · `ranged_kite` · `caster_burst` · `hybrid_elite`
- **Damage** — `bossScaledDamage` (attributes + weapon tier + skill multiplier)

## Live maps

| Map id | Boss profile |
| --- | --- |
| `default` / `forge-depths` | `forge-moloch` — orc knight greataxe T5 |
| `chicken-gun-town` | `elite-ironclad` — dwarf knight hammer T3 |
| `crypt-halls` / `dungeon` | `crypt-death-knight` |
| `temple-agama` / `agama-map` | `temple-bladewarden` |

## Runtime path

1. Studio `enterDungeon` passes `{ mapId: loadDungeonMap() }` into `DungeonEnemies`.
2. Pit spawns **elite-ironclad** grudge6 pack + map boss profile.
3. `GrudgeAvatar(race, preset, { meshIds })` loads; capsule stand-in hides when ready.
4. Update loop: aggro range → path → attack / skill tree windup → `setLocomotion` / `playRoleOnce("attack")`.
5. Surface trash uses `listHostilePrefabs()` multi-race kits (not karate-boss).

## Also stripped

- Brawler default avatar → `grudge:orcs:knight` (not karate-boss)
- Targets race fallback no longer lists karate-boss
- WarlordGenesis boss wave loads baked grudge6 orc knight
- Loadout mesh preview fallbacks: orc / sanji / explorer

Catalog asset `models/karate-boss.glb` may still exist for legacy lab/landing art; **gameplay bosses must not use it**.
