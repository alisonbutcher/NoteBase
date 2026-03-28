import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { IEventStore, StoredEvent } from '@notebase/shared';
import type { NoteBaseEvent } from '@notebase/shared';

@Injectable()
export class PostgresEventStore implements IEventStore, OnApplicationShutdown {
  private readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('app.database.url'),
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }

  async append(event: NoteBaseEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO events (type, payload, user_id) VALUES ($1, $2, $3)`,
      [event.type, JSON.stringify(event), event.userId],
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
