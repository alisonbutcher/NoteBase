import { Test } from '@nestjs/testing';
import { TagNodeHandler } from './tag-node.handler';
import { TagNodeCommand } from './tag-node.command';
import { EVENT_STORE, MESSAGE_PUBLISHER } from '../../../infrastructure/infrastructure.module';
import type { IEventStore, IMessagePublisher } from '@notebase/shared';

describe('TagNodeHandler', () => {
  let handler: TagNodeHandler;
  let eventStore: jest.Mocked<IEventStore>;
  let publisher: jest.Mocked<IMessagePublisher>;

  beforeEach(async () => {
    eventStore = { append: jest.fn().mockResolvedValue(undefined), getEventsSince: jest.fn() };
    publisher = { publish: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        TagNodeHandler,
        { provide: EVENT_STORE, useValue: eventStore },
        { provide: MESSAGE_PUBLISHER, useValue: publisher },
      ],
    }).compile();

    handler = module.get(TagNodeHandler);
  });

  it('appends a NodeTagged event and returns eventId + tagId', async () => {
    const command = new TagNodeCommand('user-1', 'node-1', 'tag-1', 'Work');
    const result = await handler.execute(command);

    expect(result.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.tagId).toBe('tag-1');

    expect(eventStore.append).toHaveBeenCalledTimes(1);
    const appended = eventStore.append.mock.calls[0][0];
    expect(appended.type).toBe('NodeTagged');
    expect(appended.userId).toBe('user-1');
    if (appended.type === 'NodeTagged') {
      expect(appended.nodeId).toBe('node-1');
      expect(appended.tagId).toBe('tag-1');
      expect(appended.tagName).toBe('work');
    }
  });

  it('publishes the same event that was appended', async () => {
    const command = new TagNodeCommand('user-1', 'node-1', 'tag-1', 'Work');
    await handler.execute(command);

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish.mock.calls[0][0]).toEqual(eventStore.append.mock.calls[0][0]);
  });
});
