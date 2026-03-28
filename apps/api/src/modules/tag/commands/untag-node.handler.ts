import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UntagNodeCommand } from './untag-node.command';
import { EVENT_STORE, MESSAGE_PUBLISHER } from '../../../infrastructure/infrastructure.module';
import type { IEventStore, IMessagePublisher } from '@notebase/shared';

@CommandHandler(UntagNodeCommand)
export class UntagNodeHandler implements ICommandHandler<UntagNodeCommand> {
  constructor(
    @Inject(EVENT_STORE) private readonly eventStore: IEventStore,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: IMessagePublisher,
  ) {}

  async execute(command: UntagNodeCommand): Promise<{ eventId: string }> {
    const eventId = randomUUID();
    const event = {
      type: 'NodeUntagged' as const,
      eventId,
      userId: command.userId,
      nodeId: command.nodeId,
      tagId: command.tagId,
      occurredAt: new Date().toISOString(),
    };
    await this.eventStore.append(event);
    await this.publisher.publish(event);
    return { eventId };
  }
}
