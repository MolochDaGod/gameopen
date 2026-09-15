# Fleet account accessibility SSOT

**One account. Many brands. Same Railway player data.**

| Brand | Host | Role |
|-------|------|------|
| **Grudge Open** | open.grudge-studio.com | Steam-like **library + launcher** · Danger · native tools · PWA |
| **GRUDOX** | grudox.grudge-studio.com · grudox.vercel.app | **Voxel systems** hub · cabinets · editor · deployer · **/account** |
| **Warlords** | client.grudge-studio.com · grudgewarlords.com | Flagship fantasy **play** |
| **Poker** | poker.grudge-studio.com | Card game · **/account** |
| **GST** | grudge-studio.com/gst | Islands RTS |
| **Studio portal** | grudge-studio.com | ENGINE product index (not a roster) |
| **Legion AI** | ai.grudge-studio.com | Chat / image / agents · same JWT |
| **Foundry** | character.grudge-studio.com | Create / 4-slot only |
| **Mine-Loader** | mineloader.grudge-studio.com | Voxel multiplayer worlds |

Do **not** merge Open and GRUDOX into one SPA. Do **share** Grudge ID + Railway.

---

## Shared data law

```
id.grudge-studio.com          → login JWT
Railway grudge-api-production → characters · account bag · wallet · island
D1                            → asset index only
R2 assets.grudge-studio.com   → binaries
```

| Scope | Shared across brands? | API |
|-------|----------------------|-----|
| Login / grudge_id | **Yes** | auth |
| Account bag / gold / GBUX / wallet | **Yes** | `/api/account/*` |
| Home island | **Yes** (account) | `/api/island` |
| Characters | **Yes roster**, filtered by `?era=` | `/api/characters` |
| Character XP / equipment | Per character UUID | `/api/characters/:id` |
| Game-specific saves | Per character `saveData` / open loadout | character PATCH |

Token keys (all surfaces): `grudge_auth_token` · `grudge_session_token` · `grudge.token` · `sso_token`

---

## Account entry points (must stay in sync)

| Surface | Account URL |
|---------|-------------|
| Open | https://open.grudge-studio.com/?door=account |
| GRUDOX | https://grudox.grudge-studio.com/account · https://grudox.vercel.app/account |
| Poker | https://poker.grudge-studio.com/account |
| Warlords | client home (in-game account chrome) |
| Wallet | https://wallet.grudge-studio.com/ |

Code SSOT (Open): `artifacts/animator/src/lib/fleetAccountAccess.ts` · `accountShared.ts`  
Code SSOT (GRUDOX): `hub-src/lib/grudge-id` `loadSharedAccountBundle` · `pages/Account.tsx`

---

## Handoff contract

Every external launch from Open should pass:

```
open=1&from=gameopen&sso_token|grudge_token=&characterId=&characterName=&baseId=&raceId=
```

Helpers: `gameLaunchUrl` · `fleetWorldLaunchUrl` · `fleetAccountHandoffUrl`

---

## Product roles (do not invert)

| Need | Go to |
|------|--------|
| Browse all fleet games | **Open** library |
| Install desktop/mobile launcher | **Open** PWA Install app |
| Voxel cabinets / editor / GRUDOX account | **GRUDOX** |
| Create hero | **Foundry** |
| Play Warlords world | **client.*** (not Open tile for pirate-islands) |
| Shared bag view | Open **or** GRUDOX account (same API) |

---

## Smoke

```bash
# Open
npm run smoke:library
# GRUDOX
curl -sI https://grudox.grudge-studio.com/account
curl -sI https://grudox.vercel.app/account
# Poker
curl -sI https://poker.grudge-studio.com/account
# API
curl -s https://open.grudge-studio.com/api/health
```

Signed-in smoke: Open account Refresh → same GBUX/bag as GRUDOX /account Sync.
