import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Pool } from 'pg';
import { createTestApp, closeTestApp } from './app.e2e-setup';

const E2E_USER_ID = '00000000-0000-0000-0000-000000000099';
const TEST_NODE_ID = '550e8400-e29b-41d4-a716-446655440011';
const TEST_TAG_ID = '550e8400-e29b-41d4-a716-446655440022';

describe('Tags write path (e2e)', () => {
  let app: NestFastifyApplication;
  let pool: Pool;

  beforeAll(async () => {
    process.env.LOCAL_AUTH_USER_ID = E2E_USER_ID;
    app = await createTestApp();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    await pool.query(`DELETE FROM events WHERE payload->>'userId' = $1`, [E2E_USER_ID]);
    await pool.query(`DELETE FROM tags WHERE user_id = $1`, [E2E_USER_ID]);

    // Create a node so tagNode has a valid nodeId to reference
    await app.inject({
      method: 'POST',
      url: '/v1/nodes',
      payload: {
        nodeId: TEST_NODE_ID,
        content: 'E2E tag test node',
        parentId: null,
        dailyNoteDate: '2026-03-29',
        position: 0,
      },
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM events WHERE payload->>'userId' = $1`, [E2E_USER_ID]);
    await pool.query(`DELETE FROM tags WHERE user_id = $1`, [E2E_USER_ID]);
    await pool.end();
    await closeTestApp();
  });

  it('POST /v1/tags returns 202 with eventId and tagId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/tags',
      payload: { tagId: TEST_TAG_ID, tagName: 'e2etest' },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json<{ eventId: string; tagId: string }>();
    expect(body.tagId).toBe(TEST_TAG_ID);
    expect(body.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('TagCreated event is persisted in the events table', async () => {
    const result = await pool.query(
      `SELECT type, payload FROM events WHERE payload->>'userId' = $1 AND type = 'TagCreated'`,
      [E2E_USER_ID],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].payload.tagId).toBe(TEST_TAG_ID);
    expect(result.rows[0].payload.tagName).toBe('e2etest');
  });

  it('POST /v1/nodes/:id/tags with existing tag returns 202, reuses tagId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/nodes/${TEST_NODE_ID}/tags`,
      payload: { tagName: 'e2etest' },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json<{ eventId: string; tagId: string }>();
    expect(body.tagId).toBe(TEST_TAG_ID);
    expect(body.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('NodeTagged event is persisted in the events table', async () => {
    const result = await pool.query(
      `SELECT type, payload FROM events WHERE payload->>'userId' = $1 AND type = 'NodeTagged'`,
      [E2E_USER_ID],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].payload.nodeId).toBe(TEST_NODE_ID);
    expect(result.rows[0].payload.tagId).toBe(TEST_TAG_ID);
  });

  it('POST /v1/nodes/:id/tags with new tag auto-creates tag and returns tagId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/nodes/${TEST_NODE_ID}/tags`,
      payload: { tagName: 'brandnewtag' },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json<{ eventId: string; tagId: string }>();
    expect(body.tagId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('auto-created tag emits TagCreated + NodeTagged events', async () => {
    const result = await pool.query(
      `SELECT type FROM events WHERE payload->>'userId' = $1 AND payload->>'tagName' = 'brandnewtag' ORDER BY id ASC`,
      [E2E_USER_ID],
    );
    expect(result.rows.map((r: { type: string }) => r.type)).toEqual(['TagCreated', 'NodeTagged']);
  });

  it('DELETE /v1/nodes/:id/tags/:tagId returns 202 with eventId', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/nodes/${TEST_NODE_ID}/tags/${TEST_TAG_ID}`,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json<{ eventId: string }>().eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('NodeUntagged event is persisted in the events table', async () => {
    const result = await pool.query(
      `SELECT type, payload FROM events WHERE payload->>'userId' = $1 AND type = 'NodeUntagged'`,
      [E2E_USER_ID],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].payload.nodeId).toBe(TEST_NODE_ID);
    expect(result.rows[0].payload.tagId).toBe(TEST_TAG_ID);
  });

  it('POST /v1/tags with missing tagName returns 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/tags',
      payload: { tagId: TEST_TAG_ID },
    });
    expect(response.statusCode).toBe(400);
  });

  it('POST /v1/nodes/:id/tags with missing tagName returns 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/nodes/${TEST_NODE_ID}/tags`,
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });
});
