import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EditNodeCommand } from './edit-node.command';
import { EVENT_STORE, MESSAGE_PUBLISHER } from '../../../infrastructure/infrastructure.module';
import type { IEventStore, IMessagePublisher } from '@notebase/shared';

@CommandHandler(EditNodeCommand)
export class EditNodeHandler implements ICommandHandler<EditNodeCommand> {
  constructor(
    @Inject(EVENT_STORE) private readonly eventStore: IEventStore,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: IMessagePublisher,
  ) {}

  async execute(command: EditNodeCommand): Promise<{ eventId: string }> {
    const eventId = randomUUID();
    const event = {
      type: 'NodeEdited' as const,
      eventId,
      userId: command.userId,
      nodeId: command.nodeId,
      content: command.content,
      occurredAt: new Date().toISOString(),
    };
    await this.eventStore.append(event);
    await this.publisher.publish(event);
    return { eventId };
  }
}
