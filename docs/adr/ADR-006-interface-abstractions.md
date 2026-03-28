# ADR-006 — Interface abstractions for phased deployment

**Status:** Accepted
**Date:** 2025-03
**Author:** Solution Architecture

---

## Context

The target architecture involves multiple infrastructure components — RabbitMQ, DynamoDB, RDS Postgres — that are not appropriate for local development or the initial personal-use phase. Running the full AWS stack locally is expensive, complex, and slows down the development feedback loop.

At the same time, the architecture should not be designed as two separate systems (a simple local version and a complex production version) — that approach leads to bugs that only manifest in production and undermines confidence in the local development environment as a representative test surface.

The goal is a single codebase that runs simply in Phase 1 and runs the full target architecture in Phase 2 and beyond, with the transition requiring only infrastructure configuration changes and no application code changes.

---

## Decision

We will define explicit TypeScript interfaces for the three infrastructure concerns that vary between deployment phases, and provide multiple implementations:

**`IEventStore`** — appending events and replaying them

```typescript
export interface IEventStore {
  append(event: DomainEvent): Promise<void>;
  replay(fromEventId?: bigint): AsyncIterable<DomainEvent>;
  getLatestEventId(): Promise<bigint>;
}
```

Implementations:
- `PostgresEventStore` — used in all phases (Postgres is always the event store)

**`IMessagePublisher`** — publishing events to the message bus after they are persisted

```typescript
export interface IMessagePublisher {
  publish(event: DomainEvent): Promise<void>;
}
```

Implementations:
- `NullPublisher` — no-op implementation (Phase 1). In Phase 1 the projection handler polls the event store directly using the replay cursor, so no message publishing is required. The interface is satisfied but publish() does nothing.
- `RabbitMqPublisher` — publishes to RabbitMQ via AMQP (Phase 2+)

**`IProjectionStore`** — reading and writing projection state

```typescript
export interface IProjectionStore {
  getTagLens(userId: string, tagId: string, options?: QueryOptions): Promise<NodeProjection[]>;
  getDailyNote(userId: string, date: string): Promise<NodeProjection[]>;
  upsertNode(projection: NodeProjection): Promise<void>;
  deleteNode(nodeId: string): Promise<void>;
}
```

Implementations:
- `PostgresProjectionStore` — projection tables in the same Postgres instance (Phase 1)
- `DynamoDbProjectionStore` — DynamoDB tables (Phase 2+)

**Dependency injection wiring** — NestJS's dependency injection system allows implementations to be swapped via module configuration driven by environment variables:

```typescript
// app.module.ts
const messagePublisher = process.env.QUEUE_TRANSPORT === 'rabbitmq'
  ? RabbitMqPublisher
  : NullPublisher;

const projectionStore = process.env.PROJECTION_STORE === 'dynamodb'
  ? DynamoDbProjectionStore
  : PostgresProjectionStore;
```

This means the Phase 1 local environment runs with:

```env
QUEUE_TRANSPORT=null
PROJECTION_STORE=postgres
```

And the Phase 2 AWS environment runs with:

```env
QUEUE_TRANSPORT=rabbitmq
PROJECTION_STORE=dynamodb
```

No application code changes. No separate codebase. The interfaces enforce that both implementations satisfy the same contract, and the integration tests run against both implementations in CI.

---

## Consequences

### Positive

- Single codebase runs in all deployment phases
- Infrastructure can be upgraded incrementally without application code changes
- The interfaces make the architectural boundaries explicit and enforced by the type system
- Integration tests can run against lightweight implementations in CI without cloud infrastructure
- New implementations (for example a Redis implementation of `IProjectionStore` for caching) can be added without touching the application layer

### Negative

- Defining interfaces and maintaining multiple implementations adds upfront development overhead compared to coding directly against a specific technology
- Developers must understand the interface contract and resist the temptation to use implementation-specific features that would break the abstraction
- The environment variable wiring adds a layer of indirection that can be confusing when debugging which implementation is active

---

## Implementation Notes

The shared types package (`packages/shared`) contains:

- `DomainEvent` — the base event type and all typed event subtypes
- `IEventStore`, `IMessagePublisher`, `IProjectionStore` — the interface definitions
- `NodeProjection` — the read model type shared between projection store implementations and query handlers

All implementations live in the `apps/api` package under `src/infrastructure/`. The application layer (`src/domain/`, `src/application/`) imports only from `packages/shared` and never directly from infrastructure implementations.
