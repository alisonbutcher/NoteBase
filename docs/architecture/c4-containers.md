# C4 Level 2 — Container Diagram

Shows the technical building blocks inside NoteBase and how they communicate.

```mermaid
C4Container
    title Container Diagram for NoteBase

    Person(user, "User", "Writes notes, views tag lenses")

    System_Boundary(notebase, "NoteBase") {

        Container(web, "Web Frontend", "Next.js, TypeScript", "Renders daily notes and tag lens pages. TipTap editor for note authoring.")

        Container(api, "API Service", "NestJS, TypeScript, ECS Fargate", "Handles all commands and queries. Implements CQRS pattern with explicit command and query handlers.")

        Container(projection_handler, "Projection Handler", "NestJS Microservice, TypeScript, ECS Fargate", "Consumes events from the queue and updates read store projections. Runs as a persistent RabbitMQ consumer.")

        ContainerDb(event_store, "Event Store", "PostgreSQL, AWS RDS", "Append-only log of all domain events. Source of truth for the entire system. Never updated or deleted from.")

        ContainerDb(read_store, "Read Store", "DynamoDB", "Pre-computed projections optimised for read access. Tag lens projection and daily note projection. Rebuilt from event log at any time.")

        ContainerDb(snapshot_store, "Snapshot Store", "PostgreSQL, AWS RDS", "Periodic snapshots of projection state. Bounds event replay time during projection rebuild.")

        Container(queue, "Message Queue", "RabbitMQ, Amazon MQ", "Decouples the API write path from projection handlers. Guarantees delivery via AMQP acknowledgement model. Dead letter queue for failed messages.")

        Container(file_store, "File Storage", "AWS S3", "Stores note attachments and uploaded files.")
    }

    System_Ext(cognito, "Amazon Cognito", "Authentication")

    Rel(user, web, "Uses", "HTTPS")
    Rel(web, api, "Sends commands and queries", "REST / HTTPS")
    Rel(api, cognito, "Validates JWT tokens via", "HTTPS")
    Rel(api, event_store, "Appends domain events", "TCP / SQL")
    Rel(api, queue, "Publishes events after persistence", "AMQP")
    Rel(api, read_store, "Queries projections", "AWS SDK")
    Rel(api, file_store, "Generates presigned upload URLs", "AWS SDK")
    Rel(queue, projection_handler, "Delivers events to", "AMQP")
    Rel(projection_handler, read_store, "Writes updated projections", "AWS SDK")
    Rel(projection_handler, snapshot_store, "Writes periodic snapshots", "TCP / SQL")
```

## Phase 1 Substitutions

In local development and the personal-use phase, infrastructure is simplified via interface abstractions (see ADR-006). No application code changes are required.

| Production Component | Phase 1 Equivalent |
|---|---|
| Amazon MQ (RabbitMQ) | No queue — projection handler polls event store directly |
| DynamoDB read store | Postgres projection tables |
| ECS Fargate (projection handler) | Background thread in API process |
| AWS S3 | LocalStack S3 |
| Amazon Cognito | Local JWT mock |

## Communication Protocols

| From | To | Protocol | Notes |
|---|---|---|---|
| Web frontend | API | REST over HTTPS | JSON request/response |
| API | Event store | TCP / SQL | Postgres driver, connection pool |
| API | Queue | AMQP | Publish after event persist — fire and forget |
| Queue | Projection handler | AMQP | At-least-once delivery, explicit ack |
| Projection handler | Read store | AWS SDK | DynamoDB PutItem operations |
| API | Read store | AWS SDK | DynamoDB Query operations |
