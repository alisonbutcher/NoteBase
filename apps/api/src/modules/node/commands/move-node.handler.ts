import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MoveNodeCommand } from './move-node.command';
import { EVENT_STORE, MESSAGE_PUBLISHER } from '../../../infrastructure/infrastructure.module';
import type { IEventStore, IMessagePublisher } from '@notebase/shared';

@CommandHandler(MoveNodeCommand)
export class MoveNodeHandler implements ICommandHandler<MoveNodeCommand> {
  constructor(
    @Inject(EVENT_STORE) private readonly eventStore: IEventStore,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: IMessagePublisher,
  ) {}

  async execute(command: MoveNodeCommand): Promise<{ eventId: string }> {
    const eventId = randomUUID();
    const event = {
      type: 'NodeMoved' as const,
      eventId,
      userId: command.userId,
      nodeId: command.nodeId,
      newParentId: command.newParentId,
      newPosition: command.newPosition,
      occurredAt: new Date().toISOString(),
    };
    await this.eventStore.append(event);
    await this.publisher.publish(event);
    return { eventId };
  }
}
