# C4 Level 3 — Component Diagram: API Service

Shows the internal components of the NestJS API service container.

```mermaid
C4Component
    title Component Diagram for NoteBase API Service

    Person(user, "User", "Via web frontend")

    Container_Boundary(api, "API Service — NestJS on ECS Fargate") {

        Component(middleware, "Middleware Pipeline", "NestJS, JWT Guard", "Handles auth validation, rate limiting, and request routing. Validates Cognito JWTs on all protected routes.")

        Component(command_handlers, "Command Handlers", "NestJS CQRS, TypeScript", "Handles all write operations. One handler per command type: CreateNodeHandler, EditNodeHandler, TagNodeHandler, MoveNodeHandler, DeleteNodeHandler.")

        Component(query_handlers, "Query Handlers", "NestJS CQRS, TypeScript", "Handles all read operations. One handler per query type: GetTagLensHandler, GetDailyNoteHandler, GetNodeChildrenHandler.")

        Component(event_factory, "Event Factory", "TypeScript", "Constructs typed, immutable domain event objects from validated commands. Assigns eventId, userId, and occurredAt.")

        Component(event_store_writer, "Event Store Writer", "TypeScript, IEventStore", "Appends events to the Postgres event store. Implements IEventStore interface — swappable per ADR-006.")

        Component(message_publisher, "Message Publisher", "TypeScript, IMessagePublisher", "Publishes events to the message queue after persistence. Implements IMessagePublisher interface. Phase 1: Postgres NOTIFY. Phase 2: RabbitMQ AMQP.")

        Component(projection_reader, "Projection Reader", "TypeScript, IProjectionStore", "Reads pre-computed projections from the read store. Implements IProjectionStore interface. Phase 1: Postgres tables. Phase 2: DynamoDB.")
    }

    Container_Boundary(projection_svc, "Projection Handler Service — NestJS Microservice") {

        Component(queue_consumer, "Queue Consumer", "NestJS Microservices, AMQP", "Persistent RabbitMQ consumer. Routes incoming events to the correct projection handler by event type.")

        Component(tag_lens_handler, "Tag Lens Handler", "TypeScript", "Processes NodeCreated, NodeTagged, NodeUntagged, NodeEdited, NodeDeleted events. Maintains the tag lens projection in the read store.")

        Component(daily_note_handler, "Daily Note Handler", "TypeScript", "Processes NodeCreated, NodeEdited, NodeMoved, NodeDeleted events. Maintains the daily note projection in the read store.")

        Component(snapshot_manager, "Snapshot Manager", "TypeScript", "Monitors event gap since last snapshot. Triggers snapshot writes when gap exceeds threshold. Manages snapshot lifecycle.")
    }

    ContainerDb(event_store, "Event Store", "PostgreSQL")
    ContainerDb(read_store, "Read Store", "DynamoDB")
    ContainerDb(snapshot_store, "Snapshot Store", "PostgreSQL")
    Container(queue, "Message Queue", "RabbitMQ")

    Rel(user, middleware, "HTTP requests", "REST")
    Rel(middleware, command_handlers, "Validated write requests")
    Rel(middleware, query_handlers, "Validated read requests")
    Rel(command_handlers, event_factory, "Creates events from commands")
    Rel(event_factory, event_store_writer, "Passes typed events")
    Rel(event_store_writer, event_store, "INSERT", "SQL")
    Rel(event_store_writer, message_publisher, "Triggers publish after persist")
    Rel(message_publisher, queue, "Publishes events", "AMQP")
    Rel(query_handlers, projection_reader, "Reads projections")
    Rel(projection_reader, read_store, "Query", "AWS SDK")
    Rel(queue, queue_consumer, "Delivers events", "AMQP")
    Rel(queue_consumer, tag_lens_handler, "Routes tagged events")
    Rel(queue_consumer, daily_note_handler, "Routes node events")
    Rel(tag_lens_handler, read_store, "Upserts projection", "AWS SDK")
    Rel(daily_note_handler, read_store, "Upserts projection", "AWS SDK")
    Rel(snapshot_manager, snapshot_store, "Writes snapshots", "SQL")
```

## Component Responsibilities

### API Service

| Component | Responsibility | Interface |
|---|---|---|
| Middleware pipeline | Auth, rate limiting, routing | — |
| Command handlers | One per command type, validates and orchestrates write | — |
| Query handlers | One per query type, reads from projection store | — |
| Event factory | Constructs immutable typed domain events | — |
| Event store writer | Appends to Postgres events table | `IEventStore` |
| Message publisher | Publishes to queue after persist | `IMessagePublisher` |
| Projection reader | Reads from read store | `IProjectionStore` |

### Projection Handler Service

| Component | Responsibility |
|---|---|
| Queue consumer | AMQP listener, routes events by type |
| Tag lens handler | Maintains tag-filtered node projections |
| Daily note handler | Maintains date-ordered node projections |
| Snapshot manager | Periodic state snapshots to bound replay time |

## Key Design Decisions

**Command/query separation is enforced at the component level.** Command handlers never read from the read store. Query handlers never write to the event store. This boundary is maintained by convention and enforced in code review.

**Interface boundaries isolate infrastructure.** The `IEventStore`, `IMessagePublisher`, and `IProjectionStore` interfaces mean no component in the application layer imports directly from a database driver or AWS SDK. All infrastructure dependencies are injected.

**Projection handlers are idempotent.** Each event carries a unique `eventId`. Handlers check this ID before processing to safely handle redelivered messages from the at-least-once queue.
