import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProjectionHandlerService } from './projection-handler.service';
import { EVENT_STORE, PROJECTION_STORE } from '../../infrastructure/infrastructure.module';
import type { IEventStore, IProjectionStore, StoredEvent } from '@notebase/shared';

const USER = 'user-1';
const DATE = '2026-03-29';
const NODE_ID = 'node-1';
const TAG_ID = 'tag-1';

function makeStoredEvent(id: number, event: StoredEvent['event']): StoredEvent {
  return { id, event };
}

describe('ProjectionHandlerService', () => {
  let service: ProjectionHandlerService;
  let eventStore: jest.Mocked<IEventStore>;
  let projectionStore: jest.Mocked<IProjectionStore>;

  beforeEach(async () => {
    eventStore = {
      append: jest.fn(),
      getEventsSince: jest.fn().mockResolvedValue([]),
    };
    projectionStore = {
      upsertDailyNoteNode: jest.fn().mockResolvedValue(undefined),
      deleteDailyNoteNode: jest.fn().mockResolvedValue(undefined),
      getDailyNote: jest.fn(),
      upsertTagLensNode: jest.fn().mockResolvedValue(undefined),
      deleteTagLensNode: jest.fn().mockResolvedValue(undefined),
      getTagLens: jest.fn(),
      upsertTag: jest.fn().mockResolvedValue(undefined),
      getTags: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ProjectionHandlerService,
        { provide: EVENT_STORE, useValue: eventStore },
        { provide: PROJECTION_STORE, useValue: projectionStore },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(500) },
        },
      ],
    }).compile();

    service = module.get(ProjectionHandlerService);
  });

  describe('NodeCreated', () => {
    it('upserts into projection_daily_note with depth 0 for root nodes', async () => {
      eventStore.getEventsSince.mockResolvedValueOnce([
        makeStoredEvent(1, {
          type: 'NodeCreated',
          eventId: 'e1',
          userId: USER,
          nodeId: NODE_ID,
          content: 'Hello',
          parentId: null,
          dailyNoteDate: DATE,
          position: 0,
          occurredAt: '2026-03-29T10:00:00.000Z',
        }),
      ]);

      await service.pollOnce();

      expect(projectionStore.upsertDailyNoteNode).toHaveBeenCalledTimes(1);
      const [userId, date, node] = projectionStore.upsertDailyNoteNode.mock.calls[0];
      expect(userId).toBe(USER);
      expect(date).toBe(DATE);
      expect(node.nodeId).toBe(NODE_ID);
      expect(node.content).toBe('Hello');
      expect(node.depth).toBe(0);
      expect(node.tags).toEqual([]);
    });

    it('sets depth 1 for a child node whose parent has been projected', async () => {
      eventStore.getEventsSince.mockResolvedValueOnce([
        makeStoredEvent(1, {
          type: 'NodeCreated',
          eventId: 'e1',
          userId: USER,
          nodeId: 'parent-node',
          content: 'Parent',
          parentId: null,
          dailyNoteDate: DATE,
          position: 0,
          occurredAt: '2026-03-29T10:00:00.000Z',
        }),
        makeStoredEvent(2, {
          type: 'NodeCreated',
          eventId: 'e2',
          userId: USER,
          nodeId: 'child-node',
          content: 'Child',
          parentId: 'parent-node',
          dailyNoteDate: DATE,
          position: 0,
          occurredAt: '2026-03-29T10:00:01.000Z',
        }),
      ]);

      await service.pollOnce();

      const childCall = projectionStore.upsertDailyNoteNode.mock.calls.find(
        ([, , node]) => node.nodeId === 'child-node',
      );
      expect(childCall?.[2].depth).toBe(1);
    });
  });

  describe('NodeEdited', () => {
    it('updates content in daily note and tag lens projections', async () => {
      eventStore.getEventsSince.mockResolvedValueOnce([
        makeStoredEvent(1, {
          type: 'NodeCreated',
          eventId: 'e1',
          userId: USER,
          nodeId: NODE_ID,
          content: 'Original',
          parentId: null,
          dailyNoteDate: DATE,
          position: 0,
          occurredAt: '2026-03-29T10:00:00.000Z',
        }),
        makeStoredEvent(2, {
          type: 'TagCreated',
          eventId: 'e2',
          userId: USER,
          tagId: TAG_ID,
          tagName: 'work',
          color: null,
          occurredAt: '2026-03-29T10:00:01.000Z',
        }),
        makeStoredEvent(3, {
          type: 'NodeTagged',
          eventId: 'e3',
          userId: USER,
          nodeId: NODE_ID,
          tagId: TAG_ID,
          tagName: 'work',
          occurredAt: '2026-03-29T10:00:02.000Z',
        }),
        makeStoredEvent(4, {
          type: 'NodeEdited',
          eventId: 'e4',
          userId: USER,
          nodeId: NODE_ID,
          content: 'Updated',
          occurredAt: '2026-03-29T10:00:03.000Z',
        }),
      ]);

      await service.pollOnce();

      // Last upsertDailyNoteNode call should have updated content
      const calls = projectionStore.upsertDailyNoteNode.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2].content).toBe('Updated');

      // Tag lens should also be updated
      const lensCall = projectionStore.upsertTagLensNode.mock.calls.find(
        ([, , , node]) => node.content === 'Updated',
      );
      expect(lensCall).toBeDefined();
    });
  });

  describe('NodeDeleted', () => {
    it('deletes from daily note and all tag lens projections', async () => {
      eventStore.getEventsSince.mockResolvedValueOnce([
        makeStoredEvent(1, {
          type: 'NodeCreated',
          eventId: 'e1',
          userId: USER,
          nodeId: NODE_ID,
          content: 'Hello',
          parentId: null,
          dailyNoteDate: DATE,
          position: 0,
          occurredAt: '2026-03-29T10:00:00.000Z',
        }),
        makeStoredEvent(2, {
          type: 'NodeTagged',
          eventId: 'e2',
          userId: USER,
          nodeId: NODE_ID,
          tagId: TAG_ID,
          tagName: 'work',
          occurredAt: '2026-03-29T10:00:01.000Z',
        }),
        makeStoredEvent(3, {
          type: 'NodeDeleted',
          eventId: 'e3',
          userId: USER,
          nodeId: NODE_ID,
          softDelete: false,
          occurredAt: '2026-03-29T10:00:02.000Z',
        }),
      ]);

      await service.pollOnce();

      expect(projectionStore.deleteDailyNoteNode).toHaveBeenCalledWith(USER, DATE, NODE_ID);
      expect(projectionStore.deleteTagLensNode).toHaveBeenCalledWith(USER, TAG_ID, NODE_ID);
    });
  });

  describe('NodeTagged / NodeUntagged', () => {
    it('adds node to tag lens on NodeTagged', async () => {
      eventStore.getEventsSince.mockResolvedValueOnce([
        makeStoredEvent(1, {
          type: 'NodeCreated',
          eventId: 'e1',
          userId: USER,
          nodeId: NODE_ID,
          content: 'Hello',
          parentId: null,
          dailyNoteDate: DATE,
          position: 0,
          occurredAt: '2026-03-29T10:00:00.000Z',
        }),
        makeStoredEvent(2, {
          type: 'NodeTagged',
          eventId: 'e2',
          userId: USER,
          nodeId: NODE_ID,
          tagId: TAG_ID,
          tagName: 'work',
          occurredAt: '2026-03-29T10:00:01.000Z',
        }),
      ]);

      await service.pollOnce();

      expect(projectionStore.upsertTagLensNode).toHaveBeenCalledTimes(1);
      const [userId, tagId, tagName, node] =
        projectionStore.upsertTagLensNode.mock.calls[0];
      expect(userId).toBe(USER);
      expect(tagId).toBe(TAG_ID);
      expect(tagName).toBe('work');
      expect(node.nodeId).toBe(NODE_ID);
      expect(node.content).toBe('Hello');
    });

    it('removes node from tag lens on NodeUntagged', async () => {
      eventStore.getEventsSince.mockResolvedValueOnce([
        makeStoredEvent(1, {
          type: 'NodeCreated',
          eventId: 'e1',
          userId: USER,
          nodeId: NODE_ID,
          content: 'Hello',
          parentId: null,
          dailyNoteDate: DATE,
          position: 0,
          occurredAt: '2026-03-29T10:00:00.000Z',
        }),
        makeStoredEvent(2, {
          type: 'NodeTagged',
          eventId: 'e2',
          userId: USER,
          nodeId: NODE_ID,
          tagId: TAG_ID,
          tagName: 'work',
          occurredAt: '2026-03-29T10:00:01.000Z',
        }),
        makeStoredEvent(3, {
          type: 'NodeUntagged',
          eventId: 'e3',
          userId: USER,
          nodeId: NODE_ID,
          tagId: TAG_ID,
          occurredAt: '2026-03-29T10:00:02.000Z',
        }),
      ]);

      await service.pollOnce();

      expect(projectionStore.deleteTagLensNode).toHaveBeenCalledWith(USER, TAG_ID, NODE_ID);
    });

    it('updates tags array in daily note on NodeTagged', async () => {
      eventStore.getEventsSince.mockResolvedValueOnce([
        makeStoredEvent(1, {
          type: 'NodeCreated',
          eventId: 'e1',
          userId: USER,
          nodeId: NODE_ID,
          content: 'Hello',
          parentId: null,
          dailyNoteDate: DATE,
          position: 0,
          occurredAt: '2026-03-29T10:00:00.000Z',
        }),
        makeStoredEvent(2, {
          type: 'NodeTagged',
          eventId: 'e2',
          userId: USER,
          nodeId: NODE_ID,
          tagId: TAG_ID,
          tagName: 'work',
          occurredAt: '2026-03-29T10:00:01.000Z',
        }),
      ]);

      await service.pollOnce();

      const calls = projectionStore.upsertDailyNoteNode.mock.calls;
      const taggedCall = calls[calls.length - 1];
      expect(taggedCall[2].tags).toEqual(['work']);
    });
  });

  describe('TagCreated', () => {
    it('upserts tag into projection store', async () => {
      eventStore.getEventsSince.mockResolvedValueOnce([
        makeStoredEvent(1, {
          type: 'TagCreated',
          eventId: 'e1',
          userId: USER,
          tagId: TAG_ID,
          tagName: 'work',
          color: '#ff0000',
          occurredAt: '2026-03-29T10:00:00.000Z',
        }),
      ]);

      await service.pollOnce();

      expect(projectionStore.upsertTag).toHaveBeenCalledWith(USER, {
        tagId: TAG_ID,
        tagName: 'work',
        color: '#ff0000',
        createdAt: '2026-03-29T10:00:00.000Z',
      });
    });
  });

  describe('cursor advancement', () => {
    it('advances lastProcessedId so events are not reprocessed', async () => {
      eventStore.getEventsSince
        .mockResolvedValueOnce([
          makeStoredEvent(5, {
            type: 'NodeCreated',
            eventId: 'e1',
            userId: USER,
            nodeId: NODE_ID,
            content: 'Hello',
            parentId: null,
            dailyNoteDate: DATE,
            position: 0,
            occurredAt: '2026-03-29T10:00:00.000Z',
          }),
        ])
        .mockResolvedValueOnce([]);

      await service.pollOnce();
      await service.pollOnce();

      expect(eventStore.getEventsSince).toHaveBeenNthCalledWith(1, 0);
      expect(eventStore.getEventsSince).toHaveBeenNthCalledWith(2, 5);
    });
  });
});
