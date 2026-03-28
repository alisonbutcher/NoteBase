# NoteBase — Claude Code Handoff Document

This document summarises all decisions made in the architecture planning phase so Claude Code can continue the project without losing context.

---

## What This Project Is

**NoteBase** is a personal note-taking application built around a concept called the **tag lens**. Notes are written in a daily journal format and can be viewed through a virtual page that aggregates all notes with a specific tag — as if those notes had been written on a dedicated page. No data is duplicated; the lens is a query over the event store.

The problem this solves: tools like Tana, Obsidian, Logseq, and Capacities do not allow tagged children to be displayed as a coherent, editable page. NoteBase does.

---

## Two Purposes

1. **Solve a real personal notetaking problem** — build it, use it daily
2. **Portfolio reference project for solution architecture roles** — demonstrates event sourcing, CQRS, AWS architecture, C4 documentation, ADRs

---

## Technology Decisions (Final)

| Concern             | Technology                         | Rationale                                                                               |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| Frontend            | Next.js (TypeScript)               | Familiar, Vercel deployment                                                             |
| Backend API         | NestJS (TypeScript)                | First-class CQRS support via @nestjs/cqrs, RabbitMQ transport via @nestjs/microservices |
| Message queue       | RabbitMQ on Amazon MQ              | AMQP open protocol — vendor portable, not SQS lock-in                                   |
| Event store         | PostgreSQL on RDS                  | Append-only log, sequential replay, snapshot support                                    |
| Read store          | DynamoDB                           | Fixed access patterns, single-digit ms reads at scale                                   |
| Projection handlers | NestJS microservice on ECS Fargate | Persistent RabbitMQ consumer, no cold start                                             |
| File storage        | S3                                 | Attachments                                                                             |
| Auth                | Amazon Cognito                     | Managed auth, JWT                                                                       |
| Monorepo tooling    | pnpm + Turborepo                   | Shared types between frontend and backend                                               |

---

## Architecture Pattern

**Event sourcing + CQRS**

- All state changes are immutable events appended to the event store — never updated or deleted
- Current state is derived from projections maintained by the projection handler
- Write path: Command handler → Event factory → Event store → RabbitMQ → Projection handler → Read store
- Read path: Query handler → Read store (DynamoDB) — event store never touched on reads
- The tag lens is a projection, not a query

**Three interface abstractions** allow phased deployment without code changes:

- `IEventStore` — always Postgres
- `IMessagePublisher` — Phase 1: NullPublisher (no-op; projection handler polls event store directly), Phase 2: RabbitMQ
- `IProjectionStore` — Phase 1: Postgres tables, Phase 2: DynamoDB

Controlled by environment variables:

```env
QUEUE_TRANSPORT=null  # or rabbitmq
PROJECTION_STORE=postgres         # or dynamodb
```

---

## Monorepo Structure (to be scaffolded)

```
NoteBase/
├── apps/
│   ├── web/                    # Next.js frontend
│   └── api/                    # NestJS backend + projection handler
├── packages/
│   └── shared/                 # Shared TypeScript types, interfaces, events
├── infrastructure/
│   └── docker-compose.yml      # Local development services
├── docs/
│   ├── README.md
│   ├── data-model.md
│   ├── local-development.md
│   ├── sequences.md
│   ├── architecture/
│   │   ├── c4-context.md
│   │   ├── c4-containers.md
│   │   └── c4-components-api.md
│   └── adr/
│       ├── ADR-001-event-sourcing.md
│       ├── ADR-002-nestjs-backend.md
│       ├── ADR-003-postgres-event-store.md
│       ├── ADR-004-dynamodb-read-store.md
│       ├── ADR-005-rabbitmq-over-sqs.md
│       └── ADR-006-interface-abstractions.md
└── .claude/
    └── skills/                 # Claude Code skills
```

---

## Shared Package — Core Types

The `packages/shared` package must define:

