# uMMORPG Concept Adoption (Grudge Open)

Careful, purposeful — **concepts and pipelines**, not Mirror/Unity ports.

**Danger Room live:** https://gameopen.vercel.app/danger · https://open.grudge-studio.com/danger

## Adopted

| Concept | How we implement it |
|---------|---------------------|
| Scriptable item templates | `content/items/*.json` |
| Equipment slots | `slot` on weapon/armor defs |
| Skills bound to weapon family | `content/skills` + `weapon.skills[]` |
| Hotbar 1–4 (primary→ultimate) | master-weaponSkills slots → Studio sig1–4 |
| Template vs inventory instance | Templates in content/; instances on character API later |
| Damage ≈ base × power | `baseDamage` × skill `power` / master `damage` |
| CD + resource cost | `cooldown`, `cost.stamina/mana` |
| **Master catalog SSOT** | ObjectStore `master-weaponSkills.json` **v3.1.0** (268 skills) |
| **Runtime loader** | `three/content/masterWeaponSkills.ts` (fetch + kit build) |
| **T0 / T1 skill bar labels** | `t0SignatureSkills()` prefers master kit names + pack icons |
| **TOME off-hand relic** | Arsenal `tome` + coupling modes (elemental/heal/buff) |
| **WAND / SCYTHE / CROSSBOW** | Arsenal entries mapped to converted GLB stand-ins |
| Prefab import | `node scripts/import-master-weapon-skills.mjs` → `content/skills|weapons` |

## Asset conversion (meshes)

| Master type | Production mesh (converted stand-in) |
|-------------|--------------------------------------|
| SWORD / AXE / DAGGER / … | Existing `models/weapons/*.glb` (already glTF / Web-ready) |
| WAND | `staff.glb` at 0.75 m length (short cane) |
| TOME | Off-hand book — shield mesh stand-in until dedicated book GLB bake |
| SCYTHE | `war-spear.glb` polearm stand-in |
| CROSSBOW | `rifle.glb` two-hand ranged stand-in |

Icons always from R2: `https://assets.grudge-studio.com/icons/pack/...`  
Do **not** ship Unity `.asset` / FBX raw into the browser — convert offline (`grudge-convert` / gltf-transform) then point `mesh.path`.

## Deferred

| Concept | Why |
|---------|-----|
| Full server-authoritative Mirror combat | Local sandbox feel first |
| All 268 skills as unique anim clips | Attack one-shot + VFX kind until pack bake |
| Auction / mail / guild banks | Out of scope for Open combat lab |
| Exact uMMORPG skill UI | Use Grudge HUD patterns |
| Dedicated tome/scythe GLBs | Stand-ins wired; re-bake when art ready |

## Never

- Hard-code mesh paths inside combat systems
- Store full item templates inside character save blobs
- Invent a second skill system parallel to `content/skills` + master catalog

## Reference (local)

Unity uMMORPG sandbox may exist at `Documents/ummorpgdev` for **reading** slot/skill ideas only.
