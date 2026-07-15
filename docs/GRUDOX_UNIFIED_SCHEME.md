# GRUDOX Unified Scheme (pointer)

Canonical architecture for accounts, characters, launch protocol, and deploy roles:

→ **Play shell / Lobby World:**  
`threejs-rapier-react-three-controller` →  
`artifacts/animator/docs/GRUDOX_UNIFIED_SCHEME.md`

## This repo’s role

| Role | gameopen |
|------|----------|
| Live URL | https://gameopen.vercel.app |
| Owns | Launcher pattern, combat sandbox, fleet `vercel.json` rewrites, mature SSO (`fleet.ts` / `grudgeAuth.ts`), content weapons index, Railway API/WS |
| Does not own | Character SSOT (Railway GrudgeBuilder), Character Studio create UI |

## Cross-game handoff

Any title (including Lobby Island) may open:

```
https://gameopen.vercel.app/?sso_token=<jwt>&characterId=<uuid>&from=<app>
```

gameopen boot captures tokens (query + hash), stores fleet keys, loads  
`GET /api/characters?era=warlords`.

Return path from combat sandbox to island:

```
https://<play-shell>/?door=lobbyWorld&sso_token=<jwt>&characterId=<uuid>&from=gameopen
```

## Keep in sync with play shell

- Token keys: `grudge_auth_token`, `grudge_session_token`, `grudge.token`, `sso_token`, …
- Login dual-write: `redirect_uri` + `redirect` + `return` + `return_to` + `origin` + `app`
- Characters: Railway only — never local-only roster for persistence
- Prefer same-origin `/api/*` rewrites (see root `vercel.json`)

See also: `README.md` Auth section, `DEPLOY.md`.
