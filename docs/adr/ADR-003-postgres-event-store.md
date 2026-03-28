# ADR-003 — PostgreSQL as the event store

**Status:** Accepted
**Date:** 2025-03
**Author:** Solution Architecture

---

## Context

The event store is the source of truth for the entire system. All events are appended to it, and all projections are derived from it. The event store has a specific and narrow set of access patterns:

- **Append** — insert a new event row (high frequency, must be fast and reliable)
- **Sequential replay** — read all events from a given position forward (used for projection rebuild and snapshotting)
- **Point-in-time replay** — read all events up to a given timestamp or event ID (used for debugging and time-travel)

The event store is explicitly not used for ad hoc queries against current state — that concern belongs to the read store (see ADR-004).

The event store also needs to notify the message queue when new events are appended, to trigger projection handler processing.

---

## Decision

We will use **PostgreSQL on AWS RDS** as the event store.

The events table schema is intentionally simple:

```sql
CREATE TABLE events (
  id          BIGSERIAL PRIMARY KEY,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  user_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_user_created  ON events (user_id, created_at);
CREATE INDEX idx_events_user_id_asc   ON events (user_id, id ASC);
CREATE INDEX idx_events_type          ON events (type);
```

The snapshot table supports periodic state compaction to avoid full event log replay:

```sql
CREATE TABLE snapshots (
  id              BIGSERIAL PRIMARY KEY,
  projection_name TEXT NOT NULL,
  user_id         UUID NOT NULL,
  state           JSONB NOT NULL,
  last_event_id   BIGINT NOT NULL REFERENCES events(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_lookup
  ON snapshots (projection_name, user_id, last_event_id DESC);
```

**On snapshotting:** The event log grows indefinitely. Without snapshotting, projection rebuild time grows linearly with event count. A snapshot records the complete projection state at a given event ID. Rebuilding then loads the latest snapshot and replays only subsequent events. Snapshots are triggered automatically when the gap between the latest snapshot and the current event count exceeds a configurable threshold (default: 1000 events). Snapshots are never the source of truth — they are a performance optimisation. The event log remains authoritative.

**On polling for Phase 1:** In the local development phase, the projection handler polls the events table directly rather than consuming from a message queue. It tracks the last processed event `id` as a cursor and periodically runs `SELECT * FROM events WHERE id > $lastProcessedId ORDER BY id ASC`. This is a reliable pattern because the events table is an append-only log — the cursor never needs to move backwards and no notifications can be dropped. In Phase 2 this is replaced by RabbitMQ without changes to application code: `IMessagePublisher` becomes active (publishing events to the queue after persistence) and the projection handler switches to consuming from the queue rather than polling the event store directly (see ADR-006).

---

## Consequences

### Positive

- Sequential append is one of Postgres's strongest operations — reliable, transactional, and fast
- The event log and snapshot table coexist in the same database instance in Phase 1, simplifying local development
- Postgres JSONB provides flexible payload storage while remaining queryable for debugging
- RDS provides managed backups, point-in-time recovery, and read replicas without operational overhead
- SQL is a broadly understood skill — the event store schema is readable and maintainable by any developer

### Negative

- Postgres is not purpose-built as an event store — dedicated options like EventStoreDB provide richer event sourcing semantics (streams, subscriptions, projections) natively
- At very high event volumes, a single RDS instance becomes a write bottleneck — partitioning or migration to a dedicated event store would be required
- The polling interval in Phase 1 introduces a small additional latency window compared to event-driven notification — acceptable for local development

---

## Alternatives Considered

**EventStoreDB**
A purpose-built event store with native support for streams, competing consumers, and persistent subscriptions. Rejected for the initial implementation because it introduces an unfamiliar technology with its own operational model, and the Postgres event store satisfies all requirements at the expected scale. EventStoreDB remains a valid migration target if event volumes justify it.

**DynamoDB for the event store**
Rejected. DynamoDB is optimised for key-value and range lookups on known access patterns. Sequential replay of an event log — reading rows in insertion order, potentially replaying millions of events — is a poor fit for DynamoDB's data model. Postgres's sequential scan performance on an ordered primary key is significantly better for this pattern.

**Apache Kafka as the event store**
Kafka is a distributed log — architecturally similar to an event store. Some teams use Kafka as both the event transport and the event store, eliminating the separate Postgres event store entirely. Rejected because Kafka introduces significant operational complexity (MSK on AWS is manageable but not trivial), and the replay semantics require careful consumer group management. Remains a valid architectural evolution if the system grows to warrant it.
