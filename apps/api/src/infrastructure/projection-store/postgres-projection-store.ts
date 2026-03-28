import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type {
  IProjectionStore,
  DailyNoteNode,
  DailyNoteResult,
  TagLensNode,
  TagLensResult,
  TagLensQueryOptions,
  TagRecord,
} from '@notebase/shared';

@Injectable()
export class PostgresProjectionStore implements IProjectionStore {
  private readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('app.database.url'),
    });
  }

  async upsertDailyNoteNode(
    userId: string,
    dailyNoteDate: string,
    node: DailyNoteNode,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO projection_daily_note
         (user_id, daily_note_date, node_id, content, parent_id, position, depth, tags, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, daily_note_date, node_id) DO UPDATE SET
         content    = EXCLUDED.content,
         parent_id  = EXCLUDED.parent_id,
         position   = EXCLUDED.position,
         depth      = EXCLUDED.depth,
         tags       = EXCLUDED.tags,
         updated_at = EXCLUDED.updated_at`,
      [
        userId,
        dailyNoteDate,
        node.nodeId,
        node.content,
        node.parentId,
        node.position,
        node.depth,
        JSON.stringify(node.tags),
        node.updatedAt,
      ],
    );
  }

  async deleteDailyNoteNode(userId: string, dailyNoteDate: string, nodeId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM projection_daily_note WHERE user_id = $1 AND daily_note_date = $2 AND node_id = $3`,
      [userId, dailyNoteDate, nodeId],
    );
  }

  async getDailyNote(userId: string, date: string): Promise<DailyNoteResult> {
    const result = await this.pool.query<{
      node_id: string;
      content: string;
      parent_id: string | null;
      position: number;
      depth: number;
      tags: string;
      updated_at: string;
    }>(
      `SELECT node_id, content, parent_id, position, depth, tags, updated_at
       FROM projection_daily_note
       WHERE user_id = $1 AND daily_note_date = $2
       ORDER BY position ASC`,
      [userId, date],
    );

    return {
      date,
      nodes: result.rows.map((row) => ({
        nodeId: row.node_id,
        content: row.content,
        parentId: row.parent_id,
        position: row.position,
        depth: row.depth,
        tags: JSON.parse(row.tags) as string[],
        updatedAt: row.updated_at,
      })),
    };
  }

  async upsertTagLensNode(
    userId: string,
    tagId: string,
    tagName: string,
    node: TagLensNode,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO projection_tag_lens
         (user_id, tag_id, tag_name, node_id, content, daily_note_date, parent_id, position, child_count, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, tag_id, node_id) DO UPDATE SET
         tag_name        = EXCLUDED.tag_name,
         content         = EXCLUDED.content,
         daily_note_date = EXCLUDED.daily_note_date,
         parent_id       = EXCLUDED.parent_id,
         position        = EXCLUDED.position,
         child_count     = EXCLUDED.child_count,
         updated_at      = EXCLUDED.updated_at`,
      [
        userId,
        tagId,
        tagName,
        node.nodeId,
        node.content,
        node.dailyNoteDate,
        node.parentId,
        node.position,
        node.childCount,
        node.updatedAt,
      ],
    );
  }

  async deleteTagLensNode(userId: string, tagId: string, nodeId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM projection_tag_lens WHERE user_id = $1 AND tag_id = $2 AND node_id = $3`,
      [userId, tagId, nodeId],
    );
  }

  async getTagLens(
    userId: string,
    tagId: string,
    options: TagLensQueryOptions = {},
  ): Promise<TagLensResult> {
    const { from, to, limit = 100, cursor } = options;
    const params: unknown[] = [userId, tagId];
    const conditions: string[] = ['user_id = $1', 'tag_id = $2'];

    if (from) {
      params.push(from);
      conditions.push(`daily_note_date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`daily_note_date <= $${params.length}`);
    }
    if (cursor) {
      params.push(cursor);
      conditions.push(`daily_note_date < $${params.length}`);
    }

    const effectiveLimit = Math.min(limit, 500);
    params.push(effectiveLimit + 1);

    const result = await this.pool.query<{
      tag_name: string;
      node_id: string;
      content: string;
      daily_note_date: string;
      parent_id: string | null;
      position: number;
      child_count: number;
      updated_at: string;
    }>(
      `SELECT tag_name, node_id, content, daily_note_date, parent_id, position, child_count, updated_at
       FROM projection_tag_lens
       WHERE ${conditions.join(' AND ')}
       ORDER BY daily_note_date DESC, position ASC
       LIMIT $${params.length}`,
      params,
    );

    const hasMore = result.rows.length > effectiveLimit;
    const rows = hasMore ? result.rows.slice(0, effectiveLimit) : result.rows;
    const nextCursor = hasMore ? (rows[rows.length - 1]?.daily_note_date ?? null) : null;

    return {
      tagId,
      tagName: rows[0]?.tag_name ?? '',
      nodes: rows.map((row) => ({
        nodeId: row.node_id,
        content: row.content,
        dailyNoteDate: row.daily_note_date,
        parentId: row.parent_id,
        position: row.position,
        childCount: row.child_count,
        updatedAt: row.updated_at,
      })),
      nextCursor,
    };
  }

  async upsertTag(userId: string, tag: TagRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO tags (user_id, tag_id, tag_name, color, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, tag_id) DO UPDATE SET
         tag_name   = EXCLUDED.tag_name,
         color      = EXCLUDED.color`,
      [userId, tag.tagId, tag.tagName, tag.color, tag.createdAt],
    );
  }

  async getTags(userId: string): Promise<TagRecord[]> {
    const result = await this.pool.query<{
      tag_id: string;
      tag_name: string;
      color: string | null;
      created_at: string;
    }>(
      `SELECT tag_id, tag_name, color, created_at FROM tags WHERE user_id = $1 ORDER BY tag_name ASC`,
      [userId],
    );

    return result.rows.map((row) => ({
      tagId: row.tag_id,
      tagName: row.tag_name,
      color: row.color,
      createdAt: row.created_at,
    }));
  }
}
