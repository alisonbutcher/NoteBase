# ADR-004 — DynamoDB as the read store

**Status:** Accepted
**Date:** 2025-03
**Author:** Solution Architecture

---

## Context

The read store serves pre-computed projections to the query handlers. Unlike the event store, which has a single sequential access pattern, the read store must serve several distinct query patterns efficiently:

- **Tag lens query** — all nodes with a given tag, for a given user, ordered by date
- **Daily note query** — all nodes for a given date, for a given user, in tree order
- **Node children query** — all direct children of a given node

These access patterns are known at design time and are unlikely to change. No ad hoc queries are run against the read store — it is a purpose-built query surface maintained by the projection engine.

The read store has very different characteristics from the event store:

- **Reads are high frequency** — every page load hits the read store
- **Writes are eventual** — the projection engine updates the read store asynchronously after events are processed
- **Consistency requirement is low** — a small lag between a write and its appearance in the read store is acceptable
- **Scale requirement is high** — at SaaS scale, read throughput must grow with user count without schema changes

---

## Decision

We will use **DynamoDB** as the read store for tag lens and daily note projections.

DynamoDB is selected because the access patterns are fixed, known, and map cleanly onto a partition key / sort key model. Each access pattern becomes a single-digit millisecond lookup regardless of table size.

**Table design — tag lens projection:**

```
Table: notebase-tag-lens

PK: USER#{userId}#TAG#{tagId}
SK: DATE#{isoDate}#NODE#{nodeId}

Attributes:
  nodeId       String
  content      String
  tagId        String
  dailyNoteDate String
  parentId     String (nullable)
  childCount   Number
  updatedAt    String (ISO timestamp)
```

Access pattern: `PK = USER#123#TAG#meeting` returns all meeting nodes for user 123, sorted by date. A date range filter narrows to a specific period.

**Table design — daily note projection:**

```
Table: notebase-daily-note

PK: USER#{userId}#DATE#{isoDate}
SK: POSITION#{paddedPosition}#NODE#{nodeId}

Attributes:
  nodeId       String
  content      String
  depth        Number
  tags         StringSet
  parentId     String (nullable)
  updatedAt    String (ISO timestamp)
```

Access pattern: `PK = USER#123#DATE#2025-03-25` returns all nodes for that daily note in display order.

**On the two-database approach:** Using Postgres for the event store and DynamoDB for the read store is a deliberate decision to match each database technology to its access pattern rather than defaulting to a single technology for everything. This is a common pattern in event sourced systems and is defensible on the grounds that Postgres excels at sequential, relational workloads and DynamoDB excels at high-throughput key-value lookups at scale. The complexity cost is real — two databases to operate and monitor — but is justified by the performance and scalability properties of each.

---

## Consequences

### Positive

- Single-digit millisecond read latency at any scale without indexing or query optimisation
- DynamoDB scales read throughput automatically with no schema changes
- The projection engine writes are simple PutItem operations — no complex SQL
- DynamoDB on-demand pricing means zero read cost during personal/low-traffic phases
- Access patterns are enforced by the table design — ad hoc queries against the read store are structurally discouraged

### Negative

- DynamoDB requires careful upfront access pattern design — adding a new query pattern may require a new table or global secondary index
- The two-database model increases operational complexity — two connection configurations, two sets of IAM permissions, two monitoring concerns
- DynamoDB's eventual consistency model (default read mode) is acceptable for this use case but requires awareness — strongly consistent reads are available at higher cost if required
- Local development requires either DynamoDB Local (Docker) or a real AWS account — adds friction to the Phase 1 local setup

---

## Alternatives Considered

**Postgres for both event store and read store**
The simplest option and the correct choice for Phase 1 local development. Postgres projection tables are straightforward to query and maintain. Rejected as the long-term read store because write throughput to a single Postgres primary becomes a bottleneck at SaaS scale, and the fixed access patterns of the read store do not require the relational capabilities that justify Postgres's operational cost at scale. The `IProjectionStore` interface (see ADR-006) allows Postgres to serve as the read store in Phase 1 without changing application code when DynamoDB is introduced in Phase 2.

**Redis for the read store**
Redis was considered as an in-memory read store for maximum read performance. Rejected because Redis's persistence model is less reliable than DynamoDB for a production read store, and DynamoDB's latency is already within single-digit milliseconds — the additional performance of Redis is not justified by the operational tradeoff.

**Elasticsearch / OpenSearch**
Considered for its full-text search capabilities, which are relevant to a note-taking application. Rejected as the primary read store because the tag lens access pattern is a key-value lookup, not a full-text search. OpenSearch remains a valid addition as a secondary index for the search feature specifically, consuming from the same event stream.
