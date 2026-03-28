-- NoteBase database initialisation
-- Runs automatically when the Postgres container starts for the first time.
-- See docs/data-model.md for schema documentation.

-- ── Event store ───────────────────────────────────────────────────────────────

CREATE TABLE events (
  id          BIGSERIAL PRIMARY KEY,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  user_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_user_created ON events (user_id, created_at);
CREATE INDEX idx_events_user_id_asc  ON events (user_id, id ASC);
CREATE INDEX idx_events_type         ON events (type);

-- ── Snapshots ─────────────────────────────────────────────────────────────────

CREATE TABLE snapshots (
  id               BIGSERIAL PRIMARY KEY,
  projection_name  TEXT NOT NULL,
  user_id          UUID NOT NULL,
  state            JSONB NOT NULL,
  last_event_id    BIGINT NOT NULL REFERENCES events(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_lookup
  ON snapshots (projection_name, user_id, last_event_id DESC);

-- ── Tags (reference data) ─────────────────────────────────────────────────────

CREATE TABLE tags (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_tags_user ON tags (user_id);

-- ── Phase 1 read store — projection tables ────────────────────────────────────
-- Disposable. Can be dropped and rebuilt from the event log at any time.

CREATE TABLE projection_tag_lens (
  node_id         UUID NOT NULL,
  user_id         UUID NOT NULL,
  tag_id          UUID NOT NULL,
  tag_name        TEXT NOT NULL,
  content         TEXT NOT NULL,
  daily_note_date DATE NOT NULL,
  parent_id       UUID,
  position        INTEGER NOT NULL,
  child_count     INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, tag_id, node_id)
);

CREATE INDEX idx_tag_lens_query
  ON projection_tag_lens (user_id, tag_id, daily_note_date DESC);

CREATE TABLE projection_daily_note (
  node_id         UUID NOT NULL,
  user_id         UUID NOT NULL,
  daily_note_date DATE NOT NULL,
  content         TEXT NOT NULL,
  depth           INTEGER NOT NULL DEFAULT 0,
  position        INTEGER NOT NULL,
  parent_id       UUID,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, daily_note_date, node_id)
);

CREATE INDEX idx_daily_note_query
  ON projection_daily_note (user_id, daily_note_date, position ASC);
