import { Test } from '@nestjs/testing';
import { GetTagsHandler } from './get-tags.handler';
import { GetTagsQuery } from './get-tags.query';
import { PROJECTION_STORE } from '../../../infrastructure/infrastructure.module';
import type { IProjectionStore, TagRecord } from '@notebase/shared';

describe('GetTagsHandler', () => {
  let handler: GetTagsHandler;
  let projectionStore: jest.Mocked<IProjectionStore>;

  const mockTags: TagRecord[] = [
    { tagId: 'tag-1', tagName: 'work', color: '#ff0000', createdAt: '2026-03-29T10:00:00.000Z' },
    { tagId: 'tag-2', tagName: 'personal', color: null, createdAt: '2026-03-29T11:00:00.000Z' },
  ];

  beforeEach(async () => {
    projectionStore = {
      getTags: jest.fn().mockResolvedValue(mockTags),
      getDailyNote: jest.fn(),
      upsertDailyNoteNode: jest.fn(),
      deleteDailyNoteNode: jest.fn(),
      getTagLens: jest.fn(),
      upsertTagLensNode: jest.fn(),
      deleteTagLensNode: jest.fn(),
      upsertTag: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        GetTagsHandler,
        { provide: PROJECTION_STORE, useValue: projectionStore },
      ],
    }).compile();

    handler = module.get(GetTagsHandler);
  });

  it('delegates to projectionStore.getTags and returns the result', async () => {
    const query = new GetTagsQuery('user-1');
    const result = await handler.execute(query);

    expect(projectionStore.getTags).toHaveBeenCalledTimes(1);
    expect(projectionStore.getTags).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(mockTags);
  });
});
