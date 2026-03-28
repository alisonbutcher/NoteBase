# Non-Functional Requirements

This document defines the measurable quality attributes NoteBase must satisfy across each deployment phase. NFRs are first-class architectural constraints — they influenced technology selection and system design, and are referenced in the ADRs where relevant.

---

## Phases

| Phase | Description | Scale target |
|---|---|---|
| Phase 1 | Personal use, single user, local or single VPS | 1 user |
| Phase 2 | Early SaaS, small user base | Up to 1,000 active users |
| Phase 3 | Growth | Up to 10,000+ active users |

---

## Availability

| Requirement | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| API uptime target | Best effort | 99.9% (~8.7 hrs downtime/year) | 99.95% (~4.4 hrs downtime/year) |
| Planned maintenance window | Any time | Off-peak, notified 24hrs in advance | Off-peak, notified 48hrs in advance |
| Single point of failure | Acceptable | Not acceptable for API or event store | Not acceptable for any critical path component |

**Design implications:**
- Phase 2 achieves 99.9% through ECS Fargate with auto-recovery and RDS Multi-AZ. No active-active configuration is required at this scale.
- The event store (RDS Postgres) is the highest-criticality component. Multi-AZ deployment is required from Phase 2 onwards.
- The read store (DynamoDB) is highly available by default — AWS manages this. No additional configuration required.
- Projection staleness during an outage is acceptable. The event store remains authoritative and projections can be rebuilt on recovery.

---

## Performance

### Latency (p95 targets)

| Operation | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Tag lens page load (read) | < 500ms | < 200ms | < 150ms |
| Daily note page load (read) | < 500ms | < 200ms | < 150ms |
| Write command (API response) | < 300ms | < 150ms | < 100ms |
| Projection update (eventual consistency window) | < 1,000ms | < 500ms | < 300ms |

**Design implications:**
- Read latency targets are met by the pre-computed projection design — queries hit a single indexed table (Phase 1 Postgres) or a single DynamoDB partition key (Phase 2+). No joins or recursive queries on the hot path.
- Write latency targets are met by returning 202 Accepted as soon as the event is persisted to the event store. The API does not wait for projection updates.
- The Phase 1 projection polling interval is configurable. The default 500ms poll interval bounds the eventual consistency window to approximately 500–1,000ms. This can be reduced for lower latency at the cost of slightly higher database load.
- Phase 2 RabbitMQ delivery typically reduces the consistency window to under 300ms under normal load.

### Throughput

| Metric | Phase 2 target | Phase 3 target |
|---|---|---|
| Write commands per second (sustained) | 50 rps | 500 rps |
| Read requests per second (sustained) | 200 rps | 2,000 rps |
| Peak write burst (30 seconds) | 200 rps | 1,000 rps |

**Design implications:**
- At Phase 2 targets, a single ECS Fargate task for the API is sufficient. Auto-scaling is configured but unlikely to trigger regularly.
- DynamoDB on-demand capacity handles Phase 2 and Phase 3 read throughput targets without pre-provisioning.
- Event store write throughput at Phase 3 targets is within the capability of a single RDS Postgres `db.t3.medium` instance. Vertical scaling or read replicas are the first escalation path before considering partitioning.

---

## Reliability and Data Integrity

### Recovery objectives

| Metric | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Recovery Point Objective (RPO) | 24 hours | 5 minutes | 1 minute |
| Recovery Time Objective (RTO) | Best effort | 4 hours | 1 hour |

**Design implications:**
- RPO is primarily determined by event store backup frequency. Phase 2 uses RDS automated backups with point-in-time recovery (PITR), which provides a 5-minute RPO by default.
- The event sourcing pattern provides an additional recovery mechanism beyond standard database backups. Because projections are fully derivable from the event log, losing a projection store is a performance incident, not a data loss incident. RTO for projection recovery is bounded by replay time, not backup restoration time.
- Phase 1 relies on manual Postgres backups or snapshot-based VPS backups. The single-user context makes this acceptable.

### Data durability

- Events are immutable once written. No event is ever updated or deleted during normal operation.
- RDS Multi-AZ (Phase 2+) provides synchronous replication to a standby instance. Data written to the primary is guaranteed to be on the standby before the write is acknowledged.
- DynamoDB provides 99.999999999% (11 nines) durability by default through replication across three AWS Availability Zones.

### Idempotency

- All projection handlers must be idempotent. Each event carries a unique `eventId`. Handlers must check this ID before processing to safely handle redelivered messages.
- Write commands from the frontend should include a client-generated idempotency key to prevent duplicate event creation on network retry.

---

## Scalability

### Vertical scaling path (per component)

| Component | Phase 2 starting size | First scaling action | Trigger |
|---|---|---|---|
| API (ECS Fargate) | 0.5 vCPU / 1GB RAM | Increase task count | CPU > 70% sustained |
| Event store (RDS) | db.t3.small | db.t3.medium → db.t3.large | CPU > 60% or storage > 80% |
| Projection handler | 0.25 vCPU / 512MB RAM | Increase task count | Queue depth > 1,000 messages |
| DynamoDB | On-demand | On-demand auto-scaling | Automatic |

### Horizontal scaling considerations

- The API is stateless and horizontally scalable behind an ALB. Session state is not stored in the API process.
- The projection handler must account for competing consumer behaviour — multiple instances reading from RabbitMQ must not process the same event twice. RabbitMQ's competing consumers model handles this natively.
- The event store is the single write bottleneck. Horizontal scaling of the event store is not in scope for Phase 2 or Phase 3. If write throughput exceeds single-instance capacity, migration to a purpose-built event store (EventStoreDB) or event log partitioning strategy should be evaluated.

