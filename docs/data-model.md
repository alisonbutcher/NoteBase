# Data Model

This document describes the persistent data structures used by NoteBase across all deployment phases.

---

## Overview

NoteBase uses two distinct storage concerns:

- **Event store** — the source of truth. Append-only. Never updated or deleted. Postgres in all phases.
- **Read store** — pre-computed projections. Updated asynchronously by the projection engine. Postgres in Phase 1, DynamoDB in Phase 2+.

These concerns are intentionally separated. The event store is authoritative. The read store is disposable — it can be rebuilt at any time by replaying the event log.

---

## Event Store (PostgreSQL)

### `events` table

The central table of the system. Every state change in the application produces exactly one row in this table.

```sql
CREATE TABLE events (
  id          BIGSERIAL PRIMARY KEY,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  user_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_user_created  ON events (user_id, created_at);
CREATE INDEX idx_events_user_id_asc   ON events (user_id, id ASC);
CREATE INDEX idx_events_type          ON events (type);
```

**Column notes:**

- `id` — monotonically increasing, used as the replay cursor. Projection handlers track the last processed event ID to resume after restart.
- `type` — the event class name. Used by projection handlers to route events to the correct handler method. Example values: `NodeCreated`, `NodeTagged`, `NodeMoved`.
- `payload` — JSONB. The typed event data. Schema varies by event type (see Event Catalogue below).
- `user_id` — all events are scoped to a user. Multi-tenancy is enforced at the event level.
- `created_at` — wall clock time of event persistence. Used for time-travel queries and audit.

### `snapshots` table

Periodic snapshots of projection state used to avoid full event log replay on projection rebuild.

```sql
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
```

**Usage:** When rebuilding a projection, the system:
1. Queries for the latest snapshot matching `projection_name` and `user_id`
2. Loads the snapshot `state` as the starting point
3. Replays all events with `id > last_event_id` against the starting state

Snapshots are triggered automatically when the gap between the latest snapshot's `last_event_id` and the current maximum event ID exceeds the configured threshold (default 1000 events per user per projection).

---

## Event Catalogue

All event payloads follow the structure:

```typescript
interface DomainEvent {
  eventId: string;    // UUID, unique per event
  userId: string;     // UUID
  occurredAt: string; // ISO 8601 timestamp
  // ... event-specific fields
}
```

### `NodeCreated`

```typescript
{
  eventId: string;
  userId: string;
  occurredAt: string;
  nodeId: string;       // UUID, client-generated
  content: string;      // initial text content
  parentId: string | null;  // null for root nodes (daily note itself)
  dailyNoteDate: string;    // YYYY-MM-DD
  position: number;     // display order among siblings
}
```

### `NodeEdited`

```typescript
{
  eventId: string;
  userId: string;
  occurredAt: string;
  nodeId: string;
  content: string;      // new content
}
```

### `NodeTagged`

```typescript
{
  eventId: string;
  userId: string;
  occurredAt: string;
  nodeId: string;
  tagId: string;        // UUID
  tagName: string;      // denormalised for projection convenience
}
```

### `NodeUntagged`

```typescript
{
  eventId: string;
  userId: string;
  occurredAt: string;
  nodeId: string;
  tagId: string;
}
```

### `NodeMoved`

```typescript
{
  eventId: string;
  userId: string;
  occurredAt: string;
  nodeId: string;
  newParentId: string | null;
  newPosition: number;
}
```

### `NodeDeleted`

```typescript
{
  eventId: string;
  userId: string;
  occurredAt: string;
  nodeId: string;
  softDelete: boolean;  // true = hidden, false = purged from projections
}
```

### `TagCreated`

```typescript
{
  eventId: string;
  userId: string;
  occurredAt: string;
  tagId: string;
  tagName: string;
  color: string | null; // hex color for UI display
}
```

---

## Read Store — Phase 1 (PostgreSQL)

In Phase 1, projections are maintained as Postgres tables in the same RDS instance as the event store. These tables are fully disposable and can be dropped and rebuilt from the event log at any time.

### `projection_tag_lens`

```sql
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
```

Query for tag lens page:

```sql
SELECT * FROM projection_tag_lens
WHERE user_id = $1 AND tag_id = $2
ORDER BY daily_note_date DESC, position ASC;
```

### `projection_daily_note`

```sql
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
```

Query for daily note page:

```sql
SELECT * FROM projection_daily_note
WHERE user_id = $1 AND daily_note_date = $2
ORDER BY position ASC;
```

---

## Read Store — Phase 2 (DynamoDB)

In Phase 2, the Postgres projection tables are replaced by DynamoDB tables. Application code changes only the `IProjectionStore` implementation via environment variable — see ADR-006.

### Tag lens table

```
Table name:     notebase-tag-lens
Billing:        On-demand
PK:             USER#{userId}#TAG#{tagId}
SK:             DATE#{isoDate}#NODE#{nodeId}

Attributes:
  nodeId          String
  content         String
  tagName         String
  dailyNoteDate   String
  parentId        String (nullable)
  position        Number
  childCount      Number
  updatedAt       String
```

### Daily note table

```
Table name:     notebase-daily-note
Billing:        On-demand
PK:             USER#{userId}#DATE#{isoDate}
SK:             POS#{paddedPosition}#NODE#{nodeId}

Attributes:
  nodeId          String
  content         String
  depth           Number
  parentId        String (nullable)
  tags            StringSet
  updatedAt       String
```

**Note on position padding:** Sort keys are lexicographically ordered in DynamoDB. Position integers must be zero-padded to a fixed width to sort correctly. Example: `POS#00042#NODE#abc-123`. A width of 8 digits supports up to 99,999,999 sibling nodes per daily note.

---

## Tags (Reference Data)

Tags are created via `TagCreated` events and maintained in a simple reference table. This is not a projection — it is reference data that changes rarely and is used to populate tag autocomplete in the UI.

```sql
CREATE TABLE tags (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_tags_user ON tags (user_id);
```
