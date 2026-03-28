import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

/**
 * Handles tag write operations (CreateTag, TagNode, UntagNode).
 * Command handlers are added in issue #6.
 */
@Module({
  imports: [CqrsModule],
})
export class TagModule {}
