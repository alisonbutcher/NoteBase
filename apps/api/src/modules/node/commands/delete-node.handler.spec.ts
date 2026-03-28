import { Test } from '@nestjs/testing';
import { DeleteNodeHandler } from './delete-node.handler';
import { DeleteNodeCommand } from './delete-node.command';
import { EVENT_STORE, MESSAGE_PUBLISHER } from '../../../infrastructure/infrastructure.module';
import type { IEventStore, IMessagePublisher } from '@notebase/shared';

describe('DeleteNodeHandler', () => {
  let handler: DeleteNodeHandler;
  let eventStore: jest.Mocked<IEventStore>;
  let publisher: jest.Mocked<IMessagePublisher>;

  beforeEach(async () => {
    eventStore = { append: jest.fn().mockResolvedValue(undefined), getEventsSince: jest.fn() };
    publisher = { publish: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        DeleteNodeHandler,
        { provide: EVENT_STORE, useValue: eventStore },
        { provide: MESSAGE_PUBLISHER, useValue: publisher },
      ],
    }).compile();

    handler = module.get(DeleteNodeHandler);
  });

  it('appends a NodeDeleted event with softDelete=true and returns an eventId', async () => {
    const command = new DeleteNodeCommand('user-1', 'node-1');

    const result = await handler.execute(command);

    expect(result.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    expect(eventStore.append).toHaveBeenCalledTimes(1);
    const appended = eventStore.append.mock.calls[0][0];
    expect(appended.type).toBe('NodeDeleted');
    expect(appended.userId).toBe('user-1');
    expect(appended.eventId).toBe(result.eventId);
    if (appended.type === 'NodeDeleted') {
      expect(appended.nodeId).toBe('node-1');
      expect(appended.softDelete).toBe(true);
    }
  });

  it('publishes the same event that was appended', async () => {
    const command = new DeleteNodeCommand('user-1', 'node-1');
    await handler.execute(command);

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish.mock.calls[0][0]).toEqual(eventStore.append.mock.calls[0][0]);
  });
});
