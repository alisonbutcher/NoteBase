# NoteBase — Architecture Documentation

## Overview

NoteBase is a personal note-taking system built around a core concept called the **tag lens** — the ability to write notes in a daily journal format and view any subset of those notes as if they were written on a dedicated page, without duplicating data.

The system is designed as a reference implementation of event sourcing and CQRS patterns, deployed on AWS using containerised workloads, a managed message queue, and separate database technologies matched to their access patterns.

---

## The Problem

Existing outliner tools (Tana, Logseq, Obsidian, Capacities) share a common limitation: notes tagged with a particular type can be searched and found, but cannot be rendered as a coherent, editable page. The tag lens feature solves this — a page for `#meeting` renders every meeting node from every daily note as first-class entries, fully editable in place, with changes written back to the source record.

---

## Architecture Goals

- **Event sourced** — all state changes are immutable events; current state is always derivable from the log
- **CQRS** — read and write paths are explicitly separated, each optimised independently
- **Decoupled** — components communicate via a message queue; no direct coupling between the API and projection handlers
- **Evolvable** — interface abstractions allow the system to start simple and adopt more complex infrastructure as load justifies it
- **Vendor portable** — open protocols (AMQP) preferred over proprietary managed services where possible

---

## Technology Decisions

| Concern | Technology | Rationale |
|---|---|---|
| Frontend | Next.js (TypeScript) | Familiar, strong ecosystem, Vercel deployment |
| Backend API | NestJS (TypeScript) | Structured CQRS support, monorepo type sharing |
| Message queue | RabbitMQ on Amazon MQ | AMQP open protocol, vendor portable |
| Event store | PostgreSQL on RDS | Sequential append and replay, relational integrity |
| Read store | DynamoDB | Fixed access patterns, single-digit ms reads at scale |
| Projection handlers | NestJS microservice on ECS Fargate | RabbitMQ consumer, persistent process, no cold start |
| File storage | S3 | Standard object storage for attachments |
| Auth | Amazon Cognito | Managed JWT issuance and user management |

---

## Documentation Index

### Requirements

| Document | Description |
|---|---|
| [Functional Requirements](functional-requirements.md) | Use cases, business rules, and a traceability matrix linking requirements to architecture decisions |
| [Non-Functional Requirements](non-functional-requirements.md) | Availability targets, latency SLOs, RPO/RTO, scalability, security, and observability requirements |

### API

| Document | Description |
|---|---|
| [API Specification](api-specification.md) | REST endpoints for all commands and queries, request/response shapes, and conventions |

### Architecture

| Document | Description |
|---|---|
| [C4 Level 1 — System Context](architecture/c4-context.md) | NoteBase and the external systems it depends on |
| [C4 Level 2 — Containers](architecture/c4-containers.md) | Internal building blocks and how they communicate; Phase 1 substitutions |
| [C4 Level 3 — API Components](architecture/c4-components-api.md) | Internal components of the NestJS API and projection handler |
| [AWS Deployment Topology](aws-deployment-topology.md) | VPC layout, subnet design, security groups, component specs, and cost model |
| [Security Architecture](security-architecture.md) | Authentication and authorisation flows, network security, IAM policies, and threat model |
| [Sequence Diagrams](sequences.md) | Write path, read path, and projection rebuild flows |

### Data

| Document | Description |
|---|---|
| [Data Model](data-model.md) | Event store schemas, projection table schemas, DynamoDB table designs, and event catalogue |

### Architecture Decision Records

| ADR | Decision |
|---|---|
| [ADR-001](adr/ADR-001-event-sourcing.md) | Event sourcing as the persistence strategy |
| [ADR-002](adr/ADR-002-nestjs-backend.md) | NestJS as the backend framework |
| [ADR-003](adr/ADR-003-postgres-event-store.md) | PostgreSQL as the event store |
| [ADR-004](adr/ADR-004-dynamodb-read-store.md) | DynamoDB as the read store |
| [ADR-005](adr/ADR-005-rabbitmq-over-sqs.md) | RabbitMQ on Amazon MQ over AWS SQS |
| [ADR-006](adr/ADR-006-interface-abstractions.md) | Interface abstractions for phased deployment |

### Development

| Document | Description |
|---|---|
| [Local Development](local-development.md) | Docker Compose setup, environment variables, and how to switch between Phase 1 and Phase 2 |

### Reference

| Document | Description |
|---|---|
| [Risk Register](risk-register.md) | Architectural risks with likelihood, impact, mitigation strategies, and monitoring triggers |
| [Glossary](glossary.md) | Definitions for domain and architecture terms used throughout the documentation |

---

## Repository Structure

```
notebase/
├── docs/                          # this directory
│   ├── README.md                  # this file
│   ├── functional-requirements.md
│   ├── non-functional-requirements.md
│   ├── data-model.md
│   ├── sequences.md
│   ├── local-development.md
│   ├── security-architecture.md
│   ├── aws-deployment-topology.md
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
├── apps/
│   ├── web/                       # Next.js frontend
│   └── api/                       # NestJS backend
├── packages/
│   └── shared/                    # shared TypeScript types and events
└── infrastructure/
    ├── docker-compose.yml
    └── sql/
        └── init.sql
```

---

## Suggested Reading Order

For someone new to the project:

1. [Functional Requirements](functional-requirements.md) — understand what the system does and why
2. [C4 Level 1 — System Context](architecture/c4-context.md) — orient to the system boundary
3. [C4 Level 2 — Containers](architecture/c4-containers.md) — understand the major components
4. [ADR-001 — Event Sourcing](adr/ADR-001-event-sourcing.md) — the most consequential architectural decision
5. [Data Model](data-model.md) — how data is structured
6. [Sequence Diagrams](sequences.md) — how the system behaves at runtime
7. Remaining ADRs and supporting documents as needed
