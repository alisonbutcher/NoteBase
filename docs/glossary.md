# Glossary

This document defines the terms used throughout the NoteBase architecture documentation. Understanding these terms is important for reading the ADRs, sequence diagrams, and data model accurately.

---

## Domain Terms

**Node**
The basic unit of content in NoteBase. A node is a single bullet-point or block of text. Nodes are hierarchical — a node can have a parent node and any number of child nodes. Every node belongs to exactly one daily note.

**Daily note**
A note scoped to a specific calendar date (YYYY-MM-DD). All nodes are written within a daily note. The daily note is the primary writing surface — it is where a user creates and organises their notes for a given day.

**Tag**
A label applied to a node. Tags are identified by name (e.g. `#meeting`, `#decision`). A node can have zero or more tags. Tags are unique per user by name (case-insensitive).

**Tag lens**
A virtual page that aggregates all nodes with a given tag, across all daily notes, and renders them as a coherent, editable surface. The tag lens is a view — nodes are not duplicated. Changes made on a tag lens page are written back to the source node. The tag lens is the core differentiating feature of NoteBase.

**Lens page**
Synonymous with tag lens. The page a user sees when they navigate to a tag (e.g. `/#meeting`).

**Back-link**
A reference from a node displayed on a tag lens page to the originating daily note. Clicking a back-link navigates to the daily note where the node was written.

---

## Architecture Terms

**Event**
An immutable record of a state change that has already occurred. Events are written to the event store and never updated or deleted. Each event has a type (e.g. `NodeCreated`, `NodeTagged`), a payload containing the relevant data, a `userId`, and a timestamp. The past tense naming convention is intentional — an event records what happened, not an instruction to do something.

**Event store**
The append-only database of all events. The event store is the source of truth for the entire system. No other store is authoritative. In NoteBase, the event store is a PostgreSQL table (`events`). See [ADR-003](adr/ADR-003-postgres-event-store.md).

**Command**
An instruction to change state — an intent rather than a fact. A command is validated, processed by a command handler, and results in one or more events being written to the event store. Commands are named in the imperative tense (e.g. `CreateNode`, `TagNode`). If a command fails validation, no event is written and no state change occurs.

**Command handler**
The component that receives a command, validates it, constructs the corresponding domain event, and writes it to the event store. One handler per command type. Command handlers are part of the write path and never read from the read store.

**Query**
A request for current state. Queries are handled by query handlers that read from the read store (projections). Queries do not modify state and do not touch the event store. See [ADR-001](adr/ADR-001-event-sourcing.md).

**Query handler**
The component that receives a query and returns data from the read store. One handler per query type. Query handlers are part of the read path and never write to the event store.

**CQRS (Command Query Responsibility Segregation)**
The architectural pattern that separates the write path (commands → events) from the read path (queries → projections). The two paths share no runtime dependencies and can be scaled independently. See [ADR-001](adr/ADR-001-event-sourcing.md).

**Event sourcing**
The persistence strategy where all state changes are recorded as immutable events rather than updating current state in place. Current state is derived by processing (replaying) the event log through projection handlers. See [ADR-001](adr/ADR-001-event-sourcing.md).

**Projection**
A pre-computed read model derived from the event log. A projection answers a specific, known query efficiently — for example, "what are all the nodes tagged `#meeting` for this user, ordered by date?" Projections are maintained by the projection handler and stored in the read store. Projections are disposable — they can be dropped and rebuilt at any time by replaying the event log.

**Projection handler**
The service that consumes events and updates projections in the read store. In Phase 2, the projection handler is a separate NestJS microservice that consumes events from RabbitMQ. In Phase 1, it polls the event store directly. The projection handler must be idempotent — processing the same event twice must not corrupt the projection.

**Read store**
The database containing projections, optimised for read access. In Phase 1, the read store is PostgreSQL projection tables. In Phase 2+, it is DynamoDB. The read store is not the source of truth — it is derived data and can be rebuilt from the event log. See [ADR-004](adr/ADR-004-dynamodb-read-store.md).

**Replay**
The process of reprocessing events from the event store through a projection handler to rebuild a projection. Replay starts from either the beginning of the event log or from the last snapshot, whichever is more recent.

**Replay cursor**
The `id` of the last event processed by a projection handler. The handler stores this value and uses it to resume processing after a restart: `SELECT * FROM events WHERE id > $lastProcessedId ORDER BY id ASC`.

**Snapshot**
A point-in-time capture of a projection's state at a specific event ID. Snapshots are used to bound replay time — instead of replaying the full event log, the system loads the latest snapshot and replays only subsequent events. Snapshots are a performance optimisation and are never the source of truth. See [ADR-003](adr/ADR-003-postgres-event-store.md).

**Eventual consistency**
The property of the system where a write (event persisted) is not immediately reflected in the read store. The read store is updated asynchronously after the event is processed by the projection handler. The consistency window is typically under 1 second in Phase 1 and under 500ms in Phase 2. The frontend compensates for this with optimistic updates.

**Optimistic update**
A frontend pattern where the UI reflects a write immediately after the command is sent, without waiting for the read store to be updated. If the command fails, the UI rolls back. This pattern masks the eventual consistency window from the user.

**Dead letter queue (DLQ)**
A queue that receives messages that failed processing after the configured retry limit. In NoteBase, the DLQ (`notebase.projections.dlq`) receives events that the projection handler could not process. DLQ messages require manual investigation and replay.

---

## Infrastructure Terms

**IEventStore**
The TypeScript interface abstracting the event store. Implementations: `PostgresEventStore`. See [ADR-006](adr/ADR-006-interface-abstractions.md).

**IMessagePublisher**
The TypeScript interface abstracting event publication to the message queue. Implementations: `NullPublisher` (Phase 1 — no-op, projection handler polls directly), `RabbitMqPublisher` (Phase 2+). See [ADR-006](adr/ADR-006-interface-abstractions.md).

**IProjectionStore**
The TypeScript interface abstracting the read store. Implementations: `PostgresProjectionStore` (Phase 1), `DynamoDbProjectionStore` (Phase 2+). See [ADR-006](adr/ADR-006-interface-abstractions.md).

**NullPublisher**
The Phase 1 implementation of `IMessagePublisher`. The `publish()` method is a no-op. In Phase 1 the projection handler reads directly from the event store via the replay cursor — no message queue is required.

**Phase 1**
The local development and personal-use deployment phase. Runs on a single PostgreSQL instance via Docker Compose. No RabbitMQ, no DynamoDB, no AWS infrastructure. Controlled by `QUEUE_TRANSPORT=null` and `PROJECTION_STORE=postgres`.

**Phase 2**
The early SaaS deployment phase. Runs on AWS with RabbitMQ (Amazon MQ), DynamoDB, RDS Postgres, and ECS Fargate. Controlled by `QUEUE_TRANSPORT=rabbitmq` and `PROJECTION_STORE=dynamodb`.
