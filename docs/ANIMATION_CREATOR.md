# Animation Creator + AI Animator (Open)

**Surfaces:** `/anim` · `/anim-ai`  
**Host:** https://open.grudge-studio.com  
**GRUDOX shortcuts:** https://grudox.grudge-studio.com/anim-creator → Open `/anim`

Ported from the zip **animator** package (frame pose editor + AI skeleton-mover tools).

---

## What it is

| Mode | Path | Purpose |
|------|------|---------|
| Animation Creator | `/anim` | Pose Mixamo bones with a gizmo, build a frame timeline, preview, save named clips |
| AI Animator | `/anim-ai` | Same editor + prompt panel that calls the AI clip Worker |

Clips are stored as versioned JSON in `localStorage` key `dangerroom:customclips` (not FBX). On Danger Room / Explorer spawn, Studio **injects** them via `addClip` so they appear in the Clips panel and can bind to action slots.

---

## Engine modules (`artifacts/animator/src/three/anim/`)

| File | Role |
|------|------|
| `AnimEditor.ts` | Disposable three.js stage: Danger Room, voxel rig, TransformControls, timeline |
| `clipStore.ts` | Persist / list / build `THREE.AnimationClip` from frames |
| `posableBones.ts` | Mixamo bone whitelist for posing |
| `aiClipContract.ts` | Normalize + validate AI clip payloads (trust boundary) |
| `importClip.ts` / `retargetClip.ts` / `modelExport.ts` | Import / retarget / export helpers |
| `../ai/workerClient.ts` | HTTPS client for `VITE_ANIM_WORKER_URL` + token |

UI: `components/AnimEditorUI.tsx`, `components/AiAnimatorPanel.tsx`, `components/animCreator.css`.

Worker scaffold (optional deploy): `artifacts/animator/worker/` (D1 clip library + generate/edit).

Env (build-time):

```
VITE_ANIM_WORKER_URL=https://anim-ai-worker.grudge.workers.dev
VITE_ANIM_WORKER_TOKEN=<shared secret>
```

Fleet SSOT also lists `animAi` on GRUDOX `fleet-config.json`.

---

## Avatar Edit (cube modular head)

| Surface | URL |
|---------|-----|
| Open (fleet save) | `/avatar` — saves head + `saveData.open.voxelLook` |
| GRUDOX standalone | `/avatar-edit/` (static dist from zip outline) |

**Save contract**

1. localStorage `avatarEdit:playerHead:v1` (+ per-slot / per-character keys)
2. `avatarEdit:builds:v1` per race
3. When a fleet character is selected: `saveData.open.voxelLook` with `{ kind: "avatarEdit", head, code, race }` and prefer `avatarId: "explorer"`
4. Explorer / lobby / campfire apply head via `playerHead.ts` + `applyAvatarHead`

Hats: `public/avatar/hats/hat-pack.glb`, `pirate-voxel.glb`, crown, icons.

---

## Ghost Rider pack

Reference FBX pack under `public/anim/animations/ghostrider/` (from zip) for specialty skills — not auto-bound; import via Animation Creator / retarget pipeline as needed.

---

## Smoke

1. Open `/anim` → pose a joint → add frames → **Save clip**  
2. Open Danger Room → Clips panel lists the custom name → preview / bind to a skill slot  
3. Open `/avatar` → edit head → **Save to character** → campfire / Explorer shows modular face  
4. Optional: configure Worker → `/anim-ai` → generate motion with optional time/distance/direction  
