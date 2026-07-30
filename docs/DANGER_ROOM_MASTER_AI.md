# Danger Room Master AI — free agentic dock

**Live:** https://open.grudge-studio.com/danger  
**Worker:** `gameopen-danger-ai` → https://danger-ai.grudge-studio.com  
**Same-origin:** `/api/danger-ai/*` (Vercel rewrite + open proxy)

## What it is

Bottom-right **Danger Room Master** is chat2edit / chat2create for:

- Maneuver Motion (MM) weapon skills  
- Animation clips (list/search/preview/custom/slot)  
- grudge6 / Toon RTS mesh, hand bone, scale, textures  
- Environment (room presets, map import)  
- Rapier / collider notes  
- Fleet links (coder.grudge-studio.com, assets, foundry)

**Free path (server secrets, never in the browser):**  
`Groq` → `HuggingFace` → Cloudflare **Workers AI**  

Set on the worker only:

```bash
cd infra/cloudflare/danger-ai
echo $env:GROQ_API_KEY | npx wrangler secret put GROQ_API_KEY
echo $env:HUGGINGFACE_API_KEY | npx wrangler secret put HUGGINGFACE_API_KEY
npx wrangler deploy
```

Tools always execute **in the browser** against live Studio.

## Architecture

```
Browser AiAssistant (Chat | Term | Systems | Agents)
  → planDangerAgentTurn
       POST /api/danger-ai/v1/agent
         → CF Worker gameopen-danger-ai (Workers AI)
       fallback → fleet companion (ai.grudge-studio.com, may need auth)
       fallback → local command heuristics
  → execute tools on Studio / App handlers
```

## Deploy worker

```bash
cd C:\Users\nugye\Documents\gameopen\infra\cloudflare\danger-ai
npx wrangler deploy
curl -s https://danger-ai.grudge-studio.com/health
```

Redeploy open proxy so `/api/danger-ai` is routed before Vercel:

```bash
cd C:\Users\nugye\Documents\gameopen\infra\cloudflare\open
npx wrangler deploy
```

Vercel SPA also rewrites `/api/danger-ai/:path*` → worker (for gameopen.vercel.app).

## Client modules

| Path | Role |
|------|------|
| `src/ai/dangerTools.ts` | Tool catalog + system prompt + folders |
| `src/ai/danger/dangerAgentClient.ts` | Free agent transport |
| `src/ai/danger/skillMmRuntime.ts` | Session MM overrides |
| `src/ai/useAssistant.ts` | danger-agent transport |
| `src/ai/AiAssistant.tsx` | Dock UI (tabs) |
| `infra/cloudflare/danger-ai/` | Worker + knowledge pack |

## Tool groups

See `DANGER_SYSTEM_FOLDERS` and `buildDangerTools` — combat, anims, weapon skills MM, grudge6, env/physics, fleet/coder.

## Knowledge SSOT (worker)

Embedded in `infra/cloudflare/danger-ai/src/knowledge.js`:

- Five data layers  
- SI 1.8 m human  
- Bip001 / hand bone / flipY textures  
- MM field definitions  
- JSON `{ message, tool_calls }` response contract  

## UI tabs

1. **Chat** — natural language + quick chips + talk2talk  
2. **Term** — `drm$` direct tools / `chat …`  
3. **Systems** — folder tree of tool groups  
4. **Agents** — specialist presets + coder.grudge-studio.com  

## Smoke

```bash
curl -s https://danger-ai.grudge-studio.com/health
# expect providers.groq=configured, huggingface=configured, workers_ai=available
curl -s https://open.grudge-studio.com/api/danger-ai/health
curl -s -X POST https://danger-ai.grudge-studio.com/v1/agent \
  -H "content-type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"list animations\"}],\"tools\":[{\"name\":\"list_animations\",\"description\":\"list clips\"}]}"
# expect provider=groq when secret is set
```

Then on Open: open /danger → bottom-right bot → expect FREE AI badge → “list weapon skills”.

## Secrets policy

| Secret | Use for Danger Master? |
|--------|------------------------|
| `GROQ_API_KEY` | **Yes** — primary free chat (best JSON tools) |
| `HUGGINGFACE_API_KEY` | **Yes** — fallback |
| Workers AI binding | **Yes** — always-on free fallback |
| `CF_ACCOUNT_ID` / deploy tokens | Ops only (wrangler), not in worker runtime |
| R2 / D1 ids | Asset pipeline — not chat |
| `MESHY_API_KEY` | **No** for production heroes (fleet ban) |
| Poly Pizza | Optional prop library later — not chat |
| Tunnel / Access client | Edge/auth ops — not this chat worker |

**Never commit API keys.** If pasted in chat, **rotate** them.
