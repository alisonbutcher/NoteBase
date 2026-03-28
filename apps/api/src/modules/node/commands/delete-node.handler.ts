import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DeleteNodeCommand } from './delete-node.command';
import { EVENT_STORE, MESSAGE_PUBLISHER } from '../../../infrastructure/infrastructure.module';
import type { IEventStore, IMessagePublisher } from '@notebase/shared';

@CommandHandler(DeleteNodeCommand)
export class DeleteNodeHandler implements ICommandHandler<DeleteNodeCommand> {
  constructor(
    @Inject(EVENT_STORE) private readonly eventStore: IEventStore,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: IMessagePublisher,
  ) {}

  async execute(command: DeleteNodeCommand): Promise<{ eventId: string }> {
    const eventId = randomUUID();
    const event = {
      type: 'NodeDeleted' as const,
      eventId,
      userId: command.userId,
      nodeId: command.nodeId,
      softDelete: true,
      occurredAt: new Date().toISOString(),
    };
    await this.eventStore.append(event);
    await this.publisher.publish(event);
    return { eventId };
  }
}
