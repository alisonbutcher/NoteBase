import { Test } from '@nestjs/testing';
import { CreateTagHandler } from './create-tag.handler';
import { CreateTagCommand } from './create-tag.command';
import {
  EVENT_STORE,
  MESSAGE_PUBLISHER,
  PROJECTION_STORE,
} from '../../../infrastructure/infrastructure.module';
import type { IEventStore, IMessagePublisher, IProjectionStore } from '@notebase/shared';

describe('CreateTagHandler', () => {
  let handler: CreateTagHandler;
  let eventStore: jest.Mocked<IEventStore>;
  let publisher: jest.Mocked<IMessagePublisher>;
  let projectionStore: jest.Mocked<IProjectionStore>;

  beforeEach(async () => {
    eventStore = { append: jest.fn().mockResolvedValue(undefined), getEventsSince: jest.fn() };
    publisher = { publish: jest.fn().mockResolvedValue(undefined) };
    projectionStore = {
      upsertTag: jest.fn().mockResolvedValue(undefined),
      upsertDailyNoteNode: jest.fn(),
      deleteDailyNoteNode: jest.fn(),
      getDailyNote: jest.fn(),
      upsertTagLensNode: jest.fn(),
      deleteTagLensNode: jest.fn(),
      getTagLens: jest.fn(),
      getTags: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreateTagHandler,
        { provide: EVENT_STORE, useValue: eventStore },
        { provide: MESSAGE_PUBLISHER, useValue: publisher },
        { provide: PROJECTION_STORE, useValue: projectionStore },
      ],
    }).compile();

    handler = module.get(CreateTagHandler);
  });

  it('appends a TagCreated event and returns eventId + tagId', async () => {
    const command = new CreateTagCommand('user-1', 'tag-1', 'Work', null);
    const result = await handler.execute(command);

    expect(result.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.tagId).toBe('tag-1');

    expect(eventStore.append).toHaveBeenCalledTimes(1);
    const appended = eventStore.append.mock.calls[0][0];
    expect(appended.type).toBe('TagCreated');
    expect(appended.userId).toBe('user-1');
    if (appended.type === 'TagCreated') {
      expect(appended.tagId).toBe('tag-1');
      expect(appended.tagName).toBe('work');
      expect(appended.color).toBeNull();
    }
  });

  it('normalizes tagName to lowercase', async () => {
    const command = new CreateTagCommand('user-1', 'tag-1', 'MyProject', null);
    await handler.execute(command);

    const appended = eventStore.append.mock.calls[0][0];
    if (appended.type === 'TagCreated') {
      expect(appended.tagName).toBe('myproject');
    }
  });

  it('publishes the same event that was appended', async () => {
    const command = new CreateTagCommand('user-1', 'tag-1', 'Work', null);
    await handler.execute(command);

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish.mock.calls[0][0]).toEqual(eventStore.append.mock.calls[0][0]);
  });

  it('upserts the tag into the projection store', async () => {
    const command = new CreateTagCommand('user-1', 'tag-1', 'Work', '#ff0000');
    await handler.execute(command);

    expect(projectionStore.upsertTag).toHaveBeenCalledTimes(1);
    const [userId, tag] = projectionStore.upsertTag.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(tag.tagId).toBe('tag-1');
    expect(tag.tagName).toBe('work');
    expect(tag.color).toBe('#ff0000');
  });
});
