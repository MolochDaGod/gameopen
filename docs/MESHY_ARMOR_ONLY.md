# Meshy — armor equipment only (no skin)

**Policy date:** 2026-07-29  
**Worker:** `gameopen-danger-ai` · secret `MESHY_API_KEY`  
**API proxy:** `POST /api/danger-ai/v1/meshy/armor` · `GET /api/danger-ai/v1/meshy/task/:id`

## Rule

| Allowed | Banned |
|---------|--------|
| Closed armor **pieces** (helmet, chest, shoulders, gauntlets, greaves, boots) | Heroes / race bodies / grudge6 base meshes |
| Full **plate shell** with **zero skin** | Any prompt with skin, flesh, face, bare hands/feet |
| Shields as hard-surface gear | Characters, creatures, organic bodies |
| Equipment overlay props | Meshy as permanent player avatar |

**Heroes stay on** `assets.grudge-studio.com` grudge6 CDN + D1 gear presets.

## Prompt enforcement

Client: `artifacts/animator/src/ai/danger/meshyArmor.ts`  
Worker: `buildMeshyArmorPrompt` — appends closed-armor suffix; rejects banned tokens.

## Danger Room Master tools

- `meshy_armor_policy` — explain allowlist  
- `generate_meshy_armor` — start preview task  
- `meshy_armor_status` — poll progress / GLB URL  
- `meshy_armor_refine` — texture preview when SUCCEEDED  

## Deploy secret

```bash
cd infra/cloudflare/danger-ai
# stdin only — never commit
npx wrangler secret put MESHY_API_KEY
npx wrangler deploy
```

## Smoke

```bash
curl -s https://danger-ai.grudge-studio.com/health | jq .providers.meshy_armor_only
# expect "configured"

curl -s -X POST https://danger-ai.grudge-studio.com/v1/meshy/armor \
  -H 'content-type: application/json' \
  -d '{"prompt":"ornate steel full plate helmet with closed visor","slot":"helmet"}'
```

Reject example (must 400):

```json
{"prompt":"naked warrior with skin"}
```
