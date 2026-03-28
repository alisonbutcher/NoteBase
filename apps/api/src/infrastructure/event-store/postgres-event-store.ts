import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { IEventStore, StoredEvent } from '@notebase/shared';
import type { NoteBaseEvent } from '@notebase/shared';

@Injectable()
export class PostgresEventStore implements IEventStore {
  private readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('app.database.url'),
    });
  }

  async append(event: NoteBaseEvent): Promise<void> {
    const e = event as { nodeId?: string; tagId?: string; userId: string };
    const aggregateId = e.nodeId ?? e.tagId ?? e.userId;
    await this.pool.query(
      `INSERT INTO events (aggregate_id, event_type, payload, occurred_at)
       VALUES ($1, $2, $3, $4)`,
      [aggregateId, event.type, JSON.stringify(event), event.occurredAt],
    );
  }

  async getEventsSince(lastEventId: number): Promise<StoredEvent[]> {
    const result = await this.pool.query<{ id: number; payload: NoteBaseEvent }>(
      `SELECT id, payload FROM events WHERE id > $1 ORDER BY id ASC`,
      [lastEventId],
    );
    return result.rows.map((row) => ({ id: row.id, event: row.payload }));
  }
}
