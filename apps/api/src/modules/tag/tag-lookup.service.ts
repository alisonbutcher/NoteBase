import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export interface ResolvedTag {
  tagId: string;
  tagName: string;
  isNew: boolean;
}

/**
 * Queries the tags table to find an existing tag by name, or signals that
 * a new one should be created. The caller is responsible for emitting
 * TagCreated when isNew=true.
 */
@Injectable()
export class TagLookupService {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('app.database.url'),
    });
  }

  async findByName(userId: string, tagName: string): Promise<{ tagId: string } | null> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM tags WHERE user_id = $1 AND name = $2`,
      [userId, tagName.toLowerCase()],
    );
    return result.rows[0] ? { tagId: result.rows[0].id } : null;
  }
}
