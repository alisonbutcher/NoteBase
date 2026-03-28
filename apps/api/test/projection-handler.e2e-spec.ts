import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Pool } from 'pg';
import { createTestApp, closeTestApp } from './app.e2e-setup';
import { ProjectionHandlerService } from '../src/modules/projection/projection-handler.service';

const E2E_USER_ID = '00000000-0000-0000-0000-000000000099';
const TEST_NODE_ID = '550e8400-e29b-41d4-a716-446655440055';
const TEST_TAG_ID = '550e8400-e29b-41d4-a716-446655440066';
const DATE = '2026-03-29';

describe('ProjectionHandler end-to-end (e2e)', () => {
  let app: NestFastifyApplication;
  let pool: Pool;
  let handler: ProjectionHandlerService;

  beforeAll(async () => {
    process.env.LOCAL_AUTH_USER_ID = E2E_USER_ID;
    app = await createTestApp();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    handler = app.get(ProjectionHandlerService);

    // Clean slate
    await pool.query(`DELETE FROM events WHERE payload->>'userId' = $1`, [E2E_USER_ID]);
    await pool.query(`DELETE FROM tags WHERE user_id = $1`, [E2E_USER_ID]);
    await pool.query(`DELETE FROM projection_daily_note WHERE user_id = $1`, [E2E_USER_ID]);
    await pool.query(`DELETE FROM projection_tag_lens WHERE user_id = $1`, [E2E_USER_ID]);

    // Reset handler cursor so it replays from the beginning of our test data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (handler as any).lastProcessedId = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (handler as any).nodeStates.clear();
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM events WHERE payload->>'userId' = $1`, [E2E_USER_ID]);
    await pool.query(`DELETE FROM tags WHERE user_id = $1`, [E2E_USER_ID]);
    await pool.query(`DELETE FROM projection_daily_note WHERE user_id = $1`, [E2E_USER_ID]);
    await pool.query(`DELETE FROM projection_tag_lens WHERE user_id = $1`, [E2E_USER_ID]);
    await pool.end();
    await closeTestApp();
  });

  it('projects NodeCreated into projection_daily_note', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/nodes',
      payload: {
        nodeId: TEST_NODE_ID,
        content: 'Projection handler test',
        parentId: null,
        dailyNoteDate: DATE,
        position: 0,
      },
    });

    await handler.pollOnce();

    const response = await app.inject({ method: 'GET', url: `/v1/daily-notes/${DATE}` });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ date: string; nodes: Array<{ nodeId: string; content: string; tags: string[] }> }>();
    const node = body.nodes.find((n) => n.nodeId === TEST_NODE_ID);
    expect(node).toBeDefined();
    expect(node?.content).toBe('Projection handler test');
    expect(node?.tags).toEqual([]);
  });

  it('projects NodeEdited — updates content in daily note', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/v1/nodes/${TEST_NODE_ID}`,
      payload: { content: 'Edited content' },
    });

    await handler.pollOnce();

    const response = await app.inject({ method: 'GET', url: `/v1/daily-notes/${DATE}` });
    const body = response.json<{ nodes: Array<{ nodeId: string; content: string }> }>();
    const node = body.nodes.find((n) => n.nodeId === TEST_NODE_ID);
    expect(node?.content).toBe('Edited content');
  });

  it('projects TagCreated + NodeTagged into tags table and tag lens', async () => {
    // Create tag explicitly then tag the node
    await app.inject({
      method: 'POST',
      url: '/v1/tags',
      payload: { tagId: TEST_TAG_ID, tagName: 'e2ehandler' },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/nodes/${TEST_NODE_ID}/tags`,
      payload: { tagName: 'e2ehandler' },
    });

    await handler.pollOnce();

    // Daily note should show the tag
    const dnResponse = await app.inject({ method: 'GET', url: `/v1/daily-notes/${DATE}` });
    const dnBody = dnResponse.json<{ nodes: Array<{ nodeId: string; tags: string[] }> }>();
    const node = dnBody.nodes.find((n) => n.nodeId === TEST_NODE_ID);
    expect(node?.tags).toContain('e2ehandler');

    // Tag lens should have the node
    const lensResponse = await app.inject({
      method: 'GET',
      url: `/v1/tags/${TEST_TAG_ID}/lens`,
    });
    const lensBody = lensResponse.json<{ nodes: Array<{ nodeId: string }> }>();
    expect(lensBody.nodes.some((n) => n.nodeId === TEST_NODE_ID)).toBe(true);
  });

  it('projects NodeUntagged — removes from tag lens and clears tag from daily note', async () => {
    await app.inject({
      method: 'DELETE',
      url: `/v1/nodes/${TEST_NODE_ID}/tags/${TEST_TAG_ID}`,
    });

    await handler.pollOnce();

    const lensResponse = await app.inject({
      method: 'GET',
      url: `/v1/tags/${TEST_TAG_ID}/lens`,
    });
    const lensBody = lensResponse.json<{ nodes: Array<{ nodeId: string }> }>();
    expect(lensBody.nodes.some((n) => n.nodeId === TEST_NODE_ID)).toBe(false);

    const dnResponse = await app.inject({ method: 'GET', url: `/v1/daily-notes/${DATE}` });
    const dnBody = dnResponse.json<{ nodes: Array<{ nodeId: string; tags: string[] }> }>();
    const node = dnBody.nodes.find((n) => n.nodeId === TEST_NODE_ID);
    expect(node?.tags).not.toContain('e2ehandler');
  });

  it('projects NodeDeleted — removes from daily note', async () => {
    await app.inject({ method: 'DELETE', url: `/v1/nodes/${TEST_NODE_ID}` });

    await handler.pollOnce();

    const response = await app.inject({ method: 'GET', url: `/v1/daily-notes/${DATE}` });
    const body = response.json<{ nodes: Array<{ nodeId: string }> }>();
    expect(body.nodes.some((n) => n.nodeId === TEST_NODE_ID)).toBe(false);
  });
});
