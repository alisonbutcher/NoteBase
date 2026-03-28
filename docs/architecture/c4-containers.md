# C4 Level 2 — Container Diagram

Shows the technical building blocks inside NoteBase and how they communicate.

```mermaid
graph TD
    User(["User"])
    Cognito["Amazon Cognito\nAuthentication"]

    subgraph NoteBase ["NoteBase System Boundary"]
        Web["Web Frontend\nNext.js · TypeScript · Vercel"]
        API["API Service\nNestJS · TypeScript · ECS Fargate"]
        PH["Projection Handler\nNestJS Microservice · ECS Fargate"]
        MQ["Message Queue\nRabbitMQ · Amazon MQ"]
        FS["File Storage\nAWS S3"]
        ES[("Event Store\nPostgreSQL · AWS RDS")]
        RS[("Read Store\nDynamoDB")]
        SS[("Snapshot Store\nPostgreSQL · AWS RDS")]
    end

    User -->|HTTPS| Web
    Web -->|REST / HTTPS| API
    API -->|HTTPS| Cognito
    API -->|TCP / SQL| ES
    API -->|AMQP| MQ
    API -->|AWS SDK| RS
    API -->|AWS SDK| FS
    MQ -->|AMQP| PH
    PH -->|AWS SDK| RS
    PH -->|TCP / SQL| SS

    style User fill:#08427B,color:#fff,stroke:#052E56
    style Web fill:#1168BD,color:#fff,stroke:#0B4884
    style API fill:#1168BD,color:#fff,stroke:#0B4884
    style PH fill:#1168BD,color:#fff,stroke:#0B4884
    style MQ fill:#1168BD,color:#fff,stroke:#0B4884
    style FS fill:#1168BD,color:#fff,stroke:#0B4884
    style ES fill:#1168BD,color:#fff,stroke:#0B4884
    style RS fill:#1168BD,color:#fff,stroke:#0B4884
    style SS fill:#1168BD,color:#fff,stroke:#0B4884
    style Cognito fill:#6C6C6C,color:#fff,stroke:#3C3C3C
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
