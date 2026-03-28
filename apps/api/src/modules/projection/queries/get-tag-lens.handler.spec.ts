import { Test } from '@nestjs/testing';
import { GetTagLensHandler } from './get-tag-lens.handler';
import { GetTagLensQuery } from './get-tag-lens.query';
import { PROJECTION_STORE } from '../../../infrastructure/infrastructure.module';
import type { IProjectionStore, TagLensResult } from '@notebase/shared';

describe('GetTagLensHandler', () => {
  let handler: GetTagLensHandler;
  let projectionStore: jest.Mocked<IProjectionStore>;

  const mockResult: TagLensResult = {
    tagId: 'tag-1',
    tagName: 'work',
    nodes: [
      {
        nodeId: 'node-1',
        content: 'Test content',
        dailyNoteDate: '2026-03-29',
        parentId: null,
        position: 0,
        childCount: 0,
        updatedAt: '2026-03-29T10:00:00.000Z',
      },
    ],
    nextCursor: null,
  };

  beforeEach(async () => {
    projectionStore = {
      getTagLens: jest.fn().mockResolvedValue(mockResult),
      getDailyNote: jest.fn(),
      upsertDailyNoteNode: jest.fn(),
      deleteDailyNoteNode: jest.fn(),
      upsertTagLensNode: jest.fn(),
      deleteTagLensNode: jest.fn(),
      upsertTag: jest.fn(),
      getTags: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        GetTagLensHandler,
        { provide: PROJECTION_STORE, useValue: projectionStore },
      ],
    }).compile();

    handler = module.get(GetTagLensHandler);
  });

  it('delegates to projectionStore.getTagLens and returns the result', async () => {
    const query = new GetTagLensQuery('user-1', 'tag-1', { from: '2026-01-01', limit: 50 });
    const result = await handler.execute(query);

    expect(projectionStore.getTagLens).toHaveBeenCalledTimes(1);
    expect(projectionStore.getTagLens).toHaveBeenCalledWith('user-1', 'tag-1', {
      from: '2026-01-01',
      limit: 50,
    });
    expect(result).toEqual(mockResult);
  });

  it('passes empty options when none are provided', async () => {
    const query = new GetTagLensQuery('user-1', 'tag-1');
    await handler.execute(query);

    expect(projectionStore.getTagLens).toHaveBeenCalledWith('user-1', 'tag-1', {});
  });
});
