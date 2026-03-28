# ADR-005 — RabbitMQ on Amazon MQ over AWS SQS

**Status:** Accepted
**Date:** 2025-03
**Author:** Solution Architecture

---

## Context

The architecture requires a message queue to decouple the API (event publisher) from the projection handlers (event consumers). The queue must provide guaranteed delivery — messages must not be lost if the projection handler is temporarily unavailable — and must support at-least-once delivery semantics.

The queue sits on the write path between the event store and the projection engine:

```
API → Event store → [Queue] → Projection handler → Read store
```

Two primary options were evaluated: AWS SQS (a managed, proprietary queue) and RabbitMQ (an open-source broker implementing the AMQP protocol, available as a managed service via Amazon MQ).

---

## Decision

We will use **RabbitMQ on Amazon MQ** as the message queue.

The decision is driven primarily by vendor portability. SQS is a proprietary AWS service — the SDK, the message format, and the trigger model are specific to AWS. Migrating away from SQS requires changes to the application code publishing and consuming messages. RabbitMQ implements AMQP, an open protocol — the application code talks to an AMQP endpoint, not to AWS. Changing the broker (from Amazon MQ to a self-hosted RabbitMQ, or to another AMQP-compatible broker) requires only a connection string change, not application code changes.

This matters because the system is designed as a reference implementation that should be deployable outside AWS. A future operator running on Azure or on-premises should not face application code changes to replace the queue.

**NestJS integration:** NestJS's `@nestjs/microservices` module includes a first-class RabbitMQ transport. The projection handler is a NestJS microservice that connects to RabbitMQ via AMQP and processes messages through decorated handler methods. This is idiomatic NestJS and requires no custom transport implementation.

**Guaranteed delivery:** RabbitMQ's acknowledgement model ensures messages are not removed from the queue until the projection handler explicitly acknowledges successful processing. If the handler crashes mid-processing, the message is requeued and redelivered. This is the correct behaviour for an event sourced projection engine where idempotent processing is required.

**Dead letter queue:** A dead letter exchange (DLX) is configured to capture messages that fail processing after a configurable number of retries. Failed messages are routed to a dead letter queue for manual inspection and replay. This is a standard RabbitMQ pattern.

**Queue configuration:**

```
Exchange:     notebase.events (topic exchange)
Queue:        notebase.projections (durable)
Dead letter:  notebase.projections.dlq (durable)
Routing key:  event.# (wildcard — all event types)
```

---

## Consequences

### Positive

- Application code is decoupled from AWS — AMQP connection string is the only AWS-specific configuration
- Amazon MQ removes the operational burden of running RabbitMQ clusters
- NestJS first-class RabbitMQ transport reduces boilerplate
- Dead letter queue provides visibility into failed projection updates
- RabbitMQ management UI (available via Amazon MQ) provides queue depth monitoring and message inspection
- AMQP and RabbitMQ are widely understood in enterprise environments — recognisable in architecture reviews

### Negative

- Amazon MQ has a minimum instance cost — it does not scale to zero unlike SQS. For Phase 1 local development, RabbitMQ runs in Docker Compose at no cost. For early SaaS, Amazon MQ has a baseline cost regardless of message volume
- RabbitMQ is operationally more complex than SQS — routing, exchanges, bindings, and acknowledgement modes require configuration that SQS handles implicitly
- SQS-triggered Lambda is not available with RabbitMQ — the projection handler must be a persistent polling process rather than an event-driven Lambda invocation. This is acceptable because the projection handler runs on ECS Fargate as a persistent service

---

## Alternatives Considered

**AWS SQS**
The natural AWS-native choice. Managed, scales to zero, integrates natively with Lambda triggers. Rejected primarily on vendor portability grounds — SQS is a proprietary API and migrating away from it requires application code changes. Additionally, the SQS-triggered Lambda pattern (which is the main advantage of SQS in this architecture) was evaluated and rejected for the projection handler because it requires Lambda cold start management and is a poor fit for a NestJS microservice (see ADR-002).

**Redis Streams**
A lightweight alternative using Redis as both a cache and a message stream. Rejected because Redis Streams, while capable, are less mature for reliable message delivery than RabbitMQ. If Redis is already running for caching purposes this becomes more attractive — worth revisiting in a future phase.

**Apache Kafka / AWS MSK**
Kafka is architecturally the most capable option — it is a distributed log rather than a queue, meaning events are retained and replayable rather than consumed and deleted. This maps beautifully onto event sourcing, to the point where some architectures use Kafka as both the message bus and the event store, eliminating the separate Postgres event store. Rejected because MSK introduces significant operational complexity and cost that is not justified at the expected scale. Kafka remains the correct migration target if the system grows to hundreds of thousands of active users.
