# Sequence Diagrams

This document describes the key runtime flows in NoteBase — the write path and the read path. These two paths are explicitly separated (CQRS) and share no runtime dependencies.

---

## Write Path — Tagging a Node

This sequence shows what happens when a user tags a note with `#meeting`.

```
Client          API             Event Store     Message Bus     Projection      Read Store
  |               |                 |               |           Handler            |
  |─POST /nodes/tag──────────────►  |               |               |              |
  |               |                 |               |               |              |
  |               │ validate command|               |               |              |
  |               │ build event     |               |               |              |
  |               |                 |               |               |              |
  |               |──INSERT event──►|               |               |              |
  |               |                 |               |               |              |
  |               |──publish──────────────────────►|               |              |
  |               |                 |               |               |              |
  |◄──202 Accepted────────────────  |               |               |              |
  |               |                 |               |  message delivered            |
  |               |                 |               |───────────────►|              |
  |               |                 |               |               |              |
  |               |                 |               |               │ handle event  |
  |               |                 |               |               │ update state  |
  |               |                 |               |               |              |
  |               |                 |               |               |──upsert node─►|
  |               |                 |               |               |              |
  |               |                 |               |               |◄─ack──────── |
  |               |                 |               |◄──ack─────────|              |
```

### Key points

**202 Accepted, not 200 OK.** The API returns as soon as the event is persisted and published to the queue. It does not wait for the projection to update. This is intentional — the write is durable the moment the event is in the event store. The projection update is a separate concern.

**Eventual consistency window.** The time between the 202 response and the projection being updated depends on the phase. In Phase 1 the projection handler polls the event store on a short interval (configurable, default 500ms), so the window is bounded by the poll interval. In Phase 2 (RabbitMQ) the window is typically under 500ms. The frontend should optimistically update the UI immediately after a successful write without waiting for a read to confirm the projection has updated.

**Idempotency.** Each event has a unique `eventId` (UUID). The projection handler checks `eventId` before processing to avoid duplicate updates if the message is delivered more than once (at-least-once delivery guarantee from RabbitMQ).

**Dead letter handling.** If the projection handler fails to process a message after the configured retry count (default 3), the message is routed to the dead letter queue (`notebase.projections.dlq`) for manual inspection. The event remains in the event store and the projection can be rebuilt from the event log.

---

## Read Path — Opening the Meetings Lens

This sequence shows what happens when a user navigates to the `#meeting` tag lens page.

```
Client          API             Read Store      Event Store
  |               |                 |               |
  |─GET /lens/meeting────────────►  |               |
  |               |                 |               |
  |               |──SELECT nodes──►|               |
  |               |  WHERE tag=meeting              |
  |               |  AND user=current               |
  |               |                 |               |
  |               |◄──rows──────────|               |
  |               |                 |               |
  |◄──200 node list───────────────  |               |
  |               |                 |               |
  |               |                 |      (event store not touched)
```

### Key points

**The event store is never read on the hot path.** Read queries go directly to the pre-computed projection in the read store. This means read latency is constant regardless of how large the event log grows.

**Single indexed lookup.** The tag lens query is a single lookup on the projection table's partition key. In Postgres Phase 1 this is an indexed query. In DynamoDB Phase 2 this is a single `Query` operation on the partition key. Both are single-digit millisecond operations.

**No joins, no recursion.** The projection has already done the work of flattening the node tree and associating tags. The query handler receives a flat list of nodes and the frontend reconstructs the tree from `parentId` references on the client side.

---

## Projection Rebuild — After a Handler Bug Fix

This sequence shows how to rebuild a corrupted or stale projection from the event log.

```
Operator        Projection      Snapshot        Event Store     Read Store
  |             Handler          Store               |               |
  |─trigger rebuild────────────►|               |               |
  |             |               |               |               |
  |             |──get latest──►|               |               |
  |             |   snapshot    |               |               |
  |             |◄──snapshot────|               |               |
  |             |               |               |               |
  |             |──replay from last_event_id────►|               |
  |             |               |               |               |
  |             |◄──event stream─────────────── |               |
  |             |               |               |               |
  |             │ process each event            |               |
  |             │ apply to state                |               |
  |             |               |               |               |
  |             |──write rebuilt projection───────────────────► |
  |             |               |               |               |
  |             |──write new────►               |               |
  |             |   snapshot    |               |               |
  |◄──complete──|               |               |               |
```

### Key points

**Snapshots bound replay time.** Without snapshots, rebuild replays the entire event log from the beginning. With snapshots, only events since the last snapshot are replayed. Snapshot frequency is configurable — the default threshold is 1000 events per user per projection.

**Read store is replaced, not patched.** During rebuild, the projection handler writes the rebuilt state to the read store. In DynamoDB this is a series of PutItem operations. The old projection data is overwritten.

**Zero downtime rebuild.** The API continues serving read requests from the existing (potentially stale) projection during rebuild. Once rebuild completes, reads automatically reflect the corrected state. For cases where the existing projection is so corrupt it should not be served, the read store entries can be deleted first — the frontend will show empty state until rebuild completes.
