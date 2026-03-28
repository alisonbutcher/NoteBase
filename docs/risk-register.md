# Risk Register

This document identifies architectural risks — potential failure modes, design constraints, and operational concerns that could impact the system. Each risk has an assessed likelihood and impact, a mitigation strategy, and a phase indicator showing when it becomes relevant.

Risk ratings are assessed at **Phase 2 (early SaaS)** scale unless otherwise noted.

---

## Risk Rating Scale

| Rating | Likelihood | Impact |
|---|---|---|
| High | Likely to occur under normal operating conditions | Significant user-facing impact or data loss |
| Medium | Could occur under stress or edge conditions | Degraded experience or increased operational effort |
| Low | Unlikely under expected operating conditions | Minor or recoverable impact |

---

## Risks

### R-01 — Event store becomes a write bottleneck

| Attribute | Detail |
|---|---|
| **Phase** | Phase 3 |
| **Likelihood** | Low (Phase 2), Medium (Phase 3) |
| **Impact** | High — write commands queue up, API latency increases, user experience degrades |
| **Description** | All write operations append to a single RDS Postgres primary instance. At very high write volumes a single instance becomes a throughput bottleneck. |
| **Mitigation** | Vertical scaling (instance size) is the first lever and covers a significant range before becoming a constraint. If write throughput exceeds single-instance capacity, options include: partitioning the event log by `user_id`, migrating to a purpose-built event store (EventStoreDB), or introducing write sharding. The interface abstraction (`IEventStore`) allows the underlying store to be replaced without application code changes. |
| **Trigger** | RDS CPU sustained above 80% or write latency p95 exceeding 100ms. |

---

### R-02 — Projection handler falls behind under write burst

| Attribute | Detail |
|---|---|
| **Phase** | Phase 2+ |
| **Likelihood** | Medium |
| **Impact** | Medium — eventual consistency window grows, users see stale data for longer than expected |
| **Description** | Under a sustained write burst (many users writing simultaneously) the projection handler may not process events fast enough to keep the read store current. The RabbitMQ queue depth grows and the consistency window extends beyond the NFR target. |
| **Mitigation** | ECS auto-scaling on queue depth metric (CloudWatch alarm on Amazon MQ queue depth > 1,000 messages triggers additional projection handler tasks). RabbitMQ competing consumers model distributes load across multiple handler instances automatically. Idempotent handlers (checked via `eventId`) ensure correctness under parallel processing. |
| **Trigger** | RabbitMQ queue depth sustained above 1,000 messages for more than 5 minutes. |

---

### R-03 — Amazon MQ single-instance failure (Phase 2)

| Attribute | Detail |
|---|---|
| **Phase** | Phase 2 |
| **Likelihood** | Low |
| **Impact** | High — projection updates stop; read store becomes increasingly stale until the broker recovers |
| **Description** | Phase 2 uses a single `mq.t3.micro` Amazon MQ instance for cost reasons. A broker failure means no events are published to the queue and projection handlers stop processing. The event store continues to accept writes (the API write path is not blocked), but the read store is not updated until the broker recovers. |
| **Mitigation** | Events remain in the event store during the outage. When the broker recovers, the projection handler resumes from its last checkpoint (replay cursor) and catches up. No data is lost — only projection freshness is affected. Upgrade to active/standby Amazon MQ broker pair at Phase 3. Monitor broker health with a CloudWatch alarm. |
| **Trigger** | Amazon MQ broker status moves to non-running state. |

---

### R-04 — DynamoDB hot partition under skewed access patterns

| Attribute | Detail |
|---|---|
| **Phase** | Phase 3 |
| **Likelihood** | Low |
| **Impact** | Medium — throttled reads on heavily accessed tag lens pages; DynamoDB returns 429 errors |
| **Description** | DynamoDB distributes load across partitions by partition key. If a small number of partition keys (e.g. a very popular tag shared by many users) receive a disproportionate share of requests, that partition can become "hot" and be throttled. |
| **Mitigation** | The partition key design (`USER#{userId}#TAG#{tagId}`) scopes each partition to a single user's tag — preventing cross-user hot partitions. A single user generating extreme read load on one tag is possible but unlikely at Phase 3 scale. DynamoDB on-demand capacity adjusts automatically. If throttling is observed, DAX (DynamoDB Accelerator) can be introduced as a read-through cache without application code changes. |
| **Trigger** | DynamoDB `ThrottledRequests` metric sustained above 0 for a given table. |

---

### R-05 — Snapshot failure causes long projection rebuild times

