# Anim AI Worker (Cloudflare) — chat → create animations

**Live:** https://anim-ai-worker.grudge.workers.dev  
**Source:** `artifacts/animator/worker/`  
**Open UI:** https://open.grudge-studio.com/anim-ai  

Fleet SSOT endpoints: GRUDOX `fleet-config.json` → `animAi`, `animCreator`, `aiAnimator`.

---

## Dependencies

| Layer | Tech |
|-------|------|
| Inference | Cloudflare **Workers AI** (`@cf/meta/llama-3.1-8b-instruct`) |
| Vision poses | Workers AI **LLaVA** (`@cf/llava-hf/llava-1.5-7b-hf`) |
| Clip library | **D1** `anim_clips` + **R2** `anim-clips` overflow |
| Contract | Mixamo 20 posable bones, unit quats, max 64 frames |
| Frontend | Open `workerClient.ts` + `AiAnimatorPanel` |
| Runtime bind | Studio `injectCustomClips` → Explorer/Character `addClip` |

---

## Tools API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` or `/` | Ready + tool list |
| GET | `/tools` | Catalog |
| POST | `/generate` | Text → motion clip (+ motion travel, A.L.E. frames) |
| POST | `/edit` | Instruction edit |
| POST | `/pose` | Text → key pose |
| POST | `/pose-from-image` | Image base64/URL or description → pose |
| POST | `/ik` | Deterministic two-bone IK (arms/legs) |
| POST | `/weapon` | Weapon presets + yaw/pitch/roll arm adjust |
| POST | `/optimize` | Smooth, merge near-dupes, downsample |
| POST | `/chat` | Multi-turn chat → routed tools + clip |
| * | `/clips` | Cloud library CRUD |

Every clip is validated by `clipContract.ts` (mirror of frontend `aiClipContract.ts`) before return/storage.

---

## Chat routing (heuristic)

- optimize / smooth → `/optimize` path  
- IK / aim arm / kick → `/ik`  
- sword / bow / rifle / guard → weapon preset  
- pose only → `/pose`  
- edit language + current clip → `/edit`  
- else → `/generate` (or talk fallback)

---

## Deploy

```bash
cd artifacts/animator/worker
npm install
npx wrangler d1 execute anim_clips --remote --file=./schema.sql
npx wrangler deploy
```

Optional lock-down:

```bash
npx wrangler secret put SHARED_TOKEN
# rebuild Open with VITE_ANIM_WORKER_TOKEN matching
```

Frontend defaults to `https://anim-ai-worker.grudge.workers.dev` when env unset.

---

## Avatar (voxel) SSOT

| Store | Key |
|-------|-----|
| local | `avatarEdit:playerHead:v1`, slots, per-character |
| local | `avatarEdit:voxelLook:v1` |
| fleet | `saveData.open.voxelLook` + `avatarId: "explorer"` |
| apply | `playerHead.applyAvatarHead` on Explorer voxel rig |

Open `/avatar` and GRUDOX `/avatar-edit/` share the same modular head contract.
