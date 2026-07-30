# Game audio (ElevenLabs) + Docker Hub deploy tokens

**Secrets live only on** `gameopen-danger-ai` Worker (or CI). **Never** `VITE_*` / browser.

## ElevenLabs — best available systems for Grudge games

| Product | API | Best Grudge use |
|---------|-----|-----------------|
| **Text to Sound Effects** | `POST /v1/sound-generation` | Combat impacts, skill casts, UI, ambient loops |
| **Text to Speech** | `POST /v1/text-to-speech/{voice_id}` | NPC VO, quest bark, cinematics |
| **Models** | `eleven_multilingual_v2` | **Default production VO** — stable, multi-language |
| | `eleven_v3` (when available on plan) | Dramatic / storytelling VO |
| **Voice library** | Characters / Animation tags | Fantasy NPCs, not generic “ads” voices |
| **SFX loop** | `loop: true` | Ambience beds (Danger Room, islands) |

### Worker routes (key server-side)

| Route | Purpose |
|-------|---------|
| `POST /api/danger-ai/v1/audio/sfx` | Generate SFX → `{ audio_base64, format: mp3 }` |
| `POST /api/danger-ai/v1/audio/tts` | Generate VO |
| `GET /api/danger-ai/v1/audio/voices` | List voices for casting |

### Deployable asset path (correct)

```
ElevenLabs (worker)
  → preview in Danger Room Master
  → download / agent handoff
  → upload R2: assets.grudge-studio.com/audio/gameopen/{sfx|vo}/…
  → game loader same-origin /audio/* rewrite (optional) or absolute CDN
```

**Not** Docker for audio files. **Not** git for large banks.

### Danger tools

- `generate_game_sfx` — combat/UI SFX + preview  
- `generate_game_vo` — TTS + preview  
- `audio_pipeline_policy` — SSOT blurb  

### Secrets

```bash
cd infra/cloudflare/danger-ai
npx wrangler secret put ELEVEN_LABS_API
npx wrangler deploy
```

---

## Docker Hub cloud token — best use case

Token shape `dckr_oat_*` = **Docker Hub Personal Access Token**.

| Use | Do |
|-----|----|
| **Yes** | CI/CD `docker login` + **push/pull** game **server** images |
| **Yes** | Private base images for convert/bake workers |
| **Yes** | Versioned `gameopen-api`, `pvp-server`, tool images |
| **No** | GLB / textures / audio delivery (that is **R2 CDN**) |
| **No** | Browser / Vercel client env |
| **No** | Substituting ObjectStore or D1 |

### Worker routes

| Route | Purpose |
|-------|---------|
| `GET /v1/docker/status` | Policy + login example (safe) |
| `GET /v1/docker/whoami` | Validate token (needs `DOCKER_HUB_USER` for Basic auth) |

### CI pattern (production)

```bash
# GitHub Actions / Railway build
echo "$DOCKER_API_TOKEN_CLOUD" | docker login -u "$DOCKER_HUB_USER" --password-stdin
docker build -t docker.io/$DOCKER_HUB_USER/gameopen-api:$GIT_SHA .
docker push docker.io/$DOCKER_HUB_USER/gameopen-api:$GIT_SHA
```

Game **meshes/audio** still ship via **R2** after generate/upload pipelines.

### Secrets

```bash
npx wrangler secret put DOCKER_API_TOKEN_CLOUD
npx wrangler secret put DOCKER_HUB_USER   # your Hub username
```

---

## Security

Rotate any token pasted in chat. Never commit. Worker health reports `configured` / `missing` only — never secret values.
