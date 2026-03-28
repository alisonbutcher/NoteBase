import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Pool } from 'pg';
import { createTestApp, closeTestApp } from './app.e2e-setup';

const E2E_USER_ID = '00000000-0000-0000-0000-000000000099';
const TEST_TAG_ID = '550e8400-e29b-41d4-a716-446655440044';

describe('Projection read path (e2e)', () => {
  let app: NestFastifyApplication;
  let pool: Pool;

  beforeAll(async () => {
    process.env.LOCAL_AUTH_USER_ID = E2E_USER_ID;
    app = await createTestApp();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    await pool.query(`DELETE FROM events WHERE payload->>'userId' = $1`, [E2E_USER_ID]);
    await pool.query(`DELETE FROM tags WHERE user_id = $1`, [E2E_USER_ID]);

    // Seed a tag via the write path so GET /v1/tags has something to return
    await app.inject({
      method: 'POST',
      url: '/v1/tags',
      payload: { tagId: TEST_TAG_ID, tagName: 'readpathtest', color: '#aabbcc' },
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM events WHERE payload->>'userId' = $1`, [E2E_USER_ID]);
    await pool.query(`DELETE FROM tags WHERE user_id = $1`, [E2E_USER_ID]);
    await pool.end();
    await closeTestApp();
  });

  it('GET /v1/daily-notes/:date returns 200 with date and nodes array', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/daily-notes/2026-03-29',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ date: string; nodes: unknown[] }>();
    expect(body.date).toBe('2026-03-29');
    expect(Array.isArray(body.nodes)).toBe(true);
  });

  it('GET /v1/tags returns 200 with array containing the seeded tag', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/tags',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<Array<{ tagId: string; tagName: string; color: string | null }>>();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].tagId).toBe(TEST_TAG_ID);
    expect(body[0].tagName).toBe('readpathtest');
    expect(body[0].color).toBe('#aabbcc');
  });

  it('GET /v1/tags/:tagId/lens returns 200 with tagId and nodes array', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/tags/${TEST_TAG_ID}/lens`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ tagId: string; tagName: string; nodes: unknown[]; nextCursor: string | null }>();
    expect(body.tagId).toBe(TEST_TAG_ID);
    expect(Array.isArray(body.nodes)).toBe(true);
    expect(body.nextCursor).toBeNull();
  });

  it('GET /v1/tags/:tagId/lens accepts query params without error', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/tags/${TEST_TAG_ID}/lens?from=2026-01-01&to=2026-03-29&limit=10`,
    });

    expect(response.statusCode).toBe(200);
  });

  it('GET /v1/tags/:tagId/lens with invalid limit returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/tags/${TEST_TAG_ID}/lens?limit=notanumber`,
    });

    expect(response.statusCode).toBe(400);
  });
});
