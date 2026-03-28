# C4 Level 3 — Component Diagram: API Service

Shows the internal components of the NestJS API service container.

### API Service

```mermaid
graph TD
    User(["User\nvia web frontend"])
    ES[("Event Store\nPostgreSQL")]
    MQ["Message Queue\nRabbitMQ"]
    RS[("Read Store\nDynamoDB")]

    subgraph API ["API Service — NestJS on ECS Fargate"]
        MW["Middleware Pipeline\nNestJS · JWT Guard\nAuth validation · rate limiting · routing"]
        CH["Command Handlers\nNestJS CQRS\nCreateNode · EditNode · TagNode · MoveNode · DeleteNode"]
        QH["Query Handlers\nNestJS CQRS\nGetTagLens · GetDailyNote · GetNodeChildren"]
        EF["Event Factory\nTypeScript\nConstructs typed immutable domain events"]
        ESW["Event Store Writer\nIEventStore\nAppends events to Postgres"]
        MP["Message Publisher\nIMessagePublisher\nPhase 1: NullPublisher · Phase 2: RabbitMQ"]
        PR["Projection Reader\nIProjectionStore\nPhase 1: Postgres · Phase 2: DynamoDB"]
    end

    User -->|REST| MW
    MW --> CH
    MW --> QH
    CH --> EF
    EF --> ESW
    ESW -->|INSERT SQL| ES
    ESW --> MP
    MP -->|AMQP| MQ
    QH --> PR
    PR -->|AWS SDK| RS

    style User fill:#08427B,color:#fff,stroke:#052E56
    style MW fill:#1168BD,color:#fff,stroke:#0B4884
    style CH fill:#1168BD,color:#fff,stroke:#0B4884
    style QH fill:#1168BD,color:#fff,stroke:#0B4884
    style EF fill:#1168BD,color:#fff,stroke:#0B4884
    style ESW fill:#1168BD,color:#fff,stroke:#0B4884
    style MP fill:#1168BD,color:#fff,stroke:#0B4884
    style PR fill:#1168BD,color:#fff,stroke:#0B4884
    style ES fill:#6C6C6C,color:#fff,stroke:#3C3C3C
    style MQ fill:#6C6C6C,color:#fff,stroke:#3C3C3C
    style RS fill:#6C6C6C,color:#fff,stroke:#3C3C3C
```

### Projection Handler Service

```mermaid
graph TD
    MQ["Message Queue\nRabbitMQ"]
    RS[("Read Store\nDynamoDB")]
    SS[("Snapshot Store\nPostgreSQL")]

    subgraph PH ["Projection Handler Service — NestJS Microservice"]
        QC["Queue Consumer\nNestJS Microservices · AMQP\nRoutes events by type"]
        TLH["Tag Lens Handler\nTypeScript\nProcesses NodeCreated · NodeTagged · NodeUntagged · NodeEdited · NodeDeleted"]
        DNH["Daily Note Handler\nTypeScript\nProcesses NodeCreated · NodeEdited · NodeMoved · NodeDeleted"]
        SM["Snapshot Manager\nTypeScript\nPeriodic state snapshots · bounds replay time"]
    end

    MQ -->|AMQP| QC
    QC --> TLH
    QC --> DNH
    TLH -->|Upsert AWS SDK| RS
    DNH -->|Upsert AWS SDK| RS
    SM -->|Write SQL| SS

    style QC fill:#1168BD,color:#fff,stroke:#0B4884
    style TLH fill:#1168BD,color:#fff,stroke:#0B4884
    style DNH fill:#1168BD,color:#fff,stroke:#0B4884
    style SM fill:#1168BD,color:#fff,stroke:#0B4884
    style MQ fill:#6C6C6C,color:#fff,stroke:#3C3C3C
    style RS fill:#6C6C6C,color:#fff,stroke:#3C3C3C
    style SS fill:#6C6C6C,color:#fff,stroke:#3C3C3C
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