| Attribute | Detail |
|---|---|
| **Phase** | Phase 2+ |
| **Likelihood** | Low |
| **Impact** | Medium — projection rebuild after a handler bug fix takes significantly longer than expected |
| **Description** | If the snapshot process fails silently or snapshots are not being written at the configured interval, a projection rebuild must replay the full event log from the beginning rather than from the latest snapshot. At high event volumes this significantly increases rebuild time. |
| **Mitigation** | Monitor the gap between the latest snapshot's `last_event_id` and the current maximum event ID. Alert if this gap exceeds twice the configured snapshot threshold (default: 2,000 events). Snapshot writes should be logged and failures surfaced as errors. Add an integration test that verifies snapshot creation after a configurable number of events. |
| **Trigger** | `last_event_id` gap exceeds 2,000 events per user per projection. |

---

### R-06 — Dead letter queue grows without visibility

| Attribute | Detail |
|---|---|
| **Phase** | Phase 2+ |
| **Likelihood** | Medium |
| **Impact** | Medium — failed projection updates accumulate silently; read store has permanent gaps until manually resolved |
| **Description** | Messages that fail processing after the retry limit are routed to `notebase.projections.dlq`. If this queue is not monitored, failed projections go undetected and affected nodes are permanently stale in the read store until a manual replay is triggered. |
| **Mitigation** | CloudWatch alarm on `notebase.projections.dlq` depth > 0. Alert routes to the on-call channel immediately. Runbook documents the process for inspecting DLQ messages and triggering a targeted projection rebuild. Dead letter messages retain the original `eventId`, allowing the exact failed event to be identified and replayed. |
| **Trigger** | DLQ depth > 0. |

---

### R-07 — GDPR erasure corrupts event log integrity

| Attribute | Detail |
|---|---|
| **Phase** | Phase 2 |
| **Likelihood** | Low (event, not ongoing risk) |
| **Impact** | High if implemented incorrectly — corrupted event log cannot be used to rebuild projections |
| **Description** | The event sourcing pattern stores all state changes as immutable events. A GDPR erasure request requires removing or pseudonymising personal data from the event log, which conflicts with the immutability guarantee. An incorrect implementation could corrupt the sequential event log and make projection rebuild impossible. |
| **Mitigation** | The erasure strategy (documented in the Security Architecture document) operates at the payload level — event rows are retained with pseudonymised `userId` and overwritten content fields. The event sequence and IDs are never modified. Projections for the deleted user are dropped entirely rather than rebuilt. The erasure process is implemented as a dedicated, audited operation with a dry-run mode. It is never exposed as a user-facing API — only triggered by an operator following a verified erasure request. |
| **Trigger** | GDPR Article 17 erasure request received from a verified user. |

---

### R-08 — Eventual consistency causes user confusion

| Attribute | Detail |
|---|---|
| **Phase** | Phase 1+ |
| **Likelihood** | Medium |
| **Impact** | Low — brief visual inconsistency, no data loss |
| **Description** | The API returns 202 Accepted before the projection is updated. If the frontend immediately re-fetches data after a write, it may receive stale projection data and appear to the user as if their change was not saved. |
| **Mitigation** | The frontend must apply **optimistic updates** — updating the local UI state immediately on a successful write command without waiting for a re-fetch. The eventual consistency window (under 1 second in Phase 1, under 500ms in Phase 2) is short enough that by the time a user would navigate away and return, the projection is current. Document this pattern explicitly in the frontend engineering guidelines. |
| **Trigger** | User reports a change appearing to revert immediately after saving. |

---

### R-09 — Cognito service outage blocks all authentication

| Attribute | Detail |
|---|---|
| **Phase** | Phase 2+ |
| **Likelihood** | Very Low |
| **Impact** | High — no user can authenticate; the application is inaccessible |
| **Description** | NoteBase delegates all authentication to Amazon Cognito. A Cognito regional outage means JWTs cannot be issued and existing tokens cannot be validated (JWKS endpoint unavailable). |
| **Mitigation** | Cache the Cognito JWKS public keys in the API process with a long TTL (1 hour). Existing sessions with valid, non-expired JWTs continue to work during an outage. New logins are unavailable until Cognito recovers. Cognito's published SLA is 99.9% — historical outages are rare and brief. At Phase 3, multi-region Cognito deployment can be evaluated. |
| **Trigger** | Cognito health dashboard reports degraded service in ap-southeast-2. |

---

### R-10 — Node.js dependency vulnerability in production image

| Attribute | Detail |
|---|---|
| **Phase** | Phase 2+ |
| **Likelihood** | Medium |
| **Impact** | Medium — depends on severity; could range from informational to critical exploit |
| **Description** | The NestJS API and projection handler run on Node.js with a substantial number of npm dependencies. A critical vulnerability in a transitive dependency could expose the running containers. |
| **Mitigation** | Dependabot is enabled on the repository and raises PRs for dependency updates automatically. ECR image scanning runs on every pushed image and blocks deployment of images with critical CVEs. `npm audit` runs in the CI build pipeline. Base image is pinned to a specific Node.js LTS version and updated on a monthly schedule. |
| **Trigger** | Dependabot alert rated Critical or High, or ECR scan finding with CRITICAL severity. |
