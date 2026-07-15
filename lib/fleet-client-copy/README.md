# fleet-client (sync mirror)

Canonical package lives in the play shell monorepo:

`threejs-rapier-react-three-controller/lib/fleet-client`

Copy or git-submodule that package here when both repos should share one
token/login/launch/bag implementation without publishing to npm.

Current gameopen integration uses local:
- `artifacts/animator/src/lib/fleet.ts`
- `artifacts/animator/src/lib/grudgeAuth.ts`
- `artifacts/animator/src/game/grudoxZones.ts` → `lobbyIslandDeepLink`

Keep launch params aligned: `sso_token` + `characterId` + `from=gameopen`.