---

## Security

### Authentication and authorisation

- All API endpoints except `/health` require a valid JWT issued by Amazon Cognito.
- JWTs are validated by the API middleware on every request. No session state is maintained in the API.
- All data access is scoped to the authenticated user's `userId`. The API must not return data belonging to another user under any circumstances.
- Multi-tenancy isolation is enforced at the event level — every event carries `userId` and every projection query filters by `userId`.

### Encryption

| Data | At rest | In transit |
|---|---|---|
| Event store (RDS) | AES-256 (RDS encryption enabled) | TLS 1.2+ |
| Read store (DynamoDB) | AES-256 (default) | TLS 1.2+ |
| File attachments (S3) | AES-256 (SSE-S3 or SSE-KMS) | TLS 1.2+ |
| Queue messages (RabbitMQ) | TLS in transit only | TLS 1.2+ |

### Network security

- The API service runs in a private subnet. It is not directly accessible from the internet.
- All inbound traffic is routed through an Application Load Balancer (ALB) in a public subnet. The ALB terminates TLS.
- RDS and DynamoDB are accessible only from the API and projection handler security groups — not from the internet or other services.
- RabbitMQ (Amazon MQ) is accessible only from the API and projection handler security groups.

### IAM

- Each ECS task has a dedicated IAM task role with least-privilege permissions.
- The API task role has permissions to: DynamoDB (Query, PutItem on specific tables), S3 (PutObject, GetObject on the attachments bucket), Cognito (DescribeUserPool).
- The projection handler task role has permissions to: DynamoDB (PutItem, DeleteItem on specific tables), RDS (via IAM authentication or Secrets Manager — not hardcoded credentials).
- No wildcard resource permissions (`*`) in production IAM policies.

---

## Compliance and Privacy

### Data residency

- All production data is stored in `ap-southeast-2` (Sydney) by default.
- No user data is replicated to other regions without explicit opt-in.

### Right to erasure (GDPR Article 17)

Event sourcing creates a specific challenge for the right to erasure: events are immutable by design, and deleting events would corrupt the event log. The strategy for handling erasure requests is:

1. **Soft-delete projections** — all projection store entries for the user are immediately deleted. The user's data disappears from all views.
2. **Pseudonymisation of events** — the user's `userId` in the event store is replaced with a tombstone value (e.g. `DELETED-{hash}`) via a one-time migration. Event payloads containing personal content (note text) are overwritten with a placeholder.
3. **Snapshot purge** — all snapshots for the user are deleted.
4. **Cognito account deletion** — the user's Cognito account is deleted, making the original `userId` permanently unresolvable.

This approach satisfies the practical intent of the right to erasure (the user's data is no longer accessible or identifiable) while preserving the structural integrity of the event log for other users.

**Note:** This strategy should be reviewed by a qualified legal professional before the system handles personal data of EU residents.

---

## Observability

### Logging

- All API and projection handler logs are structured JSON, written to stdout, and collected by CloudWatch Logs (Phase 2+).
- Every log entry includes: `timestamp`, `level`, `service`, `traceId`, `userId` (where applicable), `message`.
- Write commands log: command type, `eventId`, `userId`, duration.
- Projection handler logs: event type, `eventId`, handler name, duration, outcome (processed / skipped / failed).

### Metrics (Phase 2+)

| Metric | Source | Alert threshold |
|---|---|---|
| API p95 latency | ALB access logs / CloudWatch | > 500ms for 5 minutes |
| API error rate | CloudWatch | > 1% for 5 minutes |
| RabbitMQ queue depth | Amazon MQ CloudWatch | > 5,000 messages |
| RDS CPU | RDS CloudWatch | > 80% for 10 minutes |
| RDS storage remaining | RDS CloudWatch | < 20% |
| Projection lag (events behind) | Custom metric from projection handler | > 10,000 events |

### Distributed tracing (Phase 2+)

- AWS X-Ray is enabled on ECS tasks and the ALB.
- A `traceId` is generated at the ALB and propagated through the API to the event store write and queue publish.
- Projection handler invocations are linked to the originating `traceId` via the event payload.

### Health checks

- `GET /health` returns 200 with a JSON body indicating the status of the API process, event store connection, and queue connection.
- ECS uses this endpoint for container health checks. An unhealthy container is replaced automatically.

---

## Maintainability

### Deployment

- Phase 1: Manual deployment or simple CI/CD pipeline (GitHub Actions → Docker build → push to ECR → ECS service update).
- Phase 2: Blue/green deployment via ECS with CodeDeploy. Traffic shifts from old to new task set over 5 minutes, with automatic rollback on health check failure.
- Database schema changes use forward-compatible migrations only — no destructive migrations in a single deployment. Backward-compatible migrations are deployed separately from the application code that depends on them.

### Zero-downtime deployments

- The API is stateless — ECS rolling updates replace instances without downtime.
- Event store schema migrations run before the new application version is deployed. Old application versions must continue to work with the new schema (expand-contract pattern).
- Projection store schema changes can be handled by dropping and rebuilding projections from the event log — no migration required.

### Configuration management

- All environment-specific configuration is injected via environment variables. No configuration is hardcoded.
- Secrets (database passwords, RabbitMQ credentials) are stored in AWS Secrets Manager and injected at container startup. Not stored in environment variables or version control.
