# Production deploy — Grudge Open / annihilate-demo

## System connections

```
Browser → open.grudge-studio.com | grudge-studio.com/annihilate-demo
        → Vercel SPA (gameopen)
        → /api/* rewrites → Railway / id / assets / objectstore
        → Studio Danger Room (Controller, combat, grudge6)
```

| System | Connection |
|--------|------------|
| SPA | `vercel.json` → `artifacts/animator/dist/public` |
| Auth | `/api/auth/*` → Railway + id.grudge-studio.com |
| Characters | `/api/characters` → Railway |
| Kits | `/models/grudge6/*` → assets.grudge-studio.com |
| Anims | `/anims/baked/*` → grudge-arena rewrite |
| Hero boot | `?hero=elf_worge` → `grudge:high-elves:unarmed` + mesh_ids |

## Deploy

```bash
cd gameopen
npm run ci:test          # retarget + annihilate unit tests
npm run build            # vercel-build.mjs
npm run deploy:prod      # build + vercel --prod
npm run smoke:prod:open  # live probes
npm run smoke:prod:portal  # portal path (warn if not wired)
npm run readiness:anims  # baked pack availability
```

## CI

`.github/workflows/ci.yml` runs on push/PR:

1. Install animator deps  
2. Vitest (retargetMap, annihilateHero)  
3. Typecheck (non-blocking if noisy)  
4. Full production build  
5. On main push: smoke Open (continue-on-error until stable)

## Smoke criteria (critical)

| Check | Pass |
|-------|------|
| `/` `/danger` `/annihilate-demo` | HTML SPA 200 |
| `?hero=elf_worge` | HTML SPA 200 |
| `/api/characters` | **not** SPA HTML (200/401 OK) |
| CDN ELF kit | 200 (warn if CDN down) |

## Portal (`grudge-studio.com`)

Edge must rewrite `/annihilate-demo*` to this Open SPA (same as open.grudge-studio.com).  
If portal smoke WARNs, update the grudge-studio portal Worker / nginx, not only Vercel.

## Hero production path

1. Parse `?hero=` → race + preset + mesh_ids  
2. `setEquipmentMeshIds` **before** `setCharacter("grudge:race:preset")`  
3. Weapon id for arsenal / unarmed `none`  
4. On load: `reportHandSockets()` log  

Code: `src/lib/annihilateHero.ts` · `Studio.reportHandSockets` · `App.tsx` danger mount.

## Rollback

Vercel → Project → Deployments → Promote previous production.
