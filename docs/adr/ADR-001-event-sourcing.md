# ADR-001 — Event sourcing as the persistence strategy

**Status:** Accepted
**Date:** 2025-03
**Author:** Solution Architecture

---

## Context

The core feature of NoteBase is the tag lens — a virtual page that aggregates nodes from across multiple daily notes by tag and renders them as first-class, editable entries. This requires maintaining multiple simultaneous views of the same underlying data.

A traditional CRUD approach presents a structural problem: the same node must appear in the daily note view and in one or more tag lens views simultaneously. The options under a CRUD model are:

- **Duplicate data** — write the node to multiple tables, creating sync problems when edits occur
- **Compute on demand** — derive the tag lens at query time via joins or recursive queries, creating performance and complexity problems at scale
- **Materialised views** — maintain pre-computed views, but updates require careful cache invalidation logic tied to the write path

None of these options cleanly support adding new views of existing data without schema migration. If a new lens type is introduced (for example a person lens that aggregates by mentioned name), existing data must be backfilled.

The system also has implicit requirements that a CRUD model satisfies poorly:

- **Undo history** — users expect to recover previous states of notes
- **Audit trail** — understanding what changed and when is valuable for debugging and trust
- **Eventual multi-device sync** — writes from multiple devices need a conflict resolution strategy

---

## Decision

We will use **event sourcing** as the primary persistence strategy.

All state changes are recorded as immutable, typed events in an append-only event store. No event is ever updated or deleted. Current state is not stored directly — it is derived by processing the event log through projection handlers that maintain pre-computed read models.

The write path is:

```
User action → Command handler → Event factory → Event store → Message queue → Projection handler → Read store
```

The read path is:

```
User request → Query handler → Read store → Response
```

These two paths share no runtime dependencies. The read store is updated asynchronously by the projection engine after events are published to the queue.

Core event types for the initial implementation:

| Event | Payload |
|---|---|
| `NodeCreated` | nodeId, content, dailyNoteDate, parentId |
| `NodeEdited` | nodeId, content |
| `NodeTagged` | nodeId, tagId |
| `NodeUntagged` | nodeId, tagId |
| `NodeMoved` | nodeId, newParentId |
| `NodeDeleted` | nodeId |
| `SnapshotTaken` | projectionName, state, lastEventId |

---

## Consequences

### Positive

- New views of existing data are added by writing a new projection handler and replaying the event log — no data migration required
- Undo history, audit trails, and time-travel debugging are available at no additional cost — the data is already there
- Read and write paths scale independently
- Projections are rebuildable at any time — a bug in a projection handler is recoverable by fixing the handler and replaying
- The eventual consistency model maps naturally to future multi-device sync requirements
- The event log is conceptually equivalent to a Git commit history — a mental model that is easy to communicate to stakeholders

### Negative

- Higher initial complexity than a CRUD approach — all contributors must understand the event/projection model
- Eventual consistency between the event store and projections introduces a small window (typically under 100ms) where a write is not yet reflected in the read model
- Ad hoc queries against current state require projections to exist — the event store alone is not easily queryable for current state
- The event log grows indefinitely — snapshotting is required as a maintenance concern (see ADR-003)

---

## Alternatives Considered

**Standard CRUD with a closure table**
Rejected. The closure table pattern handles the hierarchy query problem but does not address the need to maintain multiple simultaneous views without duplication. Adding a new lens type requires schema migration and backfill. Write contention under load is a concern as every node move requires bulk updates to the closure table.

**Document database (MongoDB)**
Rejected. The core query pattern — filtered tree traversal by tag across multiple parent documents — is a relational and hierarchical problem. Document databases require either heavy denormalisation or multiple round trips to reconstruct the node tree. The access pattern fits a relational model more naturally.

**Graph database (Neo4j)**
Rejected. Graph databases excel at relationship traversal across many hops. The NoteBase query pattern is a shallow, filtered subtree retrieval — not a graph traversal problem. The operational overhead of running Neo4j and the niche nature of Cypher as a queryable skill make this an unfavourable tradeoff.
