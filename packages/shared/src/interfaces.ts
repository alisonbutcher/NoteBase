import type { NoteBaseEvent } from './events';

// ── IEventStore ───────────────────────────────────────────────────────────────
// Abstracts the append-only event log. Always Postgres in practice.
// See ADR-003 and ADR-006.

export interface StoredEvent {
  id: number; // sequential ID used as replay cursor
  event: NoteBaseEvent;
}

export interface IEventStore {
  append(event: NoteBaseEvent): Promise<void>;
  getEventsSince(lastEventId: number): Promise<StoredEvent[]>;
}

// ── IMessagePublisher ─────────────────────────────────────────────────────────
// Abstracts event publication to the message queue.
// Phase 1: NullPublisher (no-op — projection handler polls event store directly)
// Phase 2: RabbitMqPublisher (AMQP)
// See ADR-005 and ADR-006.

export interface IMessagePublisher {
  publish(event: NoteBaseEvent): Promise<void>;
}

// ── IProjectionStore ──────────────────────────────────────────────────────────
// Abstracts the read store containing pre-computed projections.
// Phase 1: PostgresProjectionStore
// Phase 2: DynamoDbProjectionStore
// See ADR-004 and ADR-006.

export interface DailyNoteNode {
  nodeId: string;
  content: string;
  parentId: string | null;
  position: number;
  depth: number;
  tags: string[];
  updatedAt: string;
}

export interface TagLensNode {
  nodeId: string;
  content: string;
  dailyNoteDate: string;
  parentId: string | null;
  position: number;
  childCount: number;
  updatedAt: string;
}

export interface TagRecord {
  tagId: string;
  tagName: string;
  color: string | null;
  createdAt: string;
}

export interface DailyNoteResult {
  date: string;
  nodes: DailyNoteNode[];
}

export interface TagLensResult {
  tagId: string;
  tagName: string;
  nodes: TagLensNode[];
  nextCursor: string | null;
}

export interface TagLensQueryOptions {
  from?: string;   // YYYY-MM-DD inclusive
  to?: string;     // YYYY-MM-DD inclusive
  limit?: number;  // default 100, max 500
  cursor?: string;
}

export interface IProjectionStore {
  // Daily note projection
  upsertDailyNoteNode(
    userId: string,
    dailyNoteDate: string,
    node: DailyNoteNode,
  ): Promise<void>;
  deleteDailyNoteNode(userId: string, dailyNoteDate: string, nodeId: string): Promise<void>;
  getDailyNote(userId: string, date: string): Promise<DailyNoteResult>;

  // Tag lens projection
  upsertTagLensNode(
    userId: string,
    tagId: string,
    tagName: string,
    node: TagLensNode,
  ): Promise<void>;
  deleteTagLensNode(userId: string, tagId: string, nodeId: string): Promise<void>;
  getTagLens(userId: string, tagId: string, options?: TagLensQueryOptions): Promise<TagLensResult>;

  // Tags
  upsertTag(userId: string, tag: TagRecord): Promise<void>;
  getTags(userId: string): Promise<TagRecord[]>;
}
