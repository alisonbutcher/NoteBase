import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Pool } from 'pg';
import { createTestApp, closeTestApp } from './app.e2e-setup';

const TEST_NODE_ID = '550e8400-e29b-41d4-a716-446655440000';
const E2E_USER_ID = '00000000-0000-0000-0000-000000000099';

describe('Nodes write path (e2e)', () => {
  let app: NestFastifyApplication;
  let pool: Pool;

  beforeAll(async () => {
    process.env.LOCAL_AUTH_USER_ID = E2E_USER_ID;
    app = await createTestApp();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`DELETE FROM events WHERE payload->>'userId' = $1`, [E2E_USER_ID]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM events WHERE payload->>'userId' = $1`, [E2E_USER_ID]);
    await pool.end();
    await closeTestApp();
  });

  it('POST /v1/nodes returns 202 with eventId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/nodes',
      payload: {
        nodeId: TEST_NODE_ID,
        content: 'E2E test node',
        parentId: null,
        dailyNoteDate: '2026-03-29',
        position: 0,
      },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json<{ eventId: string }>();
    expect(body.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('NodeCreated event is persisted in the events table', async () => {
    const result = await pool.query(
      `SELECT type, payload FROM events WHERE payload->>'userId' = $1 AND type = 'NodeCreated'`,
      [E2E_USER_ID],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].type).toBe('NodeCreated');
    expect(result.rows[0].payload.nodeId).toBe(TEST_NODE_ID);
  });

  it('PATCH /v1/nodes/:id returns 202 with eventId', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/nodes/${TEST_NODE_ID}`,
      payload: { content: 'Updated by e2e test' },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json<{ eventId: string }>().eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('POST /v1/nodes/:id/move returns 202 with eventId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/nodes/${TEST_NODE_ID}/move`,
      payload: { newParentId: null, newPosition: 1 },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json<{ eventId: string }>().eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('DELETE /v1/nodes/:id returns 202 with eventId', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/nodes/${TEST_NODE_ID}`,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json<{ eventId: string }>().eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('all 4 events are persisted in the correct order', async () => {
    const result = await pool.query(
      `SELECT type FROM events WHERE payload->>'userId' = $1 ORDER BY id ASC`,
      [E2E_USER_ID],
    );
    expect(result.rows.map((r: { type: string }) => r.type)).toEqual([
      'NodeCreated',
      'NodeEdited',
      'NodeMoved',
      'NodeDeleted',
    ]);
  });

  it('POST /v1/nodes with missing content returns 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/nodes',
      payload: {
        nodeId: TEST_NODE_ID,
        parentId: null,
        dailyNoteDate: '2026-03-29',
        position: 0,
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
