import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateTagCommand } from './create-tag.command';
import {
  EVENT_STORE,
  MESSAGE_PUBLISHER,
  PROJECTION_STORE,
} from '../../../infrastructure/infrastructure.module';
import type { IEventStore, IMessagePublisher, IProjectionStore } from '@notebase/shared';

@CommandHandler(CreateTagCommand)
export class CreateTagHandler implements ICommandHandler<CreateTagCommand> {
  constructor(
    @Inject(EVENT_STORE) private readonly eventStore: IEventStore,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: IMessagePublisher,
    @Inject(PROJECTION_STORE) private readonly projectionStore: IProjectionStore,
  ) {}

  async execute(command: CreateTagCommand): Promise<{ eventId: string; tagId: string }> {
    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();
    const tagName = command.tagName.toLowerCase();

    const event = {
      type: 'TagCreated' as const,
      eventId,
      userId: command.userId,
      tagId: command.tagId,
      tagName,
      color: command.color,
      occurredAt,
    };

    await this.eventStore.append(event);
    await this.publisher.publish(event);
    await this.projectionStore.upsertTag(command.userId, {
      tagId: command.tagId,
      tagName,
      color: command.color,
      createdAt: occurredAt,
    });

    return { eventId, tagId: command.tagId };
  }
}
