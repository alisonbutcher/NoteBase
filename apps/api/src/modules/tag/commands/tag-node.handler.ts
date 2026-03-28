import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TagNodeCommand } from './tag-node.command';
import { EVENT_STORE, MESSAGE_PUBLISHER } from '../../../infrastructure/infrastructure.module';
import type { IEventStore, IMessagePublisher } from '@notebase/shared';

@CommandHandler(TagNodeCommand)
export class TagNodeHandler implements ICommandHandler<TagNodeCommand> {
  constructor(
    @Inject(EVENT_STORE) private readonly eventStore: IEventStore,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: IMessagePublisher,
  ) {}

  async execute(command: TagNodeCommand): Promise<{ eventId: string; tagId: string }> {
    const eventId = randomUUID();
    const event = {
      type: 'NodeTagged' as const,
      eventId,
      userId: command.userId,
      nodeId: command.nodeId,
      tagId: command.tagId,
      tagName: command.tagName.toLowerCase(),
      occurredAt: new Date().toISOString(),
    };
    await this.eventStore.append(event);
    await this.publisher.publish(event);
    return { eventId, tagId: command.tagId };
  }
}
