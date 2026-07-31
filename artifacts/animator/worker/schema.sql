-- D1 schema for the Animator AI skeleton mover.
-- Apply with:  wrangler d1 execute anim_clips --file=./schema.sql
-- (add --remote to apply to the deployed database).

CREATE TABLE IF NOT EXISTS clips (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  frame_count  INTEGER NOT NULL,
  duration     REAL NOT NULL,
  -- Inline JSON payload for normal-sized clips. NULL when the payload is large
  -- enough to live in R2 instead (see r2_key).
  payload      TEXT,
  -- R2 object key for oversize payloads (NULL when stored inline).
  r2_key       TEXT,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS clips_updated_at ON clips (updated_at DESC);
