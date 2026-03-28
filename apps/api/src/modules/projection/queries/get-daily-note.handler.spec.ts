import { Test } from '@nestjs/testing';
import { GetDailyNoteHandler } from './get-daily-note.handler';
import { GetDailyNoteQuery } from './get-daily-note.query';
import { PROJECTION_STORE } from '../../../infrastructure/infrastructure.module';
import type { IProjectionStore, DailyNoteResult } from '@notebase/shared';

describe('GetDailyNoteHandler', () => {
  let handler: GetDailyNoteHandler;
  let projectionStore: jest.Mocked<IProjectionStore>;

  const mockResult: DailyNoteResult = {
    date: '2026-03-29',
    nodes: [
      {
        nodeId: 'node-1',
        content: 'Test content',
        parentId: null,
        position: 0,
        depth: 0,
        tags: ['work'],
        updatedAt: '2026-03-29T10:00:00.000Z',
      },
    ],
  };

  beforeEach(async () => {
    projectionStore = {
      getDailyNote: jest.fn().mockResolvedValue(mockResult),
      upsertDailyNoteNode: jest.fn(),
      deleteDailyNoteNode: jest.fn(),
      upsertTagLensNode: jest.fn(),
      deleteTagLensNode: jest.fn(),
      getTagLens: jest.fn(),
      upsertTag: jest.fn(),
      getTags: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        GetDailyNoteHandler,
        { provide: PROJECTION_STORE, useValue: projectionStore },
      ],
    }).compile();

    handler = module.get(GetDailyNoteHandler);
  });

  it('delegates to projectionStore.getDailyNote and returns the result', async () => {
    const query = new GetDailyNoteQuery('user-1', '2026-03-29');
    const result = await handler.execute(query);

    expect(projectionStore.getDailyNote).toHaveBeenCalledTimes(1);
    expect(projectionStore.getDailyNote).toHaveBeenCalledWith('user-1', '2026-03-29');
    expect(result).toEqual(mockResult);
  });
});
