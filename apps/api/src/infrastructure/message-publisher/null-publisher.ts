import { Injectable } from '@nestjs/common';
import type { IMessagePublisher } from '@notebase/shared';
import type { NoteBaseEvent } from '@notebase/shared';

/**
 * Phase 1 no-op publisher. The projection handler polls the event store
 * directly using a replay cursor, so no message publishing is required.
 * Replaced by RabbitMqPublisher in Phase 2.
 */
@Injectable()
export class NullPublisher implements IMessagePublisher {
  async publish(_event: NoteBaseEvent): Promise<void> {
    // intentional no-op
  }
}
