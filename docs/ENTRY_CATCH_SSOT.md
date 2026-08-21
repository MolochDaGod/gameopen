# Entry catch SSOT — start points, anti-loop, wrong-page recovery

**Code:** `artifacts/animator/src/lib/entryCatch.ts`  
**Wired into:** `openRoutes.resolveModeFromLocation` · `fleet.buildGrudgeLoginUrl` · `auth/fleetCore.buildFleetLoginUrl`  
**Tests:** `entryCatch.test.ts`  
**Agent protocol:** `work-with-nugye` · `AGENTS.md` · `AGENT_WORK_CONTRACT.md`

---

## Goal

Users and agents must **not**:

- Land on the wrong host (Open vs GRUDOX vs Foundry vs Warlords)
- Loop Foundry ↔ Open ↔ ID login forever
- Open Voxel Velocity (racer) inside Danger Room
- Hit Warlords `/home-island` on the Open SPA
- Return from login to `character.*` or `id.*`

---

## Product start points

| Intent | Start URL |
|--------|-----------|
| Open library | `https://open.grudge-studio.com/` |
| Danger Room | `https://open.grudge-studio.com/danger` |
| Account / roster handoff | `https://open.grudge-studio.com/account` |
| Character info / equipment | `https://open.grudge-studio.com/equipment` |
| Sign-in | `https://open.grudge-studio.com/login` |
| Create hero | `https://character.grudge-studio.com/foundry` |
| Foundry 4-slot | `https://character.grudge-studio.com/` |
| Warlords home island | `https://client.grudge-studio.com/home-island?characterId=` |
| GRUDOX arcade | `https://grudox.grudge-studio.com/arcade` |
| Arcade cabinet (racer, …) | `https://grudox.grudge-studio.com/arcade/play/<id>` |

Helpers: `startUrlForIntent(...)`, `PRODUCT_STARTS`.

---

## Catch rules (runtime)

| Incoming | Action |
|----------|--------|
| `/arcade/play/racer` (etc. GRUDOX-only) on Open | **Hard redirect** → grudox arcade |
| `/arcade/play/explorer` | Open **danger** (or dressing if `?dressing=1`) |
| `?mode=create` / `/foundry` on Open | **Hard redirect** → character foundry + safe `returnTo` |
| `/characters`, `/lobby`, `?door=characters\|campfire` | Mode **characters** (CampfireLobby) — **wins over** `from=` |
| `from=foundry\|gcs\|character-studio` without campfire path | Mode **account** (not combat) |
| `from=charactersgrudox` on hub `/` | Mode **characters** (campfire roster) |
| `/home-island`, `/tutorial`, `/island-3d` on Open | **Hard redirect** → Warlords client |
| `/world` on Open | **Stay** — VoxGrudge lab (not Warlords world) |
| `/login` while session exists | Mode **doors** (hub) |
| Unknown path | Mode **doors** — never invent Danger |
| `era=warlords` alone | Hub only — **no** foundry trap |

---

## Safe returnTo (login / handoff)

| Allowed | Blocked |
|---------|---------|
| open.grudge-studio.com | character.grudge-studio.com |
| gameopen.vercel.app | id.grudge-studio.com |
| client.grudge-studio.com / grudgewarlords.com | assets.grudge-studio.com |
| grudox / forge / ui / mine | grudge6.* |
| localhost | |

API: `safeReturnUrl(candidate, fallback)`.

Character host as return → **Open account** (not foundry loop).

---

## Agent rules

1. Build deep-links with `startUrlForIntent` or `PRODUCT_STARTS` — not guessed hosts.  
2. Never map racer/zombie/z-brawl → Danger Room.  
3. Never set login `returnTo` to character.* or id.*.  
4. After Foundry save: Warlords play with `characterId`, or Open `/account` — not Open `/danger` without user intent.  
5. If a new loop appears: **extend `entryCatch.ts`**, do not invent a second router.

---

## Verify

```bash
cd artifacts/animator
npx vitest run src/lib/entryCatch.test.ts
```

Live smoke:

- `open.grudge-studio.com/arcade/play/racer` → grudox Velocity  
- `open.grudge-studio.com/?mode=create` → character foundry  
- `open.grudge-studio.com/home-island` → client home-island  
- Login return never sticks on character.*
