import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateNodeCommand } from './create-node.command';
import { EVENT_STORE, MESSAGE_PUBLISHER } from '../../../infrastructure/infrastructure.module';
import type { IEventStore, IMessagePublisher } from '@notebase/shared';

@CommandHandler(CreateNodeCommand)
export class CreateNodeHandler implements ICommandHandler<CreateNodeCommand> {
  constructor(
    @Inject(EVENT_STORE) private readonly eventStore: IEventStore,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: IMessagePublisher,
  ) {}

  async execute(command: CreateNodeCommand): Promise<{ eventId: string }> {
    const eventId = randomUUID();
    const event = {
      type: 'NodeCreated' as const,
      eventId,
      userId: command.userId,
      nodeId: command.nodeId,
      content: command.content,
      parentId: command.parentId,
      dailyNoteDate: command.dailyNoteDate,
      position: command.position,
      occurredAt: new Date().toISOString(),
    };
    await this.eventStore.append(event);
    await this.publisher.publish(event);
    return { eventId };
  }
}