```typescript
// Domain events
interface DomainEvent {
  eventId: string;
  userId: string;
  occurredAt: string;
}

// Typed events
interface NodeCreated extends DomainEvent {
  nodeId: string;
  content: string;
  parentId: string | null;
  dailyNoteDate: string;
  position: number;
}
interface NodeEdited extends DomainEvent {
  nodeId: string;
  content: string;
}
interface NodeTagged extends DomainEvent {
  nodeId: string;
  tagId: string;
  tagName: string;
}
interface NodeUntagged extends DomainEvent {
  nodeId: string;
  tagId: string;
}
interface NodeMoved extends DomainEvent {
  nodeId: string;
  newParentId: string | null;
  newPosition: number;
}
interface NodeDeleted extends DomainEvent {
  nodeId: string;
  softDelete: boolean;
}
interface TagCreated extends DomainEvent {
  tagId: string;
  tagName: string;
  color: string | null;
}

// Infrastructure interfaces
interface IEventStore {
  append(event: DomainEvent): Promise<void>;
  replay(fromEventId?: bigint): AsyncIterable<DomainEvent>;
  getLatestEventId(): Promise<bigint>;
}

interface IMessagePublisher {
  publish(event: DomainEvent): Promise<void>;
}

interface IProjectionStore {
  getTagLens(
    userId: string,
    tagId: string,
    options?: QueryOptions,
  ): Promise<NodeProjection[]>;
  getDailyNote(userId: string, date: string): Promise<NodeProjection[]>;
  upsertNode(projection: NodeProjection): Promise<void>;
  deleteNode(nodeId: string): Promise<void>;
}

// Read model
interface NodeProjection {
  nodeId: string;
  userId: string;
  content: string;
  dailyNoteDate: string;
  parentId: string | null;
  position: number;
  depth: number;
  tags: string[];
  updatedAt: string;
}
```

---

## Database Schemas

### Postgres — Event Store

```sql
CREATE TABLE events (
  id          BIGSERIAL PRIMARY KEY,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  user_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_user_created ON events (user_id, created_at);
CREATE INDEX idx_events_user_id_asc ON events (user_id, id ASC);

CREATE TABLE snapshots (
  id               BIGSERIAL PRIMARY KEY,
  projection_name  TEXT NOT NULL,
  user_id          UUID NOT NULL,
  state            JSONB NOT NULL,
  last_event_id    BIGINT NOT NULL REFERENCES events(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);
```

### Postgres — Phase 1 Projection Tables

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
```

---

## Docker Compose (Local Development)

Services needed locally:

- Postgres on port 5432
- RabbitMQ on ports 5672 (AMQP) and 15672 (management UI)
- DynamoDB Local on port 8000
- LocalStack (S3) on port 4566

Phase 1 env vars use `QUEUE_TRANSPORT=null` and `PROJECTION_STORE=postgres`. RabbitMQ and DynamoDB are available in Docker Compose for Phase 2 but not active in Phase 1.

---

## NestJS Modules to Create

### API service (`apps/api`)

- `AppModule` — root module, wires implementations based on env vars
- `CommandModule` — registers all command handlers via @nestjs/cqrs CommandBus
- `QueryModule` — registers all query handlers via @nestjs/cqrs QueryBus
- `EventStoreModule` — provides PostgresEventStore implementing IEventStore
- `MessagePublisherModule` — provides NullPublisher or RabbitMqPublisher based on QUEUE_TRANSPORT
- `ProjectionStoreModule` — provides PostgresProjectionStore or DynamoDbProjectionStore based on PROJECTION_STORE
- `HealthModule` — GET /health endpoint

### Command handlers to implement first

- `CreateNodeHandler` — handles CreateNodeCommand, creates NodeCreated event
- `TagNodeHandler` — handles TagNodeCommand, creates NodeTagged event
- `EditNodeHandler` — handles EditNodeCommand, creates NodeEdited event

### Query handlers to implement first

- `GetTagLensHandler` — handles GetTagLensQuery, reads from IProjectionStore
- `GetDailyNoteHandler` — handles GetDailyNoteQuery, reads from IProjectionStore

---

## Excalidraw Diagrams — TODO

Install the excalidraw diagram skill for Claude Code and regenerate the C4 diagrams as editable `.excalidraw` files:

```bash
git clone https://github.com/coleam00/excalidraw-diagram-skill.git
cp -r excalidraw-diagram-skill .claude/skills/excalidraw-diagram
```

Then ask Claude Code: "Set up the Excalidraw diagram skill renderer" and generate:

- `docs/architecture/c4-context.excalidraw`
- `docs/architecture/c4-containers.excalidraw`
- `docs/architecture/c4-components.excalidraw`

These can be opened and edited in Obsidian with the Excalidraw plugin.

---

## First Session Goals for Claude Code

1. Scaffold the monorepo with pnpm workspaces and Turborepo
2. Create `packages/shared` with all interfaces and event types
3. Scaffold `apps/api` as a NestJS application with the module structure above
4. Scaffold `apps/web` as a Next.js application
5. Create `infrastructure/docker-compose.yml`
6. Create `infrastructure/sql/init.sql` with the Postgres schemas above
7. Install the Excalidraw skill and generate the C4 diagrams
8. Copy the existing docs from this chat into `docs/`

## Starting Prompt for Claude Code

```
Read HANDOFF.md first. This is a project called NoteBase — a note-taking app
built on event sourcing and CQRS. The architecture decisions are all documented
in HANDOFF.md. Your first task is to scaffold the monorepo structure exactly
as described, create the shared package with all the TypeScript interfaces and
event types, and scaffold the NestJS API with the module structure. Do not
deviate from the architecture decisions in the document without asking first.
```
