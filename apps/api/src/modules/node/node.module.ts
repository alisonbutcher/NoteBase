import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

/**
 * Handles node write operations (CreateNode, EditNode, MoveNode, DeleteNode).
 * Command handlers are added in issue #5.
 */
@Module({
  imports: [CqrsModule],
})
export class NodeModule {}
