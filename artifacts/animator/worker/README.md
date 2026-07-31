# Animator AI Worker (Cloudflare)

This is the **self-contained backend** for the Animator's *AI Animator* door. The
Animator frontend is a static site — it has no server of its own. It reaches AI
generation and cloud clip storage ONLY by calling this Worker over HTTPS with a
shared token. You deploy this Worker to **your own** Cloudflare account.

It uses:

- **Workers AI** — text generation (no API key needed; billed to your account).
- **D1** — primary clip storage (metadata + JSON payloads).
- **R2** — overflow storage for oversize clip payloads (optional).

Nothing here is part of the Replit monorepo; it has its own `package.json` and is
never imported by the app. You can copy the `worker/` folder anywhere.

---

## What it exposes

| Method | Path          | Body                     | Returns              |
| ------ | ------------- | ------------------------ | -------------------- |
| POST   | `/generate`   | `{ prompt, motion?, frames? }` | `{ clip, warnings }` |
| POST   | `/edit`       | `{ clip, instruction }`  | `{ clip, warnings }` |
| GET    | `/clips`      | —                        | `{ clips: meta[] }`  |
| GET    | `/clips/:id`  | —                        | `{ meta, clip }`     |
| POST   | `/clips`      | `{ name, clip, id? }`    | `{ meta }`           |
| DELETE | `/clips/:id`  | —                        | `{ ok: true }`       |

Every clip — whether produced by the AI or sent by the client — is passed through
the strict validator in `src/clipContract.ts` **before** it is stored or returned:
unknown bones are dropped, quaternions renormalized, durations clamped, and the
frame count capped. `src/clipContract.ts` is a mirror of the frontend's
`src/three/anim/aiClipContract.ts` + `posableBones.ts` — **keep them in lockstep**.

### A.L.E. — exact frame count

`POST /generate` accepts an optional `frames` integer (the Animator's **A.L.E.**
mode sends `8`). The Worker clamps it to `[1, MAX_FRAMES]`, instructs the model to
emit exactly that many keyframes, and — because models drift — deterministically
resamples the normalized clip to the exact count via `resampleFramesExact`
(mirrored in the frontend contract). **Redeploy this Worker after pulling changes
that add new request fields** (like `frames`); an old deployment silently ignores
unknown fields. The frontend also enforces the count on its end, so A.L.E. still
returns exactly 8 frames even before you redeploy.

---

## Deploy

Prereqs: a Cloudflare account and `npm i -g wrangler` (or use `npx wrangler`).

```bash
cd worker
npm install
wrangler login

# 1. Create the D1 database, then paste the printed database_id into wrangler.toml
wrangler d1 create anim_clips

# 2. (Optional) create the R2 bucket for oversize clips
wrangler r2 bucket create anim-clips

# 3. Apply the schema to the REMOTE database
wrangler d1 execute anim_clips --remote --file=./schema.sql

# 4. Set the shared token (must match the frontend build — see below)
wrangler secret put SHARED_TOKEN

# 5. Deploy
wrangler deploy
```

`wrangler deploy` prints your Worker URL, e.g.
`https://anim-ai-worker.<account>.workers.dev`.

### `wrangler.toml` knobs

- `[[d1_databases]] database_id` — **required**, from `wrangler d1 create`.
- `[[r2_buckets]]` — optional; remove the block if you don't want R2 (oversize
  clips will then be rejected with HTTP 413 instead of overflowing to R2).
- `AI_MODEL` — optional override (default `@cf/meta/llama-3.1-8b-instruct`).
- `ALLOWED_ORIGINS` — comma-separated allowlist for CORS, or `*`. Set it to your
  Animator origin(s) in production.
- `SHARED_TOKEN` — a **secret**, not a var. Set with `wrangler secret put`.

---

## Wire up the frontend

The Animator reads two **build-time** Vite env vars:

```
VITE_ANIM_WORKER_URL=https://anim-ai-worker.<account>.workers.dev
VITE_ANIM_WORKER_TOKEN=<the same value you set for SHARED_TOKEN>
```

Set them in the environment used to build the Animator, then rebuild. When unset,
the AI Animator door still opens but shows a "not configured" notice and disables
all network actions.

### About the token

`VITE_ANIM_WORKER_TOKEN` is compiled into the static bundle, so it is a **shared
access token, not a per-user login** — anyone with the deployed site can call your
Worker. That is the intended design for this feature. To limit exposure:

- Lock `ALLOWED_ORIGINS` to your own domain(s).
- Rotate the token (`wrangler secret put SHARED_TOKEN` + rebuild) if needed.
- Keep an eye on your Workers AI / D1 / R2 usage in the Cloudflare dashboard.

---

## Local dev

```bash
cd worker
npm run dev        # wrangler dev (uses a local D1; Workers AI needs --remote)
npm run typecheck
```

For AI calls during local dev, run `wrangler dev --remote` so `env.AI` hits the
real Workers AI binding.
